import { asyncHandeler } from "../utils/asyncHandler.js";

import { ApiError } from "../utils/ApiError.js"

import User from "../models/user.model.js";
import { uploadonclodinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

//doing this beacuse we will genrate these toke vwen at multiple places like login, refresh token etc so we can reuse this function
const genrateAccesssAndRefreshToken = async (userId) => {
    try {
        const user = awaitUser.findById(userId);
        const accesstoken = user.generateAccessToken()
        const refreshtoken = user.generateRefreshToken()

        //save refresh token in db
        user.refreshToken = refreshtoken;
        await user.save(validateBeforeSave = false)


        //return both tokens
        return { accesstoken, refreshtoken }
    }
    catch {

        throw new ApiError(500, "token genration failed")
    }
}

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
            field?.trim() === "" || field === undefined)
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

    const avatar = await uploadonclodinary(avatarLocalPath)
    const coverImage = await uploadonclodinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "avatar upload failed")
    }

    ////////////////////
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })


    // 7. 🔥 Remove password and refresh token fields from response object (Security check)
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    console.log("CREATED USER OBJECT:", createdUser);
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

const loginUser = asyncHandeler(async (req, res) => {
    //req body se data
    //username or email
    //find the user
    //check pw
    //acccessa nd ref token genrate and send
    // send cookie with refresh token
    const { email, username, password } = req.body
    //both as we want to use either username or email for login
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    const user = await User.findOne({ $or: [{ username }, { email }] })

    if (!user) {
        throw new ApiError(404, "user not found")

    }
    //use user not User as we are checking for the user instance and not the model
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "invalid password")
    }

    const { accesstoken, refreshtoken } = await genrateAccesssAndRefreshToken(user._id)


    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        //only accessible by the web server
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .cookie("access_token", accesstoken, options)
        .cookie("refresh_token", refreshtoken, options)
        .json(new ApiResponse(200,  { user: accessToken, refreshToken, loggedInUser }, "Login successful"))
})

//////////////////////////////logouttt///////////////////////////////////

const logOutUser=asyncHandeler(async(req,res)=>{
 await User.findByIdAndUpdate(req.user._id,{$set:{refreshToken:undefined}},{new:true})
 const options = {
    //only accessible by the web server
    httpOnly: true,
    secure: true
}
  return res
        .status(200)
        .cookie("access_token", accesstoken, options)
        .cookie("refresh_token", refreshtoken, options)
.json(new ApiResponse(200, null, "Logout successful"))  
    
})
///////////////////////////////////////////////////////////////////////////////////////////////////////
const refreshAccessToken = asyncHandeler(async (req, res) => {
   const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken 
if(!incomingRefreshToken){
    throw new ApiError(401,"unauthorised req")

} 

 const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
const user = await User.findById(decodedToken?._Id)
if(!user){
    throw new ApiError(401,"invalid refresh token")

}
if(incomingRefreshToken !== user?.refreshToken){
    throw new ApiError(401,"invalid refresh token")
}
const options = {
    //only accessible by the web server
    httpOnly: true, 
    secure: true
  }
 const { accesstoken, newrefreshtoken } = await genrateAccesssAndRefreshToken(user._id)

 return res .status(200)
 .cookie("accessToken", accesstoken, options)
 .cookie("refreshToken", newrefreshtoken, options)
 .json(new ApiResponse(200, { accessToken: accesstoken, refreshToken: newrefreshtoken }, "Refresh token generated successfully"))




})
export { registeruser, logOutUser, loginUser, refreshAccessToken }