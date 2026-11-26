/**
 * @file src/validators/validate.middleware.js
 * @description Express middleware that validates req.body against a Zod schema and forwards ApiError(400) on failure.
 */

import { ApiError } from "../utils/ApiError.js";

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On success it replaces req.body with the parsed (coerced/stripped) value.
 * On failure it forwards an ApiError(400) with a readable message.
 * Compatible with both Zod v3 (error.errors) and Zod v4 (error.issues).
 */
export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        // Zod v4 uses .issues; Zod v3 uses .errors – support both
        const issues = result.error.issues ?? result.error.errors ?? [];
        const msg = issues
            .map((e) => `${e.path.join(".") || "body"}: ${e.message}`)
            .join("; ");
        return next(new ApiError(400, msg || "Validation failed"));
    }
    req.body = result.data;
    next();
};
