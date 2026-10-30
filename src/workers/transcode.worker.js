import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { Video } from "../models/video.model.js";

if (ffmpegInstaller?.path) ffmpeg.setFfmpegPath(ffmpegInstaller.path);
if (ffprobeInstaller?.path) ffmpeg.setFfprobePath(ffprobeInstaller.path);

const HLS_PROFILES = [
    {
        name: "360p",
        width: 640,
        height: 360,
        videoBitrate: "600k",
        audioBitrate: "64k",
        bandwidth: 600000,
    },
    {
        name: "720p",
        width: 1280,
        height: 720,
        videoBitrate: "2500k",
        audioBitrate: "128k",
        bandwidth: 2500000,
    },
];

const transcodeToProfile = (inputPath, outputDir, profile) => {
    return new Promise((resolve, reject) => {
        const playlistFile = path.join(outputDir, `${profile.name}.m3u8`);
        const segmentPattern = path.join(outputDir, `${profile.name}_%03d.ts`);

        const filterGraph = `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,drawtext=text='PulseCast':x=w-tw-16:y=16:fontsize=16:fontcolor=white@0.65:box=1:boxcolor=black@0.3:boxborderw=3`;

        ffmpeg(inputPath)
            .outputOptions([
                "-vf", filterGraph,
                "-c:v libx264",
                "-preset veryfast",
                "-b:v", profile.videoBitrate,
                "-c:a aac",
                "-b:a", profile.audioBitrate,
                "-hls_time", "6",
                "-hls_playlist_type", "vod",
                "-hls_segment_filename", segmentPattern,
            ])
            .output(playlistFile)
            .on("end", () => resolve(profile))
            .on("error", (err) => reject(err))
            .run();
    });
};

const generateMasterManifest = (outputDir, profiles) => {
    let manifestContent = "#EXTM3U\n#EXT-X-VERSION:3\n";

    for (const p of profiles) {
        manifestContent += `#EXT-X-STREAM-INF:BANDWIDTH=${p.bandwidth},RESOLUTION=${p.width}x${p.height}\n`;
        manifestContent += `${p.name}.m3u8\n`;
    }

    const masterPath = path.join(outputDir, "master.m3u8");
    fs.writeFileSync(masterPath, manifestContent);
    return masterPath;
};

export const transcodeVideoJob = async (videoId, inputFilePath) => {
    if (!fs.existsSync(inputFilePath)) return;

    try {
        await Video.findByIdAndUpdate(videoId, { transcodingStatus: "PROCESSING" });

        const hlsBaseDir = path.resolve("public/uploads/hls");
        const videoHlsDir = path.join(hlsBaseDir, String(videoId));

        if (!fs.existsSync(videoHlsDir)) {
            fs.mkdirSync(videoHlsDir, { recursive: true });
        }

        const completedProfiles = [];
        for (const profile of HLS_PROFILES) {
            try {
                await transcodeToProfile(inputFilePath, videoHlsDir, profile);
                completedProfiles.push(profile);
            } catch (err) {
                console.warn(`Skipping profile ${profile.name}:`, err.message);
            }
        }

        if (completedProfiles.length === 0) {
            throw new Error("Transcode failed for all profiles");
        }

        generateMasterManifest(videoHlsDir, completedProfiles);

        const relativeMasterPath = `/uploads/hls/${videoId}/master.m3u8`;

        await Video.findByIdAndUpdate(videoId, {
            transcodingStatus: "COMPLETED",
            hlsPath: relativeMasterPath,
            qualities: completedProfiles.map((p) => p.name),
        });
    } catch (error) {
        console.error(`Transcoding error (${videoId}):`, error);
        await Video.findByIdAndUpdate(videoId, { transcodingStatus: "FAILED" });
    }
};
