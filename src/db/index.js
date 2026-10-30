import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const rawUri = (process.env.MONGODB_URI || "mongodb://localhost:27017").trim();
        const connectionString = rawUri.endsWith("/")
            ? `${rawUri}${DB_NAME}`
            : `${rawUri}/${DB_NAME}`;

        const connectionInstance = await mongoose.connect(connectionString);
        console.log(`MongoDB connected: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        throw error;
    }
};

export default connectDB;