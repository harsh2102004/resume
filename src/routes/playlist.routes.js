import { Router } from 'express';
import {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylist,
} from "../controllers/playlist.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import { validate } from "../validators/validate.middleware.js";
import { createPlaylistSchema, updatePlaylistSchema } from "../validators/playlist.validator.js";

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").post(validate(createPlaylistSchema), createPlaylist)

router
    .route("/:playlistId")
    .get(getPlaylistById)
    .patch(validate(updatePlaylistSchema), updatePlaylist)
    .delete(deletePlaylist);

router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").patch(removeVideoFromPlaylist);

router.route("/user/:userId").get(getUserPlaylists);

export default router