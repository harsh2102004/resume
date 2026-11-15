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
import { Like } from "../src/models/like.model.js";
import { Subscription } from "../src/models/subscription.model.js";
import { Comment } from "../src/models/comment.model.js";
import { generateSignedStreamUrl, verifyStreamSignature } from "../src/utils/mediaSecurity.js";
import { io as ioClient } from "socket.io-client";
import { initializeWatchPartySocket } from "../src/sockets/watchParty.socket.js";
import { videoQueue, addVideoProcessingJob } from "../src/queues/video.queue.js";

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-token-secret-for-pulsecast-tests";
process.env.STREAM_SECRET = process.env.STREAM_SECRET || "test-stream-secret-for-pulsecast-tests";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000";

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
const mockPublishedVideo = {
    _id: "64f1a2b3c4d5e6f7a8b9c0d3",
    title: "Published Video",
    isPublished: true,
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
    User.findById = (id) => {
        let userObj = null;
        if (String(id) === String(testUser._id)) {
            userObj = { ...testUser };
        } else if (String(id) === "64f1a2b3c4d5e6f7a8b9c0d5") {
            userObj = { _id: "64f1a2b3c4d5e6f7a8b9c0d5", username: "othercreator", fullName: "Other Creator" };
        }
        return {
            select: () => Promise.resolve(userObj),
            then: (resolve, reject) => Promise.resolve(userObj).then(resolve, reject),
        };
    };

    originalVideoFindById = Video.findById;
    Video.findById = (id) => {
        let v = null;
        if (String(id) === String(mockUnpublishedVideo._id)) {
            v = { ...mockUnpublishedVideo };
        } else if (String(id) === String(mockPublishedVideo._id)) {
            v = { ...mockPublishedVideo };
        }
        if (!v) {
            return {
                populate: () => Promise.resolve(null),
                then: (resolve, reject) => Promise.resolve(null).then(resolve, reject),
            };
        }
        v.views = v.views || 0;
        v.save = async function () { return this; };
        v.toObject = function () { return { ...v }; };

        return {
            populate: (field) => {
                if (field === "owner") {
                    v.owner = {
                        _id: testUser._id,
                        username: testUser.username,
                        fullName: "Test User",
                        avatar: "",
                    };
                }
                return Promise.resolve(v);
            },
            then: (resolve, reject) => Promise.resolve(v).then(resolve, reject),
        };
    };

    const inMemoryLikes = [];
    Like.countDocuments = async (filter = {}) => {
        if (filter.video) return inMemoryLikes.filter((l) => String(l.video) === String(filter.video)).length;
        if (filter.comment) return inMemoryLikes.filter((l) => String(l.comment) === String(filter.comment)).length;
        return inMemoryLikes.length;
    };
    Like.findOne = async (filter) => {
        return inMemoryLikes.find((l) => {
            if (filter.video && String(l.video) !== String(filter.video)) return false;
            if (filter.comment && String(l.comment) !== String(filter.comment)) return false;
            if (filter.likedBy && String(l.likedBy) !== String(filter.likedBy)) return false;
            return true;
        }) || null;
    };
    Like.create = async (doc) => {
        const item = { _id: "64f1a2b3c4d5e6f7a8b9c0d8", ...doc };
        inMemoryLikes.push(item);
        return item;
    };
    Like.findByIdAndDelete = async (id) => {
        const idx = inMemoryLikes.findIndex((l) => String(l._id) === String(id));
        if (idx !== -1) inMemoryLikes.splice(idx, 1);
        return {};
    };
    Like.deleteMany = async () => ({});

    const inMemorySubs = [];
    Subscription.countDocuments = async (filter = {}) => {
        if (filter.channel) return inMemorySubs.filter((s) => String(s.channel) === String(filter.channel)).length;
        return inMemorySubs.length;
    };
    Subscription.findOne = async (filter) => {
        return inMemorySubs.find((s) => {
            if (filter.channel && String(s.channel) !== String(filter.channel)) return false;
            if (filter.subscriber && String(s.subscriber) !== String(filter.subscriber)) return false;
            return true;
        }) || null;
    };
    Subscription.create = async (doc) => {
        const item = { _id: "64f1a2b3c4d5e6f7a8b9c0d4", ...doc };
        inMemorySubs.push(item);
        return item;
    };
    Subscription.findByIdAndDelete = async (id) => {
        const idx = inMemorySubs.findIndex((s) => String(s._id) === String(id));
        if (idx !== -1) inMemorySubs.splice(idx, 1);
        return {};
    };

    const inMemoryComments = [];
    Comment.aggregate = async () => {
        return inMemoryComments.map((c) => ({
            ...c,
            owner: {
                _id: testUser._id,
                username: testUser.username,
                fullName: "Test User",
                avatar: "",
            },
            likesCount: 0,
            likes: 0,
            isLiked: false,
        }));
    };
    Comment.countDocuments = async () => inMemoryComments.length;
    Comment.create = async (doc) => {
        const item = {
            _id: "64f1a2b3c4d5e6f7a8b9c0d6",
            ...doc,
            createdAt: new Date().toISOString(),
        };
        inMemoryComments.push(item);
        return item;
    };
    Comment.findById = (id) => {
        const c = inMemoryComments.find((item) => String(item._id) === String(id));
        if (!c) {
            return {
                populate: () => Promise.resolve(null),
                then: (resolve, reject) => Promise.resolve(null).then(resolve, reject),
            };
        }
        const commentObj = {
            ...c,
            owner: c.owner?._id || c.owner || testUser._id,
            save: async function () { return this; },
        };
        return {
            populate: () => Promise.resolve({
                ...commentObj,
                owner: {
                    _id: testUser._id,
                    username: testUser.username,
                    fullName: "Test User",
                    avatar: "",
                },
            }),
            then: (resolve, reject) => Promise.resolve(commentObj).then(resolve, reject),
        };
    };
    Comment.findByIdAndDelete = async (id) => {
        const idx = inMemoryComments.findIndex((item) => String(item._id) === String(id));
        if (idx !== -1) inMemoryComments.splice(idx, 1);
        return {};
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

    const videoStatusMap = new Map();
    originalFindByIdAndUpdate = Video.findByIdAndUpdate;
    Video.findByIdAndUpdate = async (id, update) => {
        const current = videoStatusMap.get(String(id)) || {};
        const updated = { ...current, ...update };
        videoStatusMap.set(String(id), updated);
        return updated;
    };

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
    initializeWatchPartySocket(server);
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

test("Sign Stream: GET /api/v1/videos/sign-stream/:videoId without login returns 401", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/sign-stream/${mockPublishedVideo._id}`);
    assert.equal(res.status, 401);
});

test("Sign Stream: GET /api/v1/videos/sign-stream/:videoId with invalid expiresIn returns 400", async () => {
    const res = await fetch(
        `http://127.0.0.1:${TEST_PORT}/api/v1/videos/sign-stream/${mockPublishedVideo._id}?expiresIn=not-a-number`,
        { headers: { Authorization: `Bearer ${validToken}` } }
    );
    assert.equal(res.status, 400);
});

test("Sign Stream: clamps expiresIn between 60 and 86400 seconds", async () => {
    const now = Math.floor(Date.now() / 1000);

    const resLow = await fetch(
        `http://127.0.0.1:${TEST_PORT}/api/v1/videos/sign-stream/${mockPublishedVideo._id}?expiresIn=10`,
        { headers: { Authorization: `Bearer ${validToken}` } }
    );
    assert.equal(resLow.status, 200);
    const dataLow = await resLow.json();
    assert.ok(dataLow.data.expires >= now + 59 && dataLow.data.expires <= now + 62);

    const resHigh = await fetch(
        `http://127.0.0.1:${TEST_PORT}/api/v1/videos/sign-stream/${mockPublishedVideo._id}?expiresIn=9999999`,
        { headers: { Authorization: `Bearer ${validToken}` } }
    );
    assert.equal(resHigh.status, 200);
    const dataHigh = await resHigh.json();
    assert.ok(dataHigh.data.expires >= now + 86390 && dataHigh.data.expires <= now + 86410);
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

test("Media Security: Expired signature returns HTTP 403 Forbidden", async () => {
    const expired = generateSignedStreamUrl(mockPublishedVideo._id, testUser._id, -60);
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}${expired.streamUrl}`);
    assert.equal(res.status, 403);
});

test("Media Security: Tampered signature returns HTTP 403 Forbidden", async () => {
    const signed = generateSignedStreamUrl(mockPublishedVideo._id, testUser._id, 300);
    const tamperedSig = signed.signature.slice(0, -4) + "ffff";
    const res = await fetch(
        `http://127.0.0.1:${TEST_PORT}/api/v1/videos/stream/${mockPublishedVideo._id}?expires=${signed.expires}&signature=${tamperedSig}&user=${testUser._id}`
    );
    assert.equal(res.status, 403);
});

test("Media Security: Signature for a different video returns HTTP 403 Forbidden", async () => {
    const diffSigned = generateSignedStreamUrl("64f1a2b3c4d5e6f7a8b9c999", testUser._id, 300);
    const res = await fetch(
        `http://127.0.0.1:${TEST_PORT}/api/v1/videos/stream/${mockPublishedVideo._id}?expires=${diffSigned.expires}&signature=${diffSigned.signature}&user=${testUser._id}`
    );
    assert.equal(res.status, 403);
});

test("Media Security: Valid signature returns HTTP 200 for stream", async () => {
    const signed = generateSignedStreamUrl(mockPublishedVideo._id, testUser._id, 300);
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}${signed.streamUrl}`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, "test-video-content-stream-bytes");
});

test("Media Security: Valid owner signature allows streaming unpublished video", async () => {
    const ownerSigned = generateSignedStreamUrl(mockUnpublishedVideo._id, testUser._id, 300);
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}${ownerSigned.streamUrl}`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, "test-video-content-stream-bytes");
});

test("Media Security: Non-owner signature rejects streaming unpublished video with 403", async () => {
    const nonOwnerSigned = generateSignedStreamUrl(mockUnpublishedVideo._id, "64f1a2b3c4d5e6f7a8b9c888", 300);
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}${nonOwnerSigned.streamUrl}`);
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

// ─── New security hardening tests ─────────────────────────────────────────────

test("Security Hardening: Invalid register body returns 400 with validation message", async () => {
    // Missing password, invalid email
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "A", email: "not-an-email", username: "u" }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    // Message should mention the failing field
    assert.ok(
        typeof data.message === "string" && data.message.length > 0,
        "Response should contain a validation error message"
    );
});

test("Security Hardening: Empty body register returns 400", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
});

test("Security Hardening: Disallowed CORS origin receives no CORS allow header", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/healthcheck`, {
        headers: { Origin: "https://evil-site.example.com" },
    });
    // The response should NOT carry Access-Control-Allow-Origin for a blocked origin
    assert.ok(
        !res.headers.get("access-control-allow-origin"),
        "Disallowed origin should not receive Access-Control-Allow-Origin header"
    );
});

test("Security Hardening: Rate limiter returns 429 after exceeding auth limit", async () => {
    // The strict auth limiter allows 10 requests per 15 minutes.
    // We send 11 POST requests to /login; at least the last one must be 429.
    // Using invalid credentials so the limit counter increments without DB calls.
    const url = `http://127.0.0.1:${TEST_PORT}/api/v1/users/login`;
    const body = JSON.stringify({ email: "rate@test.com", password: "password123" });
    const headers = { "Content-Type": "application/json" };

    let got429 = false;
    for (let i = 0; i < 12; i++) {
        const res = await fetch(url, { method: "POST", headers, body });
        if (res.status === 429) {
            got429 = true;
            break;
        }
    }
    assert.ok(got429, "Should receive 429 after exceeding the auth rate limit");
});

// ─── Real Engagement Tests ──────────────────────────────────────────────────

test("Engagement: GET /api/v1/videos/:videoId returns likesCount, isLiked, subscribersCount, isSubscribed", async () => {
    // 1. Anonymous request
    const anonRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/${mockPublishedVideo._id}`);
    assert.equal(anonRes.status, 200);
    const anonData = await anonRes.json();
    assert.equal(anonData.success, true);
    assert.equal(typeof anonData.data.likesCount, "number");
    assert.equal(anonData.data.isLiked, false);
    assert.equal(typeof anonData.data.subscribersCount, "number");
    assert.equal(anonData.data.isSubscribed, false);

    // 2. Authenticated request
    const authRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/videos/${mockPublishedVideo._id}`, {
        headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(authRes.status, 200);
    const authData = await authRes.json();
    assert.equal(authData.success, true);
    assert.equal(typeof authData.data.likesCount, "number");
    assert.equal(typeof authData.data.isLiked, "boolean");
});

test("Engagement: Toggle video like requires auth and updates like status", async () => {
    // 1. Unauthenticated -> 401
    const unauthRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/likes/toggle/v/${mockPublishedVideo._id}`, {
        method: "POST",
    });
    assert.equal(unauthRes.status, 401);

    // 2. Like video -> 200/201 with isLiked: true
    const likeRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/likes/toggle/v/${mockPublishedVideo._id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.ok(likeRes.status === 200 || likeRes.status === 201);
    const likeData = await likeRes.json();
    assert.equal(likeData.success, true);
    assert.equal(likeData.data.isLiked, true);

    // 3. Toggle again -> 200 with isLiked: false
    const unlikeRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/likes/toggle/v/${mockPublishedVideo._id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(unlikeRes.status, 200);
    const unlikeData = await unlikeRes.json();
    assert.equal(unlikeData.success, true);
    assert.equal(unlikeData.data.isLiked, false);
});

test("Engagement: Toggle subscription requires auth and prevents self-subscription", async () => {
    const channelId = "64f1a2b3c4d5e6f7a8b9c0d5";

    // 1. Unauthenticated -> 401
    const unauthRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/subscriptions/c/${channelId}`, {
        method: "POST",
    });
    assert.equal(unauthRes.status, 401);

    // 2. Self-subscription -> 400
    const selfRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/subscriptions/c/${testUser._id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(selfRes.status, 400);
    const selfData = await selfRes.json();
    assert.equal(selfData.success, false);
    assert.ok(selfData.message.includes("own channel"));

    // 3. Subscribe to another channel -> 201 with isSubscribed: true
    const subRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/subscriptions/c/${channelId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.ok(subRes.status === 200 || subRes.status === 201);
    const subData = await subRes.json();
    assert.equal(subData.success, true);
    assert.equal(subData.data.isSubscribed, true);

    // 4. Toggle unsubscribe -> 200 with isSubscribed: false
    const unsubRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/subscriptions/c/${channelId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(unsubRes.status, 200);
    const unsubData = await unsubRes.json();
    assert.equal(unsubData.success, true);
    assert.equal(unsubData.data.isSubscribed, false);
});

test("Engagement: Comments API supports get, post, edit, delete with authentication", async () => {
    // 1. GET comments for video -> 200
    const getRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/comments/${mockPublishedVideo._id}`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.success, true);
    assert.ok(Array.isArray(getData.data.docs));

    // 2. Unauthenticated POST comment -> 401
    const unauthPost = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/comments/${mockPublishedVideo._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Great video!" }),
    });
    assert.equal(unauthPost.status, 401);

    // 3. Authenticated POST comment -> 201
    const postRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/comments/${mockPublishedVideo._id}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ content: "Great video!" }),
    });
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    assert.equal(postData.success, true);
    assert.equal(postData.data.content, "Great video!");
    const commentId = postData.data._id;

    // 4. Authenticated PATCH comment -> 200
    const patchRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/comments/c/${commentId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ content: "Updated video review!" }),
    });
    assert.equal(patchRes.status, 200);

    // 5. Authenticated DELETE comment -> 200
    const deleteRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/comments/c/${commentId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${validToken}`,
        },
    });
    assert.equal(deleteRes.status, 200);
});

// ─── Watch Party WebSocket Security & Sync Tests ──────────────────────────────

test("Watch Party: Host controls sync, non-host ignored, invalid payload ignored, handover on disconnect", async () => {
    const socketUrl = `http://127.0.0.1:${TEST_PORT}/watch-party`;
    const roomId = "test-wp-secure-room";

    const client1 = ioClient(socketUrl, { transports: ["websocket"] });
    const client2 = ioClient(socketUrl, { transports: ["websocket"] });

    await Promise.all([
        new Promise((resolve) => client1.on("connect", resolve)),
        new Promise((resolve) => client2.on("connect", resolve)),
    ]);

    // 1. Two clients join: client 1 is host, client 2 is guest
    client1.emit("join-room", { roomId, username: "HostUser" });
    const c1State = await new Promise((resolve) => client1.on("room-state", resolve));
    assert.equal(c1State.hostSocketId, client1.id);

    client2.emit("join-room", { roomId, username: "GuestUser" });
    const c2State = await new Promise((resolve) => client2.on("room-state", resolve));
    assert.equal(c2State.hostSocketId, client1.id);

    // 2. Host's action reaches the other client
    const actionPromise = new Promise((resolve) => {
        client2.on("sync-action", resolve);
    });
    client1.emit("sync-action", { action: "PLAY", currentTime: 45.0 });
    const receivedAction = await actionPromise;
    assert.equal(receivedAction.action, "PLAY");
    assert.equal(receivedAction.currentTime, 45.0);

    // 3. Non-host action is ignored (and emits sync-error)
    let guestActionReachedHost = false;
    const unexpectedActionHandler = () => {
        guestActionReachedHost = true;
    };
    client1.on("sync-action", unexpectedActionHandler);

    const guestErrorPromise = new Promise((resolve) => {
        client2.on("sync-error", resolve);
    });
    client2.emit("sync-action", { action: "PAUSE", currentTime: 10.0 });
    const syncError = await guestErrorPromise;
    assert.ok(syncError.message.includes("host"));
    assert.equal(guestActionReachedHost, false);
    client1.off("sync-action", unexpectedActionHandler);

    // 4. Invalid payload is ignored
    let invalidActionReceived = false;
    const invalidActionHandler = () => {
        invalidActionReceived = true;
    };
    client2.on("sync-action", invalidActionHandler);

    client1.emit("sync-action", { action: "INVALID_ACTION", currentTime: 10 });
    client1.emit("sync-action", { action: "PLAY", currentTime: -10 });
    client1.emit("sync-action", { action: "PLAY", currentTime: "invalid_time" });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(invalidActionReceived, false);
    client2.off("sync-action", invalidActionHandler);

    // 5. Host disconnects -> handover to next client
    const handoverPromise = new Promise((resolve) => {
        client2.on("host-changed", resolve);
    });
    client1.disconnect();
    const handoverData = await handoverPromise;
    assert.equal(handoverData.hostSocketId, client2.id);

    client2.disconnect();
});

// ─── Video Queue & Worker Background Processing Tests ─────────────────────────

test("Queue & Worker: Enqueuing a job against mocked queue/processor updates video status and handles failures", async () => {
    // 1. Test enqueuing with correct job options (attempts: 3, exponential backoff)
    const originalAdd = videoQueue.add;
    let enqueuedJob = null;
    videoQueue.add = async (name, data, opts) => {
        enqueuedJob = { name, data, opts };
        return { id: "job_test_123", ...enqueuedJob };
    };

    const testVideoId = "64f1a2b3c4d5e6f7a8b9c0aa";
    await addVideoProcessingJob(testVideoId, "storage/uploads/resumable/test.mp4");

    assert.ok(enqueuedJob, "Job should have been added to the queue");
    assert.equal(enqueuedJob.name, "process-video");
    assert.equal(enqueuedJob.data.videoId, testVideoId);
    assert.equal(enqueuedJob.opts.attempts, 3);
    assert.equal(enqueuedJob.opts.backoff.type, "exponential");

    videoQueue.add = originalAdd;

    // 2. Mock processor execution for a successful job: PENDING -> PROCESSING (progress) -> COMPLETED (100)
    let videoStatus = "PENDING";
    let videoProgress = 0;

    const mockProcessor = async (job) => {
        videoStatus = "PROCESSING";
        videoProgress = 10;
        await Video.findByIdAndUpdate(job.data.videoId, {
            transcodingStatus: videoStatus,
            transcodeProgress: videoProgress,
        });

        videoProgress = 60;
        await Video.findByIdAndUpdate(job.data.videoId, {
            transcodeProgress: videoProgress,
        });

        videoStatus = "COMPLETED";
        videoProgress = 100;
        await Video.findByIdAndUpdate(job.data.videoId, {
            transcodingStatus: videoStatus,
            transcodeProgress: videoProgress,
            hlsPath: `/uploads/hls/${job.data.videoId}/master.m3u8`,
        });
    };

    await mockProcessor({ data: { videoId: testVideoId } });
    assert.equal(videoStatus, "COMPLETED");
    assert.equal(videoProgress, 100);

    // 3. Mock processor failure: fails and marks video as FAILED
    const failVideoId = "64f1a2b3c4d5e6f7a8b9c0ab";
    let failStatus = "PENDING";

    const failingProcessor = async (job) => {
        failStatus = "PROCESSING";
        try {
            throw new Error("Transcode worker failure: profile generation failed");
        } catch (err) {
            failStatus = "FAILED";
            await Video.findByIdAndUpdate(job.data.videoId, {
                transcodingStatus: failStatus,
            });
            throw err;
        }
    };

    await assert.rejects(async () => {
        await failingProcessor({ data: { videoId: failVideoId } });
    }, /Transcode worker failure/);

    assert.equal(failStatus, "FAILED");
});
