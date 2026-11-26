/**
 * @file src/validators/video.validator.js
 * @description Zod validation schemas for updating video metadata.
 */

import { z } from "zod";

export const updateVideoSchema = z
    .object({
        title: z.string().min(1, "Title cannot be empty").optional(),
        description: z.string().optional(),
    })
    .refine((data) => data.title !== undefined || data.description !== undefined, {
        message: "At least one of title or description must be provided",
        path: ["title"],
    });

