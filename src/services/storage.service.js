/**
 * @file src/services/storage.service.js
 * @description Uploads generated HLS playlists/segments and WebVTT storyboards to Cloudinary (rewriting URLs) with local disk fallback.
 */

import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

const uploadRawFile = async (filePath, folder, publicId, resourceType = "raw") => {
    return cloudinary.uploader.upload(filePath, {
        resource_type: resourceType,
        folder,
        public_id: publicId,
        use_filename: true,
        unique_filename: false,
        overwrite: true,
    });
};

/**
 * Uploads generated HLS and storyboard folders to Cloudinary if credentials exist,
 * rewriting playlist and VTT references to their CDN URLs, and falls back to
 * local disk paths if no credentials exist or on error.
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

        // 1. Upload HLS files: segments (.ts) -> variant playlists (.m3u8) -> master.m3u8
        const hlsDir = path.resolve(`public/uploads/hls/${videoId}`);
        const hlsFolder = `pulsecast/hls/${videoId}`;
        let cdnMasterUrl = localMasterPath;

        if (fs.existsSync(hlsDir)) {
            const files = fs.readdirSync(hlsDir);
            const segmentUrls = {};
            const playlistUrls = {};

            for (const file of files.filter((f) => f.endsWith(".ts"))) {
                const res = await uploadRawFile(path.join(hlsDir, file), hlsFolder, file, "raw");
                if (res?.secure_url) segmentUrls[file] = res.secure_url;
            }

            for (const file of files.filter((f) => f.endsWith(".m3u8") && f !== "master.m3u8")) {
                const filePath = path.join(hlsDir, file);
                let content = fs.readFileSync(filePath, "utf8");
                for (const [segName, segUrl] of Object.entries(segmentUrls)) {
                    content = content.replaceAll(segName, segUrl);
                }
                fs.writeFileSync(filePath, content, "utf8");
                const res = await uploadRawFile(filePath, hlsFolder, file, "raw");
                if (res?.secure_url) playlistUrls[file] = res.secure_url;
            }

            const masterFile = path.join(hlsDir, "master.m3u8");
            if (fs.existsSync(masterFile)) {
                let masterContent = fs.readFileSync(masterFile, "utf8");
                for (const [plName, plUrl] of Object.entries(playlistUrls)) {
                    masterContent = masterContent.replaceAll(plName, plUrl);
                }
                fs.writeFileSync(masterFile, masterContent, "utf8");
                const res = await uploadRawFile(masterFile, hlsFolder, "master.m3u8", "raw");
                if (res?.secure_url) cdnMasterUrl = res.secure_url;
            }
        }

        // 2. Upload Storyboard files: sprite images first, then rewrite & upload storyboard.vtt
        const storyboardDir = path.resolve(`public/uploads/storyboards/${videoId}`);
        const sbFolder = `pulsecast/storyboards/${videoId}`;
        let cdnVttUrl = localVttPath;

        if (fs.existsSync(storyboardDir)) {
            const files = fs.readdirSync(storyboardDir);
            const spriteUrls = {};

            for (const file of files.filter((f) => !f.endsWith(".vtt"))) {
                const res = await uploadRawFile(path.join(storyboardDir, file), sbFolder, file, "image");
                if (res?.secure_url) spriteUrls[file] = res.secure_url;
            }

            const vttFile = path.join(storyboardDir, "storyboard.vtt");
            if (fs.existsSync(vttFile)) {
                let vttContent = fs.readFileSync(vttFile, "utf8");
                for (const [spriteName, spriteUrl] of Object.entries(spriteUrls)) {
                    vttContent = vttContent.replaceAll(`/uploads/storyboards/${videoId}/${spriteName}`, spriteUrl);
                    vttContent = vttContent.replaceAll(spriteName, spriteUrl);
                }
                fs.writeFileSync(vttFile, vttContent, "utf8");
                const res = await uploadRawFile(vttFile, sbFolder, "storyboard.vtt", "raw");
                if (res?.secure_url) cdnVttUrl = res.secure_url;
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
