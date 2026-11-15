import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateSignedStreamUrl, verifyStreamSignature } from "../utils/mediaSecurity.js";

const getSignedStreamUrl = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (!req.user?._id) {
        throw new ApiError(401, "Authentication required to generate signed stream URLs");
    }

    const userId = req.user._id.toString();

    // If video is unpublished, only its owner can generate signed stream URLs
    if (!video.isPublished && video.owner?.toString() !== userId) {
        throw new ApiError(403, "Access denied: You do not have permission to generate stream URLs for this video");
    }

    const rawExpiresIn = req.query.expiresIn ?? 3600;
    const parsedExpiresIn = Number(rawExpiresIn);

    if (isNaN(parsedExpiresIn) || !Number.isInteger(parsedExpiresIn)) {
        throw new ApiError(400, "Invalid expiresIn parameter. Must be an integer.");
    }

    const clampedExpiresIn = Math.min(Math.max(parsedExpiresIn, 60), 86400);

    const signedData = generateSignedStreamUrl(videoId, userId, clampedExpiresIn);

    return res
        .status(200)
        .json(new ApiResponse(200, signedData, "Signed stream URL generated"));
});

const streamVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { expires, signature, user } = req.query;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Verify signature if provided
    let verifiedSignatureUserId = null;
    if (signature) {
        const auth = verifyStreamSignature(videoId, expires, signature, user || "public");
        if (!auth.valid) {
            throw new ApiError(403, `Access denied: ${auth.reason}`);
        }
        verifiedSignatureUserId = user || "public";
    }

    // When ENFORCE_SIGNED_STREAMS is enabled, require signature for all streams
    if (process.env.ENFORCE_SIGNED_STREAMS === "true" && !signature) {
        throw new ApiError(403, "Access denied: Signed stream URL is required");
    }

    // Unpublished videos require either a valid signature for the owner or the owner's JWT
    if (!video.isPublished) {
        const ownerId = video.owner?.toString();
        let hasValidOwnerAuth = false;

        if (verifiedSignatureUserId && verifiedSignatureUserId === ownerId) {
            hasValidOwnerAuth = true;
        }

        if (!hasValidOwnerAuth) {
            let requestingUserId = req.user?._id?.toString() || null;

            if (!requestingUserId) {
                const authHeader =
                    typeof req.header === "function"
                        ? req.header("Authorization")
                        : (req.headers?.authorization || req.headers?.Authorization);

                const token =
                    req.cookies?.accessToken ||
                    authHeader?.replace(/^Bearer\s+/i, "") ||
                    req.query?.token;

                if (token) {
                    try {
                        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                        requestingUserId = decoded?._id?.toString();
                    } catch {
                        // Invalid/expired token
                    }
                }
            }

            if (requestingUserId && requestingUserId === ownerId) {
                hasValidOwnerAuth = true;
            }
        }

        if (!hasValidOwnerAuth) {
            throw new ApiError(403, "Access denied: Unpublished videos can only be streamed by their owner");
        }
    }

    const range = req.headers.range;

    // Stream from local storage
    let localFilePath = video.localPath;
    if (localFilePath && !fs.existsSync(localFilePath)) {
        const uploadDir = path.resolve(process.env.UPLOAD_DIR || "storage/uploads/resumable");
        const altPath = path.join(uploadDir, path.basename(localFilePath));
        if (fs.existsSync(altPath)) {
            localFilePath = altPath;
        }
    }

    if (localFilePath && fs.existsSync(localFilePath)) {
        const filePath = path.resolve(localFilePath);
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;

        if (!range) {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": video.mimeType || "video/mp4",
                "Accept-Ranges": "bytes",
            });
            fs.createReadStream(filePath).pipe(res);
            return;
        }

        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const CHUNK_SIZE = 1 * 1024 * 1024;
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

        if (start >= fileSize || end >= fileSize || start > end) {
            res.status(416).set({
                "Content-Range": `bytes */${fileSize}`,
            });
            return res.end();
        }

        const contentLength = (end - start) + 1;
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            "Content-Type": video.mimeType || "video/mp4",
        });

        const videoStream = fs.createReadStream(filePath, { start, end });
        videoStream.pipe(res);

        videoStream.on("error", (error) => {
            console.error("Stream error:", error);
            if (!res.headersSent) {
                res.status(500).send("Streaming failed");
            }
        });
        return;
    }

    // Stream from remote URL if available
    if (video.videoFile && (video.videoFile.startsWith("http://") || video.videoFile.startsWith("https://"))) {
        try {
            const upstreamHeaders = {};
            if (range) {
                upstreamHeaders["Range"] = range;
            }

            const upstreamResponse = await fetch(video.videoFile, {
                headers: upstreamHeaders,
            });

            res.status(upstreamResponse.status);
            const contentRange = upstreamResponse.headers.get("content-range");
            const contentLength = upstreamResponse.headers.get("content-length");
            const contentType = upstreamResponse.headers.get("content-type");

            if (contentRange) res.set("Content-Range", contentRange);
            if (contentLength) res.set("Content-Length", contentLength);
            res.set({
                "Content-Type": contentType || "video/mp4",
                "Accept-Ranges": "bytes",
            });

            const { Readable } = await import("stream");
            Readable.fromWeb(upstreamResponse.body).pipe(res);
            return;
        } catch {
            return res.redirect(302, video.videoFile);
        }
    }

    throw new ApiError(404, "No video source available");
});

export { streamVideo, getSignedStreamUrl };
