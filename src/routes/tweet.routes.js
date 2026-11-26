/**
 * @file src/routes/tweet.routes.js
 * @description Express router for /api/v1/tweets endpoints.
 */

import { Router } from 'express';
import {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
} from "../controllers/tweet.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import { validate } from "../validators/validate.middleware.js";
import { tweetSchema } from "../validators/tweet.validator.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").post(validate(tweetSchema), createTweet);
router.route("/user/:userId").get(getUserTweets);
router.route("/:tweetId").patch(validate(tweetSchema), updateTweet).delete(deleteTweet);

export default router