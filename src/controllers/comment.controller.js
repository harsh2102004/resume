/**
 * @file src/controllers/comment.controller.js
 * @description Comment CRUD controller: paginated video comments with like counts, plus create, update, and delete with ownership checks.
 */

import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }

  const userId = req.user?._id;

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
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "commentLikes",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$commentLikes" },
        likes: { $size: "$commentLikes" },
        isLiked: {
          $cond: {
            if: {
              $in: [
                userId ? new mongoose.Types.ObjectId(userId) : null,
                "$commentLikes.likedBy",
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        commentLikes: 0,
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

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const comment = await Comment.create({
    content: content.trim(),
    video: videoId,
    owner: req.user._id,
  });

  const populatedComment = await Comment.findById(comment._id).populate("owner", "username fullName avatar");
  const commentObj = populatedComment.toObject ? populatedComment.toObject() : { ...populatedComment };
  commentObj.likesCount = 0;
  commentObj.likes = 0;
  commentObj.isLiked = false;

  return res.status(201).json(new ApiResponse(201, commentObj, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    throw new ApiError(400, "Content cannot be empty");
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (!req.user || comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to update this comment");
  }

  comment.content = content.trim();
  await comment.save();

  const populated = await Comment.findById(comment._id).populate("owner", "username fullName avatar");

  return res.status(200).json(new ApiResponse(200, populated, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (!req.user || comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to delete this comment");
  }

  await Comment.findByIdAndDelete(commentId);
  await Like.deleteMany({ comment: commentId });

  return res.status(200).json(new ApiResponse(200, { commentId }, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
