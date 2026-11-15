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

        // Parse range header safely
        let rangeParsed = null;
        if (range) {
            if (typeof range === "string" && range.startsWith("bytes=")) {
                const rangeSpec = range.replace(/^bytes=/, "").trim();
                const parts = rangeSpec.split("-");
                if (parts.length === 2) {
                    const [startStr, endStr] = parts;

                    if (startStr === "") {
                        // Suffix range: bytes=-N
                        const suffixLength = parseInt(endStr, 10);
                        if (isNaN(suffixLength) || suffixLength <= 0) {
                            rangeParsed = { error: 416 };
                        } else {
                            const start = Math.max(0, fileSize - suffixLength);
                            const end = fileSize - 1;
                            rangeParsed = { start, end };
                        }
                    } else {
                        // Range: bytes=start- or bytes=start-end
                        const start = parseInt(startStr, 10);
                        if (isNaN(start) || start < 0 || start >= fileSize) {
                            rangeParsed = { error: 416 };
                        } else {
                            let end;
                            if (endStr === "") {
                                end = fileSize - 1;
                            } else {
                                end = parseInt(endStr, 10);
                                if (isNaN(end) || end < start) {
                                    rangeParsed = { error: 416 };
                                } else if (end >= fileSize) {
                                    // If end is past the file, CLAMP it to fileSize - 1 (do not return 416)
                                    end = fileSize - 1;
                                }
                            }
                            if (!rangeParsed) {
                                rangeParsed = { start, end };
                            }
                        }
                    }
                } else {
                    rangeParsed = { error: 416 };
                }
            } else {
                // Malformed / non-bytes range header: ignore and serve full representation
                rangeParsed = null;
            }
        }

        if (rangeParsed && rangeParsed.error === 416) {
            res.status(416).set({
                "Content-Range": `bytes */${fileSize}`,
            });
            return res.end();
        }

        if (!rangeParsed) {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": video.mimeType || "video/mp4",
                "Accept-Ranges": "bytes",
            });
            const fullStream = fs.createReadStream(filePath);
            res.on("close", () => {
                fullStream.destroy();
            });
            fullStream.on("error", (error) => {
                console.error("Stream error:", error);
                if (!res.headersSent) {
                    res.status(500).send("Streaming failed");
                }
            });
            fullStream.pipe(res);
            return;
        }

        const { start, end } = rangeParsed;
        const contentLength = (end - start) + 1;
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            "Content-Type": video.mimeType || "video/mp4",
        });

        const videoStream = fs.createReadStream(filePath, { start, end });
        res.on("close", () => {
            videoStream.destroy();
        });
        videoStream.on("error", (error) => {
            console.error("Stream error:", error);
            if (!res.headersSent) {
                res.status(500).send("Streaming failed");
            }
        });
        videoStream.pipe(res);
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
