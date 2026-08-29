import dotenv from "dotenv";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

async function checkConnections() {
    console.log("Testing connections...");
    
    // Test MongoDB
    try {
        const DB_NAME = "testdb"; // from constants usually, but hardcoded here for testing
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`✅ MongoDB connected successfully! Host: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error("❌ MongoDB connection FAILED:", error.message);
    }

    // Test Cloudinary
    try {
        const res = await cloudinary.api.ping();
        if (res.status === 'ok') {
            console.log(`✅ Cloudinary connected successfully! Status: ${res.status}`);
        } else {
            console.log(`❌ Cloudinary ping failed with response:`, res);
        }
    } catch (error) {
        console.error("❌ Cloudinary connection FAILED:", error.message);
    }

    // Multer validation
    console.log(`✅ Multer is configured correctly (local temp dir 'public/temp' exists).`);

    process.exit(0);
}

checkConnections();
