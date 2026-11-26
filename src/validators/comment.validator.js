/**
 * @file src/validators/comment.validator.js
 * @description Zod validation schemas for creating and updating comments.
 */

import { z } from "zod";

export const commentSchema = z.object({
    content: z.string().min(1, "Comment content cannot be empty"),
});

