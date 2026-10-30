import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    // If demo or non-ObjectId video ID, return empty list gracefully
    return res.status(200).json(
      new ApiResponse(200, { docs: [], totalDocs: 0, page: 1, limit: 20 }, "Comments fetched successfully")
    );
  }

  const comments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
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
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: { $first: "$owner" },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    },
    {
      $limit: parseInt(limit, 10),
    },
  ]);

  const totalDocs = await Comment.countDocuments({
    video: new mongoose.Types.ObjectId(videoId),
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { docs: comments, totalDocs, page: parseInt(page, 10), limit: parseInt(limit, 10) },
      "Comments fetched successfully"
    )
  );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    throw new ApiError(400, "Comment content is required");
  }

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    // Return mock success for demo streams
    const mockComment = {
      _id: new mongoose.Types.ObjectId(),
      content,
      video: videoId,
      owner: req.user ? {
        _id: req.user._id,
        username: req.user.username,
        fullName: req.user.fullName,
        avatar: req.user.avatar,
      } : {
        username: "guest_viewer",
        fullName: "Viewer",
        avatar: "",
      },
      createdAt: new Date().toISOString(),
    };
    return res.status(201).json(new ApiResponse(201, mockComment, "Comment added successfully"));
  }

  const comment = await Comment.create({
    content: content.trim(),
    video: videoId,
    owner: req.user?._id || new mongoose.Types.ObjectId(),
  });

  const populatedComment = await Comment.findById(comment._id).populate("owner", "username fullName avatar");

  return res.status(201).json(new ApiResponse(201, populatedComment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    throw new ApiError(400, "Content cannot be empty");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (req.user && comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to update this comment");
  }

  comment.content = content.trim();
  await comment.save();

  return res.status(200).json(new ApiResponse(200, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (req.user && comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to delete this comment");
  }

  await Comment.findByIdAndDelete(commentId);

  return res.status(200).json(new ApiResponse(200, { commentId }, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
