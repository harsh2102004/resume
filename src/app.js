import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { tusServer } from "./services/tus.service.js";
import { authenticateRequest } from "./middlewares/auth.middleware.js";

// Ensure storage and public streaming directories exist at startup
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

app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
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
        "Accept-Ranges"
    ]
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Narrow static exposure: ONLY expose processed HLS streams and storyboard scrubbing sprites
app.use("/uploads/hls", express.static(path.resolve("public/uploads/hls")));
app.use("/uploads/storyboards", express.static(path.resolve("public/uploads/storyboards")));

if (fs.existsSync(path.resolve("public/academy.html"))) {
    app.get("/academy.html", (req, res) => {
        res.sendFile(path.resolve("public/academy.html"));
    });
}

app.use(cookieParser());

app.all("/api/v1/videos/resumable-upload*", async (req, res) => {
    // Require valid authentication for POST and PATCH (anything that creates or writes data)
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

// Routes import
import userRouter from "./routes/user.routes.js";
import healthcheckRouter from "./routes/healthcheck.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import videoRouter from "./routes/video.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

// Routes declaration
app.get("/", (req, res) => {
    res.send("Welcome to PulseCast Media API! Access API routes at /api/v1");
});

app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);

export { app };