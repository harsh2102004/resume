import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

/**
 * Uploads generated HLS and storyboard folders to Cloudinary if credentials exist,
 * and falls back to local disk paths if no credentials exist or on error.
 */
export const uploadHlsFolder = async (videoId) => {
    const hasCredentials = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

    const localMasterPath = `/uploads/hls/${videoId}/master.m3u8`;
    const localVttPath = `/uploads/storyboards/${videoId}/storyboard.vtt`;

    if (!hasCredentials) {
        return {
            hlsPath: localMasterPath,
            storyboardVtt: localVttPath,
        };
    }

    try {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        // 1. Upload HLS files (playlists & chunks)
        const hlsDir = path.resolve(`public/uploads/hls/${videoId}`);
        let cdnMasterUrl = localMasterPath;

        if (fs.existsSync(hlsDir)) {
            const files = fs.readdirSync(hlsDir);
            for (const file of files) {
                const filePath = path.join(hlsDir, file);
                const uploadResult = await cloudinary.uploader.upload(filePath, {
                    resource_type: "raw",
                    folder: `pulsecast/hls/${videoId}`,
                    public_id: file,
                    use_filename: true,
                    unique_filename: false,
                    overwrite: true,
                });

                if (file === "master.m3u8" && uploadResult?.secure_url) {
                    cdnMasterUrl = uploadResult.secure_url;
                }
            }
        }

        // 2. Upload Storyboard files (sprites & vtt)
        const storyboardDir = path.resolve(`public/uploads/storyboards/${videoId}`);
        let cdnVttUrl = localVttPath;

        if (fs.existsSync(storyboardDir)) {
            const files = fs.readdirSync(storyboardDir);
            for (const file of files) {
                const filePath = path.join(storyboardDir, file);
                const isVtt = file.endsWith(".vtt");
                const uploadResult = await cloudinary.uploader.upload(filePath, {
                    resource_type: isVtt ? "raw" : "image",
                    folder: `pulsecast/storyboards/${videoId}`,
                    public_id: file,
                    use_filename: true,
                    unique_filename: false,
                    overwrite: true,
                });

                if (isVtt && uploadResult?.secure_url) {
                    cdnVttUrl = uploadResult.secure_url;
                }
            }
        }

        return {
            hlsPath: cdnMasterUrl,
            storyboardVtt: cdnVttUrl,
        };
    } catch (err) {
        console.warn(`[Storage] Cloudinary upload for video ${videoId} failed, using local storage fallback:`, err?.message || err);
        return {
            hlsPath: localMasterPath,
            storyboardVtt: localVttPath,
        };
    }
};

