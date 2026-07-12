import { Router } from "express";
import { registeruser,logOutUser,loginUser ,refreshAccessToken} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJwt } from "../middlewares/auth.middleware.js";
const router=Router()
router.route("/register").post(
   upload.fields([

    {name:"avatar",
        maxcount:1},

        { name:"coverImage",
            maxcount:1
        }




    
   ]) ,
    registeruser)

 router.route("/login").post(loginuser)
//secured routes
router.route("/logout").get(verifyJwt,logoutUser)
//do method ki wajah se next likhte ho
router.route("/refresh-token").post(
    //  verifyJwt,
    
    refreshAccessToken)

 export default router