import path from "path";
import fs from "fs";
import { Server, EVENTS } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { Video } from "../models/video.model.js";
import { transcodeVideoJob } from "../workers/transcode.worker.js";
import { generateStoryboardJob } from "../workers/storyboard.worker.js";
import { uploadVideoOnCloudinary } from "../utils/cloudinary.js";

const resumableUploadDir = path.resolve("public/uploads/resumable");
if (!fs.existsSync(resumableUploadDir)) {
    fs.mkdirSync(resumableUploadDir, { recursive: true });
}

export const tusServer = new Server({
    path: "/api/v1/videos/resumable-upload",
    datastore: new FileStore({
        directory: resumableUploadDir,
    }),
    respectForwardedHeaders: true,
});

tusServer.on(EVENTS.POST_FINISH, async (req, res, upload) => {
    try {
        const metadata = upload.metadata || {};
        const title = metadata.title || metadata.filename || `Video-${upload.id.substring(0, 8)}`;
        const description = metadata.description || "";
        const userId = metadata.userId || null;
        const mimeType = metadata.filetype || "video/mp4";

        const storedFilePath = path.join(resumableUploadDir, upload.id);

        let videoUrl = `/api/v1/videos/stream/temp`;
        let thumbnailUrl = metadata.thumbnail || "/images/default-thumbnail.jpg";
        let duration = 0;

        // Upload to Cloudinary so video is saved in Cloudinary dashboard and served via CDN
        try {
            console.log(`[TUS] Upload finished for ${upload.id}. Uploading to Cloudinary...`);
            const cloudUpload = await uploadVideoOnCloudinary(storedFilePath);
            if (cloudUpload?.secure_url) {
                console.log(`[TUS] Successfully uploaded to Cloudinary: ${cloudUpload.secure_url}`);
                videoUrl = cloudUpload.secure_url;
                // Cloudinary generates an image poster automatically by replacing the extension with .jpg
                if (!metadata.thumbnail || metadata.thumbnail.startsWith("/images/")) {
                    thumbnailUrl = cloudUpload.secure_url.replace(/\.[^/.]+$/, ".jpg");
                }
                if (cloudUpload.duration) {
                    duration = Math.round(cloudUpload.duration);
                }
            } else {
                console.warn("[TUS] Cloudinary upload returned no secure_url, using local streaming fallback.");
            }
        } catch (cloudErr) {
            console.error("[TUS] Cloudinary upload error in POST_FINISH:", cloudErr);
        }

        const video = await Video.create({
            title,
            description,
            videoFile: videoUrl,
            localPath: storedFilePath,
            thumbnail: thumbnailUrl,
            duration,
            fileSize: upload.size,
            mimeType,
            owner: userId,
            isPublished: true,
        });

        if (video.videoFile === `/api/v1/videos/stream/temp`) {
            video.videoFile = `/api/v1/videos/stream/${video._id}`;
            await video.save();
        }

        transcodeVideoJob(video._id, storedFilePath).catch((err) => {
            console.error("Transcode error:", err);
        });
        generateStoryboardJob(video._id, storedFilePath).catch((err) => {
            console.error("Storyboard error:", err);
        });
    } catch (error) {
        console.error("Upload finish error:", error);
    }
});
