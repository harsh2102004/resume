import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { setupTestEnvironment, createTestUser, createTestVideo } from "../../tests/helpers/setup.js";

function getPercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function getAverage(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

async function runStreamBenchmark() {
    console.log("=== PulseCast HTTP 206 Streaming Benchmark ===");
    console.log("Setting up in-memory database and test server...");

    const testEnv = await setupTestEnvironment();
    const storageDir = path.resolve("storage");
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    const test50MbPath = path.resolve("storage/bench-50mb.mp4");
    const fileSize = 50 * 1024 * 1024; // 50 MB
    const chunkSize = 1 * 1024 * 1024; // 1 MB chunk

    console.log(`Creating 50 MB local test media file (${test50MbPath})...`);
    const oneMbBuffer = Buffer.alloc(1024 * 1024, "P");
    const writeStream = fs.createWriteStream(test50MbPath);
    for (let i = 0; i < 50; i++) {
        writeStream.write(oneMbBuffer);
    }
    await new Promise((resolve) => writeStream.end(resolve));
    console.log("File created successfully.\n");

    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, {
        localPath: test50MbPath,
        fileSize,
        isPublished: true,
    });

    const streamUrl = `${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`;

    // 1. Sequential Benchmark (100 requests)
    console.log("Running 100 sequential 1 MB range requests...");
    const seqTtfb = [];
    const seqThroughput = [];

    for (let i = 0; i < 100; i++) {
        const offset = (i * chunkSize) % (49 * chunkSize);
        const rangeHeader = `bytes=${offset}-${offset + chunkSize - 1}`;

        const t0 = performance.now();
        const res = await fetch(streamUrl, {
            headers: { Range: rangeHeader },
        });

        const ttfb = performance.now() - t0;
        const bodyBuf = await res.arrayBuffer();
        const tTotal = performance.now() - t0;

        const durationSec = tTotal / 1000;
        const throughputMBs = (bodyBuf.byteLength / (1024 * 1024)) / durationSec;

        seqTtfb.push(ttfb);
        seqThroughput.push(throughputMBs);
    }

    // 2. Concurrent Benchmark (20 concurrent requests)
    console.log("Running 20 concurrent 1 MB range requests...");
    const concPromises = Array.from({ length: 20 }, async (_, i) => {
        const offset = (i * 2 * chunkSize) % (49 * chunkSize);
        const rangeHeader = `bytes=${offset}-${offset + chunkSize - 1}`;

        const t0 = performance.now();
        const res = await fetch(streamUrl, {
            headers: { Range: rangeHeader },
        });

        const ttfb = performance.now() - t0;
        const bodyBuf = await res.arrayBuffer();
        const tTotal = performance.now() - t0;

        const durationSec = tTotal / 1000;
        const throughputMBs = (bodyBuf.byteLength / (1024 * 1024)) / durationSec;

        return { ttfb, throughputMBs };
    });

    const concResults = await Promise.all(concPromises);
    const concTtfb = concResults.map((r) => r.ttfb);
    const concThroughput = concResults.map((r) => r.throughputMBs);

    // Format & Print Results
    console.log("\n--- Streaming Benchmark Results ---");
    console.log("100 Sequential 1 MB Range Requests:");
    console.log(`  TTFB:       Avg: ${getAverage(seqTtfb).toFixed(2)} ms | p50: ${getPercentile(seqTtfb, 50).toFixed(2)} ms | p95: ${getPercentile(seqTtfb, 95).toFixed(2)} ms`);
    console.log(`  Throughput: Avg: ${getAverage(seqThroughput).toFixed(2)} MB/s | p50: ${getPercentile(seqThroughput, 50).toFixed(2)} MB/s | p95: ${getPercentile(seqThroughput, 95).toFixed(2)} MB/s`);

    console.log("\n20 Concurrent 1 MB Range Requests:");
    console.log(`  TTFB:       Avg: ${getAverage(concTtfb).toFixed(2)} ms | p50: ${getPercentile(concTtfb, 50).toFixed(2)} ms | p95: ${getPercentile(concTtfb, 95).toFixed(2)} ms`);
    console.log(`  Throughput: Avg: ${getAverage(concThroughput).toFixed(2)} MB/s | p50: ${getPercentile(concThroughput, 50).toFixed(2)} MB/s | p95: ${getPercentile(concThroughput, 95).toFixed(2)} MB/s`);
    console.log("-----------------------------------\n");

    // Cleanup
    if (fs.existsSync(test50MbPath)) {
        fs.unlinkSync(test50MbPath);
    }
    await testEnv.teardown();
}

runStreamBenchmark().catch((err) => {
    console.error("Stream benchmark failed:", err);
    process.exit(1);
});

