import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: String, // Remote URL or stream URL
            required: true
        },
        localPath: {
            type: String, // Local disk path for fast HTTP 206 chunked streaming & FFmpeg worker
            default: ""
        },
        thumbnail: {
            type: String, // Cloudinary or static URL
            required: true
        },
        title: {
            type: String, 
            required: true,
            trim: true,
            index: true
        },
        description: {
            type: String, 
            required: true
        },
        duration: {
            type: Number, 
            default: 0
        },
        views: {
            type: Number,
            default: 0
        },
        fileSize: {
            type: Number,
            default: 0
        },
        mimeType: {
            type: String,
            default: "video/mp4"
        },
        hlsPath: {
            type: String, // e.g., /uploads/hls/:videoId/master.m3u8
            default: ""
        },
        transcodingStatus: {
            type: String,
            enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
            default: "PENDING"
        },
        qualities: {
            type: [String],
            default: []
        },
        storyboardVtt: {
            type: String, // e.g., /uploads/storyboards/:videoId/storyboard.vtt
            default: ""
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    }, 
    {
        timestamps: true
    }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);