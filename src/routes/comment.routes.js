import { Router } from "express";
import {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
} from "../controllers/comment.controller.js";
import { validate } from "../validators/validate.middleware.js";
import { commentSchema } from "../validators/comment.validator.js";

const router = Router();

// Publicly read comments
router.route("/:videoId").get(getVideoComments).post(validate(commentSchema), addComment);

// Modify comments
router.route("/c/:commentId").delete(deleteComment).patch(validate(commentSchema), updateComment);

export default router;