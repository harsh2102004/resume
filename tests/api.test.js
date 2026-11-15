import test from "node:test";
import assert from "node:assert/strict";
import http from "http";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import { app } from "../src/app.js";
import { User } from "../src/models/user.model.js";
import { Video } from "../src/models/video.model.js";
import { generateSignedStreamUrl, verifyStreamSignature } from "../src/utils/mediaSecurity.js";

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-token-secret-for-pulsecast-tests";

const testUser = {
    _id: "64f1a2b3c4d5e6f7a8b9c0d2",
    username: "testuser",
    email: "test@example.com",
};

const validToken = jwt.sign({ _id: testUser._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
const fakeToken = "test-auth-token-pulsecast";
const unknownUserToken = jwt.sign({ _id: "64f1a2b3c4d5e6f7a8b9c099" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });

let TEST_PORT;
let server;
let lastCreatedVideo = null;
let originalFindById;
let originalCreate;
let originalVideoFindById;
let originalFindByIdAndUpdate;

const testLocalVideoPath = path.resolve("storage/test-stream-file.mp4");
const mockUnpublishedVideo = {
    _id: "64f1a2b3c4d5e6f7a8b9c0d1",
    title: "Private Video",
    isPublished: false,
    owner: testUser._id,
    localPath: testLocalVideoPath,
    mimeType: "video/mp4",
};

test.before(async () => {
    if (!fs.existsSync(path.dirname(testLocalVideoPath))) {
        fs.mkdirSync(path.dirname(testLocalVideoPath), { recursive: true });
    }
    fs.writeFileSync(testLocalVideoPath, "test-video-content-stream-bytes");

    originalFindById = User.findById;
    User.findById = (id) => ({
        select: (fields) => {
            if (String(id) === String(testUser._id)) {
                return Promise.resolve(testUser);
            }
            return Promise.resolve(null);
        },
    });

    originalVideoFindById = Video.findById;
    Video.findById = (id) => {
        if (String(id) === String(mockUnpublishedVideo._id)) {
            return Promise.resolve(mockUnpublishedVideo);
        }
        return Promise.resolve(null);
    };

    originalCreate = Video.create;
    Video.create = async (doc) => {
        lastCreatedVideo = {
            _id: "64f1a2b3c4d5e6f7a8b9c0d9",
            ...doc,
        };
        return {
            ...lastCreatedVideo,
            save: async function () {
                return this;
            },
        };
    };

    originalFindByIdAndUpdate = Video.findByIdAndUpdate;
    Video.findByIdAndUpdate = async () => ({});

    cloudinary.uploader.upload_large = (filePath, opts, cb) => {
        const result = { secure_url: "https://res.cloudinary.com/demo/video/upload/sample.mp4", duration: 10 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
    };
    cloudinary.uploader.upload = (filePath, opts, cb) => {
        const result = { secure_url: "https://res.cloudinary.com/demo/video/upload/sample.mp4", duration: 10 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
    };

    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            TEST_PORT = server.address().port;
            resolve();
        });
    });
});

test.after(async () => {
    User.findById = originalFindById;
    Video.findById = originalVideoFindById;
    Video.create = originalCreate;
    if (fs.existsSync(testLocalVideoPath)) fs.unlinkSync(testLocalVideoPath);
    await new Promise((resolve) => server.close(resolve));
});

test("GET /api/v1/healthcheck should return 200 OK", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/healthcheck`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
});

test("TUS Protocol: OPTIONS discovery should declare TUS capabilities", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "OPTIONS",
    });
    assert.equal(res.status, 204);
});

test("TUS Protocol: POST should reject unauthenticated uploads (no token) with 401", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
        },
    });

    assert.equal(res.status, 401);
});

test("TUS Protocol: POST should reject uploads with fake token with 401", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
            "Authorization": `Bearer ${fakeToken}`,
        },
    });

    assert.equal(res.status, 401);
});

test("TUS Protocol: POST should reject uploads for unknown user token with 401", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
            "Authorization": `Bearer ${unknownUserToken}`,
        },
    });

    assert.equal(res.status, 401);
});

test("TUS Protocol: POST should create a resumable upload session when authenticated with valid token", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
            "Authorization": `Bearer ${validToken}`,
        },
    });

    assert.equal(res.status, 201);
    const location = res.headers.get("Location");
    assert.ok(location, "Expected Location header for resumable upload");
});

test("TUS Protocol: PATCH should reject writes with fake token with 401", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/resumable-upload/fake-upload-id`, {
        method: "PATCH",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
            "Authorization": `Bearer ${fakeToken}`,
        },
        body: Buffer.from("test"),
    });

    assert.equal(res.status, 401);
});

test("TUS Protocol: Upload completion ignores client userId metadata and sets owner to authenticated user", async () => {
    lastCreatedVideo = null;
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "4",
            "Upload-Metadata": "title bXkgdmlkZW8=,description dGVzdA==,userId YXR0YWNrZXItdXNlci1pZA==",
            "Authorization": `Bearer ${validToken}`,
        },
    });

    assert.equal(res.status, 201);
    const location = res.headers.get("Location");
    assert.ok(location);

    const patchRes = await fetch(location, {
        method: "PATCH",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
            "Authorization": `Bearer ${validToken}`,
        },
        body: Buffer.from("test"),
    });

    assert.equal(patchRes.status, 204);

    for (let i = 0; i < 100; i++) {
        if (lastCreatedVideo) break;
        await new Promise((r) => setTimeout(r, 100));
    }

    assert.ok(lastCreatedVideo, "Video should have been created in database");
    assert.equal(lastCreatedVideo.owner, testUser._id, "Video owner must be the authenticated user");
    assert.notEqual(lastCreatedVideo.owner, "attacker-user-id", "Spoofed userId in metadata must be ignored");
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
        `http://127.0.0.1:${TEST_PORT}/api/v1/videos/stream/${videoId}?expires=${Date.now()}&signature=${fakeSignature}`
    );
    assert.equal(res.status, 403);
});

test("HTTP 206 Streaming: Should return 400 for invalid video ObjectId format", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/stream/non-existent-id`);
    assert.equal(res.status, 400);
});

test("Security: Raw upload file cannot be fetched from public /uploads/resumable route (returns 404)", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/uploads/resumable/test-raw-upload-id`);
    assert.equal(res.status, 404);
});

test("Public Streaming: Processed HLS streams are accessible via /uploads/hls", async () => {
    const testHlsDir = path.resolve("public/uploads/hls/test-stream-fixture");
    if (!fs.existsSync(testHlsDir)) {
        fs.mkdirSync(testHlsDir, { recursive: true });
    }
    const manifestPath = path.join(testHlsDir, "master.m3u8");
    fs.writeFileSync(manifestPath, "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=800000\n360p.m3u8\n");

    try {
        const res = await fetch(`http://127.0.0.1:${TEST_PORT}/uploads/hls/test-stream-fixture/master.m3u8`);
        assert.equal(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes("#EXTM3U"));
    } finally {
        if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
        if (fs.existsSync(testHlsDir)) fs.rmdirSync(testHlsDir);
    }
});

test("Security: Unpublished video can only be streamed by its owner", async () => {
    const videoId = mockUnpublishedVideo._id;

    // 1. Unauthenticated request -> 403 Forbidden
    const unauthRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/stream/${videoId}`);
    assert.equal(unauthRes.status, 403);

    // 2. Another authenticated user -> 403 Forbidden
    const otherUserToken = jwt.sign(
        { _id: "64f1a2b3c4d5e6f7a8b9c999" },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
    );
    const forbiddenRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/stream/${videoId}`, {
        headers: {
            Authorization: `Bearer ${otherUserToken}`,
        },
    });
    assert.equal(forbiddenRes.status, 403);

    // 3. Video owner -> 200 OK
    const ownerRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/stream/${videoId}`, {
        headers: {
            Authorization: `Bearer ${validToken}`,
        },
    });
    assert.equal(ownerRes.status, 200);
    const bodyText = await ownerRes.text();
    assert.equal(bodyText, "test-video-content-stream-bytes");
});
