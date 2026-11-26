import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import mongoose from "mongoose";
import { setupTestEnvironment } from "./helpers/setup.js";
import { Video } from "../src/models/video.model.js";
import { transcodeVideoJob } from "../src/workers/transcode.worker.js";

let testEnv;

test.before(async () => {
    testEnv = await setupTestEnvironment();
});

test.after(async () => {
    await testEnv.teardown();
});

test.beforeEach(async () => {
    await testEnv.clearDb();
});

test("Transcode: FFmpeg generates ABR HLS (360p/720p master.m3u8) and Storyboard (VTT + sprites) served by Express", async () => {
    const prevCloud = {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    };
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const tmpDir = path.resolve("storage/tmp-transcode-test");
    fs.mkdirSync(tmpDir, { recursive: true });
    const testMp4 = path.join(tmpDir, "sample.mp4");

    let videoId;
    try {
        execFileSync(
            ffmpegInstaller.path,
            [
                "-y",
                "-f", "lavfi", "-i", "testsrc=duration=6:size=1280x720:rate=24",
                "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
                "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-shortest",
                testMp4,
            ],
            { stdio: "pipe" }
        );

        const video = await Video.create({
            title: "FFmpeg ABR & Storyboard Test",
            description: "Integration test video",
            videoFile: "/api/v1/videos/stream/temp",
            localPath: testMp4,
            thumbnail: "/images/default-thumbnail.jpg",
            owner: new mongoose.Types.ObjectId(),
            isPublished: true,
        });
        videoId = String(video._id);

        const result = await transcodeVideoJob(video._id, testMp4);
        assert.deepEqual(result.qualities, ["360p", "720p"]);
        assert.ok(result.hlsPath.endsWith("master.m3u8"));
        assert.ok(result.storyboardVtt.endsWith("storyboard.vtt"));

        const updated = await Video.findById(video._id);
        assert.equal(updated.transcodingStatus, "COMPLETED");
        assert.equal(updated.transcodeProgress, 100);
        assert.deepEqual(updated.qualities, ["360p", "720p"]);

        // Verify local static serving for HLS master.m3u8, 360p.m3u8, 720p.m3u8
        const masterRes = await fetch(`${testEnv.baseUrl}/uploads/hls/${videoId}/master.m3u8`);
        assert.equal(masterRes.status, 200);
        const masterText = await masterRes.text();
        assert.match(masterText, /#EXTM3U/);
        assert.match(masterText, /RESOLUTION=640x360/);
        assert.match(masterText, /RESOLUTION=1280x720/);
        assert.match(masterText, /360p\.m3u8/);
        assert.match(masterText, /720p\.m3u8/);

        // Verify Storyboard VTT and sprite sheet serving
        const vttRes = await fetch(`${testEnv.baseUrl}/uploads/storyboards/${videoId}/storyboard.vtt`);
        assert.equal(vttRes.status, 200);
        const vttText = await vttRes.text();
        assert.match(vttText, /^WEBVTT/);
        assert.match(vttText, /sprite_001\.jpg#xywh=0,0,160,90/);

        const spriteRes = await fetch(`${testEnv.baseUrl}/uploads/storyboards/${videoId}/sprite_001.jpg`);
        assert.equal(spriteRes.status, 200);
    } finally {
        for (const [k, v] of Object.entries(prevCloud)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
        if (videoId) {
            fs.rmSync(path.resolve("public/uploads/hls", videoId), { recursive: true, force: true });
            fs.rmSync(path.resolve("public/uploads/storyboards", videoId), { recursive: true, force: true });
        }
    }
});
