import path from "path";
import fs from "fs";
import { Server, EVENTS } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { Video } from "../models/video.model.js";
import { addVideoProcessingJob } from "../queues/video.queue.js";
import { transcodeVideoJob } from "../workers/transcode.worker.js";

const uploadDirEnv = process.env.UPLOAD_DIR || "storage/uploads/resumable";
const resumableUploadDir = path.resolve(uploadDirEnv);
if (!fs.existsSync(resumableUploadDir)) {
    fs.mkdirSync(resumableUploadDir, { recursive: true });
}

export const tusServer = new Server({
    path: "/api/v1/videos/resumable-upload",
    datastore: new FileStore({
        directory: resumableUploadDir,
    }),
    respectForwardedHeaders: true,
    onUploadCreate: async (req, upload) => {
        const rawReq = req.runtime?.node?.req || req.node?.req || req;
        const user = rawReq?.user;
        const userId = user?._id ? user._id.toString() : null;

        if (!userId) {
            throw { status_code: 401, body: "Authentication required" };
        }

        const metadata = { ...(upload.metadata || {}) };
        delete metadata.userId; // Ignore and strip client metadata.userId
        metadata.ownerId = userId; // Attach verified user id on server side

        return { metadata };
    },
});

tusServer.on(EVENTS.POST_FINISH, async (req, res, upload) => {
    try {
        const metadata = upload.metadata || {};
        const title = metadata.title || metadata.filename || `Video-${upload.id.substring(0, 8)}`;
        const description = metadata.description || title || "Uploaded video";
        const rawReq = req?.runtime?.node?.req || req?.node?.req || req;
        const owner = metadata.ownerId || (rawReq?.user?._id ? rawReq.user._id.toString() : null);
        const mimeType = metadata.filetype || "video/mp4";

        const storedFilePath = path.join(resumableUploadDir, upload.id);

        const video = await Video.create({
            title,
            description,
            videoFile: `/api/v1/videos/stream/temp`,
            localPath: storedFilePath,
            thumbnail:
                metadata.thumbnail ||
                "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
            duration: 0,
            fileSize: upload.size || 0,
            mimeType,
            owner,
            isPublished: true,
            transcodingStatus: "PENDING",
            transcodeProgress: 0,
        });

        if (video.videoFile === `/api/v1/videos/stream/temp`) {
            video.videoFile = `/api/v1/videos/stream/${video._id}`;
            await video.save();
        }

        // Add job to background processing queue; fall back to in-process transcoding if Redis is unavailable
        const job = await addVideoProcessingJob(video._id, storedFilePath);
        if (!job) {
            transcodeVideoJob(video._id, storedFilePath).catch((err) => {
                console.error("[TUS] Background fallback transcode error:", err?.message || err);
            });
        }
    } catch (error) {
        console.error("Upload finish error:", error);
    }
});
