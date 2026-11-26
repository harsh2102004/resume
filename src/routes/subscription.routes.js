/**
 * @file src/routes/subscription.routes.js
 * @description Express router for /api/v1/subscriptions endpoints.
 */

import { Router } from "express";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Publicly get subscribers of a channel; toggle requires auth
router.route("/c/:channelId").get(getUserChannelSubscribers).post(verifyJWT, toggleSubscription);

// Get channels a user subscribed to
router.route("/u/:subscriberId").get(getSubscribedChannels);

export default router;