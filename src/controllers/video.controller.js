import mongoose, { isValidObjectId } from "mongoose";
import fs from "fs";
import path from "path";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, uploadVideoOnCloudinary } from "../utils/cloudinary.js";
import { transcodeVideoJob } from "../workers/transcode.worker.js";
import { generateStoryboardJob } from "../workers/storyboard.worker.js";

/**
 * Get all published videos with search query, sorting, and pagination
 */
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query;

    const pipeline = [];

    // Filter by search query on title or description
    if (query) {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } }
                ]
            }
        });
    }

    // Filter by specific user/channel
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId format");
        }
        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // Only return published videos
    pipeline.push({
        $match: {
            isPublished: true
        }
    });

    // Populate owner information
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" }
            }
        }
    );

    // Sorting
    const sortStage = {};
    sortStage[sortBy] = sortType === "asc" ? 1 : -1;
    pipeline.push({ $sort: sortStage });

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const videos = await Video.aggregatePaginate(Video.aggregate(pipeline), options);

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

/**
 * Publish a new video
 * Stores video with localPath for HTTP 206 chunked streaming, and Cloudinary if configured
 */
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required");
    }

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required");
    }

    const videoStat = fs.existsSync(videoFileLocalPath) ? fs.statSync(videoFileLocalPath) : null;
    const fileSize = videoStat ? videoStat.size : 0;

    // Ensure uploads directory exists for persistent local streaming
    const uploadsDir = path.resolve("public/uploads/videos");
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Persistent local file destination
    const persistentFileName = `${Date.now()}-${path.basename(videoFileLocalPath)}`;
    const persistentLocalPath = path.join(uploadsDir, persistentFileName);
    fs.copyFileSync(videoFileLocalPath, persistentLocalPath);

    // Attempt Cloudinary upload as secondary/cloud backup if configured
    let videoCloudUrl = "";
    let thumbnailCloudUrl = "";
    let duration = 0;

    try {
        const videoUploadResult = await uploadVideoOnCloudinary(videoFileLocalPath);
        if (videoUploadResult) {
            videoCloudUrl = videoUploadResult.secure_url || videoUploadResult.url;
            duration = Math.round(videoUploadResult.duration || 0);
        }

        const thumbnailUploadResult = await uploadOnCloudinary(thumbnailLocalPath);
        if (thumbnailUploadResult) {
            thumbnailCloudUrl = thumbnailUploadResult.secure_url || thumbnailUploadResult.url;
        }
    } catch (cloudErr) {
        console.warn("Cloudinary upload skipped or failed, using local storage fallback:", cloudErr.message);
    }

    // Create Video in database
    const video = await Video.create({
        title,
        description,
        videoFile: videoCloudUrl || `/api/v1/videos/stream/temp`, // Will update with ID
        localPath: persistentLocalPath,
        thumbnail: thumbnailCloudUrl || `/uploads/${path.basename(thumbnailLocalPath)}`,
        duration,
        fileSize,
        mimeType: req.files.videoFile[0].mimetype || "video/mp4",
        owner: req.user._id,
        isPublished: true
    });

    // If no remote URL, point videoFile to internal HTTP 206 streaming endpoint
    if (!videoCloudUrl) {
        video.videoFile = `/api/v1/videos/stream/${video._id}`;
        await video.save();
    }

    // Trigger asynchronous multi-bitrate HLS adaptive transcoding & storyboard preview pipeline
    if (persistentLocalPath && fs.existsSync(persistentLocalPath)) {
        transcodeVideoJob(video._id, persistentLocalPath).catch((err) => {
            console.error("Background HLS transcode job error:", err);
        });
        generateStoryboardJob(video._id, persistentLocalPath).catch((err) => {
            console.error("Background storyboard generation error:", err);
        });
    }

    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video published successfully. HLS transcoding initiated."));
});

/**
 * Retrieve video by ID and increment view count
 */
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID format");
    }

    const video = await Video.findById(videoId).populate("owner", "username fullName avatar");

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Increment view count
    video.views += 1;
    await video.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"));
});

/**
 * Update video title, description, or thumbnail
 */
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID format");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Verify ownership
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to update this video");
    }

    if (title?.trim()) video.title = title;
    if (description?.trim()) video.description = description;

    if (req.file) {
        const thumbnailResult = await uploadOnCloudinary(req.file.path);
        if (thumbnailResult) {
            video.thumbnail = thumbnailResult.url;
        }
    }

    await video.save();

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"));
});

/**
 * Delete a video and its local file
 */
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID format");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this video");
    }

    // Cleanup local file if it exists
    if (video.localPath && fs.existsSync(video.localPath)) {
        try {
            fs.unlinkSync(video.localPath);
        } catch (err) {
            console.error("Error deleting local video file:", err);
        }
    }

    await Video.findByIdAndDelete(videoId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

/**
 * Toggle publication status
 */
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID format");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to modify this video");
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res
        .status(200)
        .json(new ApiResponse(200, { isPublished: video.isPublished }, "Publish status toggled"));
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
};
