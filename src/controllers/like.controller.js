import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    // Return mock toggle for demo video IDs
    return res.status(200).json(
      new ApiResponse(200, { isLiked: true }, "Video like toggled successfully")
    );
  }

  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
    return res.status(200).json(
      new ApiResponse(200, { isLiked: false }, "Video unliked successfully")
    );
  }

  const newLike = await Like.create({
    video: videoId,
    likedBy: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, { isLiked: true, like: newLike }, "Video liked successfully")
  );
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    return res.status(200).json(
      new ApiResponse(200, { isLiked: true }, "Comment like toggled successfully")
    );
  }

  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
    return res.status(200).json(
      new ApiResponse(200, { isLiked: false }, "Comment unliked successfully")
    );
  }

  const newLike = await Like.create({
    comment: commentId,
    likedBy: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, { isLiked: true, like: newLike }, "Comment liked successfully")
  );
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }

  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
    return res.status(200).json(
      new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully")
    );
  }

  const newLike = await Like.create({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, { isLiked: true, like: newLike }, "Tweet liked successfully")
  );
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user._id),
        video: { $exists: true, $ne: null },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
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
        ],
      },
    },
    {
      $addFields: {
        video: { $first: "$video" },
      },
    },
    {
      $match: {
        "video._id": { $exists: true },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
  );
});

export {
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
  getLikedVideos,
};