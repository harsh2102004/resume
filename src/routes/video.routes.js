import { Router } from "express";
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
} from "../controllers/video.controller.js";
import { streamVideo, getSignedStreamUrl } from "../controllers/stream.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// ==========================================
// Public Routes (Accessible without JWT)
// ==========================================

// Native HTTP 206 Partial Content Video Streaming (supports signed & direct streams)
router.route("/stream/:videoId").get(streamVideo);
router.route("/sign-stream/:videoId").get(getSignedStreamUrl);

// Public video browsing & details
router.route("/").get(getAllVideos);
router.route("/:videoId").get(getVideoById);

// ==========================================
// Protected Routes (Requires JWT Authentication)
// ==========================================

router.route("/").post(
    verifyJWT,
    upload.fields([
        {
            name: "videoFile",
            maxCount: 1,
        },
        {
            name: "thumbnail",
            maxCount: 1,
        },
    ]),
    publishAVideo
);

router
    .route("/:videoId")
    .delete(verifyJWT, deleteVideo)
    .patch(verifyJWT, upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

export default router;