import { Router } from "express";
import {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
} from "../controllers/comment.controller.js";

const router = Router();

// Publicly read comments
router.route("/:videoId").get(getVideoComments).post(addComment);

// Modify comments
router.route("/c/:commentId").delete(deleteComment).patch(updateComment);

export default router;