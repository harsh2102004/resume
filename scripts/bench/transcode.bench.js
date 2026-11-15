import path from "path";
import fs from "fs";
import { performance } from "perf_hooks";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Video } from "../../src/models/video.model.js";
import { transcodeVideoJob } from "../../src/workers/transcode.worker.js";

if (ffmpegInstaller?.path) ffmpeg.setFfmpegPath(ffmpegInstaller.path);
if (ffprobeInstaller?.path) ffmpeg.setFfprobePath(ffprobeInstaller.path);

async function runTranscodeBenchmark() {
    console.log("=== PulseCast Transcoding Benchmark ===");
    console.log("Starting in-memory database...");

    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const storageDir = path.resolve("storage");
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    const testClipPath = path.resolve("storage/bench-clip-720p-60s.mp4");

    console.log("Generating 60-second 720p test video clip with FFmpeg (testsrc + sine)...");
    const genStart = performance.now();

    await new Promise((resolve, reject) => {
        ffmpeg()
            .input("testsrc=duration=60:size=1280x720:rate=30")
            .inputFormat("lavfi")
            .input("sine=frequency=1000:duration=60")
            .inputFormat("lavfi")
            .outputOptions([
                "-c:v libx264",
                "-preset veryfast",
                "-pix_fmt yuv420p",
                "-c:a aac",
            ])
            .output(testClipPath)
            .on("end", resolve)
            .on("error", reject)
            .run();
    });

    const genDuration = ((performance.now() - genStart) / 1000).toFixed(2);
    const clipStat = fs.statSync(testClipPath);
    console.log(`Generated clip in ${genDuration}s (${(clipStat.size / (1024 * 1024)).toFixed(2)} MB)`);

    const video = await Video.create({
        title: "Benchmark Video 60s 720p",
        description: "Benchmark video clip",
        videoFile: testClipPath,
        thumbnail: "https://example.com/thumb.jpg",
        duration: 60,
        localPath: testClipPath,
        isPublished: true,
    });

    const profileTimes = {};
    let currentProfileStart = null;
    const origFindByIdAndUpdate = Video.findByIdAndUpdate;

    Video.findByIdAndUpdate = async function (id, update, opts) {
        const now = performance.now();
        if (update.transcodeProgress === 35) {
            currentProfileStart = now;
        } else if (update.transcodeProgress === 60) {
            profileTimes["360p"] = now - currentProfileStart;
            currentProfileStart = now;
        } else if (update.transcodeProgress === 85) {
            profileTimes["720p"] = now - currentProfileStart;
        }
        return origFindByIdAndUpdate.call(Video, id, update, opts);
    };

    console.log("\nRunning real transcodeVideoJob (HLS multi-bitrate + storyboards)...");
    const transcodeStart = performance.now();

    try {
        const result = await transcodeVideoJob(video._id, testClipPath);
        const totalDuration = performance.now() - transcodeStart;

        console.log("\n--- Benchmark Results ---");
        console.log(`Input Clip:       60s 720p @ 30fps (${(clipStat.size / (1024 * 1024)).toFixed(2)} MB)`);
        if (profileTimes["360p"]) {
            console.log(`360p Quality:     ${(profileTimes["360p"] / 1000).toFixed(2)}s (${(60 / (profileTimes["360p"] / 1000)).toFixed(2)}x realtime)`);
        }
        if (profileTimes["720p"]) {
            console.log(`720p Quality:     ${(profileTimes["720p"] / 1000).toFixed(2)}s (${(60 / (profileTimes["720p"] / 1000)).toFixed(2)}x realtime)`);
        }
        console.log(`Total Wall-Clock: ${(totalDuration / 1000).toFixed(2)}s (${(60 / (totalDuration / 1000)).toFixed(2)}x realtime)`);
        console.log(`Generated Qualities: ${result.qualities?.join(", ")}`);
        console.log("-------------------------\n");
    } finally {
        Video.findByIdAndUpdate = origFindByIdAndUpdate;
        // Cleanup
        if (fs.existsSync(testClipPath)) {
            fs.unlinkSync(testClipPath);
        }
        const hlsDir = path.resolve(`public/uploads/hls/${video._id}`);
        if (fs.existsSync(hlsDir)) {
            fs.rmSync(hlsDir, { recursive: true, force: true });
        }
        const storyboardDir = path.resolve(`public/uploads/storyboards/${video._id}`);
        if (fs.existsSync(storyboardDir)) {
            fs.rmSync(storyboardDir, { recursive: true, force: true });
        }
        await mongoose.disconnect();
        await mongod.stop();
    }
}

runTranscodeBenchmark().catch((err) => {
    console.error("Transcode benchmark failed:", err);
    process.exit(1);
});

