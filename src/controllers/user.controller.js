import { asyncHandeler } from "../utils/asyncHandler.js";

import { ApiError } from "../utils/ApiError.js"

import User from "../models/user.model.js";
import { uploadonclodinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registeruser = asyncHandeler(async (req, res) => {
    //get user detail from frontend
    //validation-not emptyy
    //check if user alr exist :username se ya eamil se
    //check for images,check for avatar
    //upload to cloudinary,avatar
    //create user object-create entry in db
    //remove pw and refresh token field
    //check for user creation
    //return if created  else error
    const { fullName, username, email, password } = req.body;
    console.log("email:", email);

    ///////////////////////////////////////////////
    //    if(fullName===""){

    //     throw new ApiError(400,"fullname required")
    //    } orr we can do


    if (

        [fullName, email, password, username].some((field) =>
            !field?.trim())
    ) {
        throw new ApiError(400, "all fileds are required")
    }
    ////////////////////////////////////////////////////////

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    //////////////////////////////

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar is required")
    }

    /////////////////////////////////

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "avatar upload failed")
    }

    ////////////////////
    const user=    await User.create({
        fullName: avatr.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
   

    // 7. 🔥 Remove password and refresh token fields from response object (Security check)
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    // 8. Return success response
    return res
        .status(201)
        .json(
            new ApiResponse(201, createdUser, "User registered successfully")
        );
});






export { registeruser }
