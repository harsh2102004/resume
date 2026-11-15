import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { tusServer } from "./services/tus.service.js";
import { authenticateRequest } from "./middlewares/auth.middleware.js";
import { allowedOrigins } from "./utils/corsOrigins.js";
import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";

// ─── Ensure storage and public streaming directories exist at startup ─────────
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "storage/uploads/resumable");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const hlsDir = path.resolve("public/uploads/hls");
if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
}
const storyboardsDir = path.resolve("public/uploads/storyboards");
if (!fs.existsSync(storyboardsDir)) {
    fs.mkdirSync(storyboardsDir, { recursive: true });
}

const app = express();

// ─── Security headers (Helmet) ────────────────────────────────────────────────
app.use(
    helmet({
        // Allow HLS video to be served cross-origin (video players need this)
        crossOriginResourcePolicy: { policy: "cross-origin" },
        // Disable strict CSP globally; individual route-level headers handle content
        contentSecurityPolicy: false,
    })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow same-origin requests (no Origin header) and listed origins
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`CORS: origin '${origin}' is not allowed`));
        },
        credentials: true,
        exposedHeaders: [
            "Upload-Offset",
            "Location",
            "Upload-Length",
            "Tus-Version",
            "Tus-Resumable",
            "Tus-Max-Size",
            "Tus-Extension",
            "Upload-Metadata",
            "Upload-Defer-Length",
            "Upload-Concat",
            "Content-Range",
            "Accept-Ranges",
        ],
    })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// ─── Narrow static exposure ───────────────────────────────────────────────────
// ONLY expose processed HLS streams and storyboard scrubbing sprites
app.use("/uploads/hls", express.static(path.resolve("public/uploads/hls")));
app.use("/uploads/storyboards", express.static(path.resolve("public/uploads/storyboards")));

app.use(cookieParser());

// ─── Rate limiters ────────────────────────────────────────────────────────────
const rateLimitHandler = (req, res) => {
    res.status(429).json(new ApiResponse(429, null, "Too many requests. Please slow down and try again later."));
};

// General limiter for all API routes (excluding stream, which uses range requests)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
});

// Strict limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
});

// Apply general limiter to all /api/v1 routes except the stream endpoint
app.use(/^\/api\/v1\/(?!videos\/stream\/)/, generalLimiter);

// ─── TUS resumable upload route ───────────────────────────────────────────────
app.all("/api/v1/videos/resumable-upload*", async (req, res) => {
    if (req.method === "POST" || req.method === "PATCH") {
        try {
            const user = await authenticateRequest(req);
            req.user = user;
        } catch (error) {
            return res.status(401).json({
                statusCode: 401,
                message: error?.message || "Authentication required. Please sign in to upload videos.",
                success: false,
            });
        }
    }
    return tusServer.handle(req, res);
});

// ─── Routes import ────────────────────────────────────────────────────────────
import userRouter from "./routes/user.routes.js";
import healthcheckRouter from "./routes/healthcheck.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import videoRouter from "./routes/video.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

// ─── Routes declaration ───────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.send("Welcome to PulseCast Media API! Access API routes at /api/v1");
});

app.use("/api/v1/healthcheck", healthcheckRouter);

// Apply strict rate limiter to auth-sensitive endpoints
app.use("/api/v1/users/login", authLimiter);
app.use("/api/v1/users/register", authLimiter);
app.use("/api/v1/users/refresh-token", authLimiter);

app.use("/api/v1/users", userRouter);
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);

// ─── Central error handler ────────────────────────────────────────────────────
// Must be the LAST middleware registered
app.use((err, req, res, _next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json(new ApiResponse(err.statusCode, null, err.message));
    }
    // CORS errors come through as generic Error objects
    if (err.message && err.message.startsWith("CORS:")) {
        return res.status(403).json(new ApiResponse(403, null, err.message));
    }
    const statusCode = err.statusCode || 500;
    const message =
        process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message || "Internal Server Error";
    return res.status(statusCode).json(new ApiResponse(statusCode, null, message));
});

export { app };
