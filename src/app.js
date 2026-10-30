import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { tusServer } from "./services/tus.service.js";

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
app.use(express.static("public"));
app.use(cookieParser());

app.all("/api/v1/videos/resumable-upload*", (req, res) => {
    // Only logged in users can initiate video uploads
    if (req.method === "POST") {
        const token = req.cookies?.accessToken || req.headers["authorization"]?.replace("Bearer ", "");
        if (!token) {
            return res.status(401).json({
                statusCode: 401,
                message: "Authentication required. Please sign in to upload videos.",
                success: false
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