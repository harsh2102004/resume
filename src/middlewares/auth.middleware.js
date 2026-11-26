/**
 * @file src/middlewares/auth.middleware.js
 * @description JWT authentication helpers (authenticateRequest, verifyJWT, optionalJWT) reading Bearer headers or accessToken cookies.
 */

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const authenticateRequest = async (req) => {
    const authHeader =
        typeof req.header === "function"
            ? req.header("Authorization")
            : (req.headers?.authorization || req.headers?.Authorization);

    const token =
        req.cookies?.accessToken ||
        authHeader?.replace(/^Bearer\s+/i, "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid Access Token");
        }

        return user;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(401, error?.message || "Invalid access token");
    }
};

export const verifyJWT = asyncHandler(async (req, _, next) => {
    const user = await authenticateRequest(req);
    req.user = user;
    next();
});

export const optionalJWT = asyncHandler(async (req, _, next) => {
    try {
        const user = await authenticateRequest(req);
        req.user = user;
    } catch {
        req.user = null;
    }
    next();
});