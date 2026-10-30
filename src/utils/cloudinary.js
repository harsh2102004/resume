import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Ensure config is fresh with env vars loaded
    configureCloudinary();

    // Upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Remove locally saved temporary file after upload succeeds
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return response;
  } catch (error) {
    console.error("Cloudinary upload failed:", error?.message || error);
    // Remove locally saved temporary file on failure
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};

const uploadVideoOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath || !fs.existsSync(localFilePath)) return null;

    configureCloudinary();

    const response = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(
        localFilePath,
        {
          resource_type: "video",
          folder: "pulsecast/videos",
          chunk_size: 6000000,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    return response;
  } catch (error) {
    console.error("Cloudinary video upload error, attempting standard upload:", error?.message || error);
    try {
      configureCloudinary();
      return await cloudinary.uploader.upload(localFilePath, {
        resource_type: "video",
        folder: "pulsecast/videos",
      });
    } catch (fallbackError) {
      console.error("Cloudinary fallback upload failed:", fallbackError?.message || fallbackError);
      return null;
    }
  }
};

export { uploadOnCloudinary, uploadVideoOnCloudinary };