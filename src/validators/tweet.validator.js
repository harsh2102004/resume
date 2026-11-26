/**
 * @file src/validators/tweet.validator.js
 * @description Zod validation schemas for creating and updating tweets.
 */

import { z } from "zod";

export const tweetSchema = z.object({
    content: z.string().min(1, "Tweet content cannot be empty"),
});

