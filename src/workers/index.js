import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import connectDB from "../db/index.js";
import { transcodeVideoJob } from "./transcode.worker.js";
import { Video } from "../models/video.model.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

connection.on("error", (err) => {
    console.error("[Worker] Redis connection error:", err?.message || err);
});

// Create BullMQ Worker with concurrency 2
export const videoWorker = new Worker(
    "video-processing",
    async (job) => {
        const { videoId, inputFilePath } = job.data;
        console.log(
            `[Worker] Processing video ${videoId} (Attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3})`
        );
        return await transcodeVideoJob(videoId, inputFilePath);
    },
    {
        connection,
        concurrency: 2,
    }
);

videoWorker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} for video ${job.data?.videoId} COMPLETED.`);
});

videoWorker.on("failed", async (job, err) => {
    console.error(`[Worker] Job ${job?.id} for video ${job?.data?.videoId} FAILED:`, err?.message || err);
    if (job?.data?.videoId) {
        try {
            await Video.findByIdAndUpdate(job.data.videoId, {
                transcodingStatus: "FAILED",
            });
        } catch (dbErr) {
            console.error("[Worker] Error setting FAILED status in DB:", dbErr?.message || dbErr);
        }
    }
});

// Standalone worker process connects to MongoDB itself
connectDB()
    .then(() => {
        console.log(
            "[Worker] Connected to MongoDB. Listening for video-processing jobs (concurrency: 2)..."
        );
    })
    .catch((err) => {
        console.error("[Worker] MongoDB connection failed:", err);
        process.exit(1);
    });

