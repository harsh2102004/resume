import test from "node:test";
import assert from "node:assert/strict";
import http from "http";
import fs from "fs";
import path from "path";
import { app } from "../src/app.js";
import { generateSignedStreamUrl, verifyStreamSignature } from "../src/utils/mediaSecurity.js";

const TEST_PORT = 9876;
let server;

test.before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

test("GET /api/v1/healthcheck should return 200 OK", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/healthcheck`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
});

test("TUS Protocol: OPTIONS discovery should declare TUS capabilities", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "OPTIONS",
    });
    assert.equal(res.status, 204);
});

test("TUS Protocol: POST should create a resumable upload session", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
        },
    });

    assert.equal(res.status, 201);
    const location = res.headers.get("Location");
    assert.ok(location, "Expected Location header for resumable upload");
});

test("Media Security: Signed stream URL generation & verification", () => {
    const videoId = "64f1a2b3c4d5e6f7a8b9c0d1";
    const userId = "64f1a2b3c4d5e6f7a8b9c0d2";

    const signed = generateSignedStreamUrl(videoId, userId, 300);
    assert.ok(signed.streamUrl.includes(videoId));
    assert.ok(signed.signature);

    const validCheck = verifyStreamSignature(videoId, signed.expires, signed.signature, userId);
    assert.equal(validCheck.valid, true);

    const tamperedCheck = verifyStreamSignature(videoId, signed.expires, "bad_signature_hash_123456", userId);
    assert.equal(tamperedCheck.valid, false);

    const expiredCheck = verifyStreamSignature(videoId, Math.floor(Date.now() / 1000) - 60, signed.signature, userId);
    assert.equal(expiredCheck.valid, false);
});

test("Media Security: Tampered signature returns HTTP 403 Forbidden", async () => {
    const videoId = "64f1a2b3c4d5e6f7a8b9c0d1";
    const fakeSignature = "deadbeef1234567890abcdefdeadbeef1234567890abcdefdeadbeef12345678";
    const res = await fetch(
        `http://localhost:${TEST_PORT}/api/v1/videos/stream/${videoId}?expires=${Date.now()}&signature=${fakeSignature}`
    );
    assert.equal(res.status, 403);
});

test("HTTP 206 Streaming: Should return 400 for invalid video ObjectId format", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/videos/stream/non-existent-id`);
    assert.equal(res.status, 400);
});
