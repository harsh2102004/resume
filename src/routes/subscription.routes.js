import { Router } from "express";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";

const router = Router();

// Publicly get subscribers of a channel
router.route("/c/:channelId").get(getUserChannelSubscribers).post(toggleSubscription);

// Get channels a user subscribed to
router.route("/u/:subscriberId").get(getSubscribedChannels);

export default router;