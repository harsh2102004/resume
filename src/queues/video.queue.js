import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let connection;
try {
    connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: () => null,
        lazyConnect: true,
    });
    connection.on("error", () => {});
} catch {
    // Fallback if Redis configuration fails
}

export const videoQueue = new Queue("video-processing", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

videoQueue.on("error", () => {});

export const addVideoProcessingJob = async (videoId, inputFilePath) => {
    try {
        return await videoQueue.add(
            "process-video",
            { videoId: String(videoId), inputFilePath },
            {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
            }
        );
    } catch (err) {
        console.warn(`[Queue] Failed to enqueue job for video ${videoId}:`, err?.message || err);
        return null;
    }
};
