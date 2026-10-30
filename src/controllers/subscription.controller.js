import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    // Return mock success for demo channels
    return res.status(200).json(
      new ApiResponse(200, { isSubscribed: true }, "Subscription toggled successfully")
    );
  }

  const subscriberId = req.user?._id;
  if (!subscriberId) {
    throw new ApiError(401, "Authentication required to subscribe");
  }

  const existingSub = await Subscription.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });

  if (existingSub) {
    await Subscription.findByIdAndDelete(existingSub._id);
    return res.status(200).json(
      new ApiResponse(200, { isSubscribed: false }, "Unsubscribed successfully")
    );
  }

  const newSub = await Subscription.create({
    subscriber: subscriberId,
    channel: channelId,
  });

  return res.status(201).json(
    new ApiResponse(201, { isSubscribed: true, subscription: newSub }, "Subscribed successfully")
  );
});

// Controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    return res.status(200).json(
      new ApiResponse(200, { subscribers: [], count: 14200 }, "Subscribers fetched successfully")
    );
  }

  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
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
        subscriber: { $first: "$subscriber" },
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { subscribers, count: subscribers.length },
      "Subscribers fetched successfully"
    )
  );
});

// Controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    return res.status(200).json(
      new ApiResponse(200, { channels: [], count: 0 }, "Channels fetched successfully")
    );
  }

  const channels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
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
        channel: { $first: "$channel" },
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { channels, count: channels.length },
      "Subscribed channels fetched successfully"
    )
  );
});

export {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
};