import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { setupTestEnvironment, createTestUser, createTestVideo } from "./helpers/setup.js";
import { generateSignedStreamUrl } from "../src/utils/mediaSecurity.js";

let testEnv;
const testStreamFilePath = path.resolve("storage/test-stream-file-200.mp4");

test.before(async () => {
    testEnv = await setupTestEnvironment();
    if (!fs.existsSync(path.dirname(testStreamFilePath))) {
        fs.mkdirSync(path.dirname(testStreamFilePath), { recursive: true });
    }
    fs.writeFileSync(testStreamFilePath, Buffer.alloc(200, "a"));
});

test.after(async () => {
    if (fs.existsSync(testStreamFilePath)) {
        fs.unlinkSync(testStreamFilePath);
    }
    await testEnv.teardown();
});

test.beforeEach(async () => {
    await testEnv.clearDb();
});

// ─── Signed URL Stream Access Tests ───────────────────────────────────────────

test("Streaming: GET /sign-stream/:videoId without login returns 401 Unauthorized", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/sign-stream/${video._id}`);
    assert.equal(res.status, 401);
});

test("Streaming: GET /sign-stream/:videoId with invalid expiresIn returns 400 Bad Request", async () => {
    const { user, authHeaders } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/sign-stream/${video._id}?expiresIn=invalid`, {
        headers: authHeaders,
    });
    assert.equal(res.status, 400);
});

test("Streaming: Valid signed stream URL allows streaming video", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const signed = generateSignedStreamUrl(video._id.toString(), user._id.toString(), 300);
    const res = await fetch(`${testEnv.baseUrl}${signed.streamUrl}`);
    assert.equal(res.status, 200);
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 200);
});

test("Streaming: Expired signature returns 403 Forbidden", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const expired = generateSignedStreamUrl(video._id.toString(), user._id.toString(), -100);
    const res = await fetch(`${testEnv.baseUrl}${expired.streamUrl}`);
    assert.equal(res.status, 403);
});

test("Streaming: Tampered signature returns 403 Forbidden", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const signed = generateSignedStreamUrl(video._id.toString(), user._id.toString(), 300);
    const tampered = signed.signature.slice(0, -4) + "0000";
    const res = await fetch(
        `${testEnv.baseUrl}/api/v1/videos/stream/${video._id}?expires=${signed.expires}&signature=${tampered}&user=${user._id}`
    );
    assert.equal(res.status, 403);
});

test("Streaming: Unpublished video stream is rejected with 403 for non-owner", async () => {
    const owner = await createTestUser({ username: "streamowner", email: "streamowner@example.com" });
    const nonOwner = await createTestUser({ username: "otherstreamer", email: "otherstreamer@example.com" });
    const video = await createTestVideo(owner.user._id, { isPublished: false, localPath: testStreamFilePath });

    const nonOwnerSigned = generateSignedStreamUrl(video._id.toString(), nonOwner.user._id.toString(), 300);
    const res = await fetch(`${testEnv.baseUrl}${nonOwnerSigned.streamUrl}`);
    assert.equal(res.status, 403);
});

// ─── HTTP Range Streaming Tests ───────────────────────────────────────────────

test("Streaming: Full request without Range header returns 200 and full content", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.equal(res.headers.get("content-length"), "200");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 200);
});

test("Streaming: Range bytes=0-99 returns 206 with correct Content-Range and length", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`, {
        headers: { Range: "bytes=0-99" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 0-99/200");
    assert.equal(res.headers.get("content-length"), "100");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 100);
});

test("Streaming: Range bytes=100- returns 206 from offset to end of file", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`, {
        headers: { Range: "bytes=100-" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 100-199/200");
    assert.equal(res.headers.get("content-length"), "100");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 100);
});

test("Streaming: Suffix range bytes=-50 returns 206 for last 50 bytes", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`, {
        headers: { Range: "bytes=-50" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 150-199/200");
    assert.equal(res.headers.get("content-length"), "50");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 50);
});

test("Streaming: End beyond file bytes=150-500 clamps to fileSize - 1 with 206", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`, {
        headers: { Range: "bytes=150-500" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 150-199/200");
    assert.equal(res.headers.get("content-length"), "50");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 50);
});

test("Streaming: Start beyond file returns 416 with Content-Range bytes */size", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`, {
        headers: { Range: "bytes=300-" },
    });
    assert.equal(res.status, 416);
    assert.equal(res.headers.get("content-range"), "bytes */200");
});

test("Streaming: Garbage header is handled safely", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { localPath: testStreamFilePath });

    // Non-bytes garbage header is ignored, returning 200 full file
    const res1 = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`, {
        headers: { Range: "garbage-header-value" },
    });
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get("content-length"), "200");

    // Malformed bytes range with NaN start returns 416
    const res2 = await fetch(`${testEnv.baseUrl}/api/v1/videos/stream/${video._id}`, {
        headers: { Range: "bytes=invalid-range" },
    });
    assert.equal(res2.status, 416);
    assert.equal(res2.headers.get("content-range"), "bytes */200");
});

