/**
 * @file src/routes/comment.routes.js
 * @description Express router for /api/v1/comments endpoints.
 */

import { Router } from "express";
import {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
} from "../controllers/comment.controller.js";
import { validate } from "../validators/validate.middleware.js";
import { commentSchema } from "../validators/comment.validator.js";
import { verifyJWT, optionalJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Publicly read comments (optional auth for isLiked); authenticated to post
router
  .route("/:videoId")
  .get(optionalJWT, getVideoComments)
  .post(verifyJWT, validate(commentSchema), addComment);

// Modify comments
router
  .route("/c/:commentId")
  .delete(verifyJWT, deleteComment)
  .patch(verifyJWT, validate(commentSchema), updateComment);

export default router;