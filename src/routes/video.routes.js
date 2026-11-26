/**
 * @file src/routes/video.routes.js
 * @description Express router for /api/v1/videos CRUD, byte-range streaming, and signed URL endpoints.
 */

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
import { verifyJWT, optionalJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { validate } from "../validators/validate.middleware.js";
import { updateVideoSchema } from "../validators/video.validator.js";

const router = Router();

router.route("/stream/:videoId").get(streamVideo);
router.route("/sign-stream/:videoId").get(verifyJWT, getSignedStreamUrl);
router.route("/").get(getAllVideos);
router.route("/:videoId").get(optionalJWT, getVideoById);

router.route("/").post(
    verifyJWT,
    upload.fields([
        { name: "videoFile", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ]),
    publishAVideo
);

router
    .route("/:videoId")
    .delete(verifyJWT, deleteVideo)
    .patch(verifyJWT, upload.single("thumbnail"), validate(updateVideoSchema), updateVideo);

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

export default router;