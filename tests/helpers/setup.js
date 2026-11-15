import http from "http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { v2 as cloudinary } from "cloudinary";
import { app } from "../../src/app.js";
import { initializeWatchPartySocket } from "../../src/sockets/watchParty.socket.js";
import { User } from "../../src/models/user.model.js";
import { Video } from "../../src/models/video.model.js";

// Ensure required environment variables for test execution
process.env.PORT = "0";
process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-token-secret-for-pulsecast-tests-12345";
process.env.ACCESS_TOKEN_EXPIRY = "1d";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "test-refresh-token-secret-for-pulsecast-tests-12345";
process.env.REFRESH_TOKEN_EXPIRY = "10d";
process.env.STREAM_SECRET = process.env.STREAM_SECRET || "test-stream-secret-for-pulsecast-tests";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000";
process.env.UPLOAD_DIR = "storage/uploads/resumable";
process.env.WATERMARK_FONT = "";

export async function setupTestEnvironment() {
    // Stub Cloudinary upload calls
    cloudinary.uploader.upload_large = (_filePath, _opts, cb) => {
        const result = { secure_url: "https://res.cloudinary.com/demo/video/upload/sample.mp4", duration: 10 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
    };
    cloudinary.uploader.upload = (_filePath, _opts, cb) => {
        const result = { secure_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", duration: 0 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
    };

    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const server = http.createServer(app);
    initializeWatchPartySocket(server);

    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const teardown = async () => {
        await new Promise((resolve) => server.close(resolve));
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        await mongod.stop();
    };

    const clearDb = async () => {
        const collections = mongoose.connection.collections;
        for (const key of Object.keys(collections)) {
            await collections[key].deleteMany({});
        }
    };

    return { mongod, server, baseUrl, port, teardown, clearDb };
}

export async function createTestUser(overrides = {}) {
    const defaultData = {
        fullName: "Test User",
        email: `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
        username: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        password: "Password123!",
        avatar: "https://example.com/avatar.jpg",
    };

    const userData = { ...defaultData, ...overrides };
    const user = await User.create(userData);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return {
        user,
        rawPassword: userData.password,
        accessToken,
        refreshToken,
        authHeaders: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    };
}

export async function createTestVideo(ownerId, overrides = {}) {
    const defaultVideo = {
        title: "Test Video",
        description: "Test Video Description",
        videoFile: "https://res.cloudinary.com/demo/video/upload/sample.mp4",
        thumbnail: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        duration: 120,
        views: 0,
        isPublished: true,
        owner: ownerId,
    };

    return await Video.create({ ...defaultVideo, ...overrides });
}

