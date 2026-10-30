import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  // 1. Total subscribers
  const totalSubscribers = await Subscription.countDocuments({
    channel: userId,
  });

  // 2. Video statistics (total videos, total views)
  const videoStats = await Video.aggregate([
    {
      $match: {
        owner: userId,
      },
    },
    {
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalViews: { $sum: "$views" },
      },
    },
  ]);

  const totalVideos = videoStats[0]?.totalVideos || 0;
  const totalViews = videoStats[0]?.totalViews || 0;

  // 3. Total likes on all videos owned by this channel
  const likeStats = await Like.aggregate([
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videoDetails",
      },
    },
    {
      $unwind: "$videoDetails",
    },
    {
      $match: {
        "videoDetails.owner": userId,
      },
    },
    {
      $count: "totalLikes",
    },
  ]);

  const totalLikes = likeStats[0]?.totalLikes || 0;

  const stats = {
    totalSubscribers,
    totalVideos,
    totalViews,
    totalLikes,
  };

  return res.status(200).json(
    new ApiResponse(200, stats, "Channel statistics fetched successfully")
  );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const { page = 1, limit = 20 } = req.query;

  const videos = await Video.aggregate([
    {
      $match: {
        owner: userId,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
      },
    },
    {
      $project: {
        likes: 0,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    },
    {
      $limit: parseInt(limit, 10),
    },
  ]);

  const totalVideos = await Video.countDocuments({ owner: userId });

  return res.status(200).json(
    new ApiResponse(
      200,
      { docs: videos, totalDocs: totalVideos, page: parseInt(page, 10), limit: parseInt(limit, 10) },
      "Channel videos fetched successfully"
    )
  );
});

export { getChannelStats, getChannelVideos };