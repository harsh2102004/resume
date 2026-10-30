import path from "path";
import fs from "fs";
import { Server, EVENTS } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { Video } from "../models/video.model.js";
import { transcodeVideoJob } from "../workers/transcode.worker.js";
import { generateStoryboardJob } from "../workers/storyboard.worker.js";

// Ensure destination directory exists
const resumableUploadDir = path.resolve("public/uploads/resumable");
if (!fs.existsSync(resumableUploadDir)) {
    fs.mkdirSync(resumableUploadDir, { recursive: true });
}

/**
 * TUS Open Protocol Resumable Upload Server
 * Enables chunked, offset-tracked, fault-tolerant video uploads.
 */
export const tusServer = new Server({
    path: "/api/v1/videos/resumable-upload",
    datastore: new FileStore({
        directory: resumableUploadDir,
    }),
    respectForwardedHeaders: true,
});

// Event: Upload completed
tusServer.on(EVENTS.POST_FINISH, async (req, res, upload) => {
    try {
        console.log(`[TUS] Resumable upload finished: ${upload.id} (${upload.size} bytes)`);

        const metadata = upload.metadata || {};
        const title = metadata.title || metadata.filename || `Video-${upload.id.substring(0, 8)}`;
        const description = metadata.description || "Uploaded via TUS Resumable Protocol";
        const userId = metadata.userId || null;
        const mimeType = metadata.filetype || "video/mp4";

        // TUS stores files by their upload.id in the directory
        const storedFilePath = path.join(resumableUploadDir, upload.id);

        const video = await Video.create({
            title,
            description,
            videoFile: `/api/v1/videos/stream/temp`,
            localPath: storedFilePath,
            thumbnail: metadata.thumbnail || "/images/default-thumbnail.jpg",
            fileSize: upload.size,
            mimeType,
            owner: userId,
            isPublished: true,
        });

        // Set streaming route to native HTTP 206 stream
        video.videoFile = `/api/v1/videos/stream/${video._id}`;
        await video.save();

        console.log(`[TUS] Video indexed in database: ${video._id}`);

        // Trigger background HLS adaptive bitrate transcoding & storyboard generator
        transcodeVideoJob(video._id, storedFilePath).catch((err) => {
            console.error("[TUS] Background HLS transcode error:", err);
        });
        generateStoryboardJob(video._id, storedFilePath).catch((err) => {
            console.error("[TUS] Background storyboard generation error:", err);
        });
    } catch (error) {
        console.error("[TUS] Error processing completed upload:", error);
    }
});

// Event: Upload started
tusServer.on(EVENTS.POST_CREATE, (req, res, upload) => {
    console.log(`[TUS] Upload created: ${upload.id}, expected size: ${upload.size || "unknown"} bytes`);
});
