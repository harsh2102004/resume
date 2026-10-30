import path from "path";
import fs from "fs";
import { Server, EVENTS } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { Video } from "../models/video.model.js";
import { transcodeVideoJob } from "../workers/transcode.worker.js";
import { generateStoryboardJob } from "../workers/storyboard.worker.js";

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

        video.videoFile = `/api/v1/videos/stream/${video._id}`;
        await video.save();

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
