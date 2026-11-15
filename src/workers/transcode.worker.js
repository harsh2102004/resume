import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { Video } from "../models/video.model.js";
import { generateStoryboardJob } from "./storyboard.worker.js";
import { uploadHlsFolder } from "../services/storage.service.js";

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

const getFilterGraph = (profile) => {
    let filter = `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`;
    const watermarkFont = process.env.WATERMARK_FONT;
    if (watermarkFont && fs.existsSync(watermarkFont)) {
        filter += `,drawtext=fontfile='${watermarkFont}':text='PulseCast':x=w-tw-16:y=16:fontsize=16:fontcolor=white@0.65:box=1:boxcolor=black@0.3:boxborderw=3`;
    }
    return filter;
};

const transcodeToProfile = (inputPath, outputDir, profile, onProgress) => {
    return new Promise((resolve, reject) => {
        const playlistFile = path.join(outputDir, `${profile.name}.m3u8`);
        const segmentPattern = path.join(outputDir, `${profile.name}_%03d.ts`);
        const filterGraph = getFilterGraph(profile);

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
            .on("progress", (p) => {
                if (typeof onProgress === "function" && p.percent) {
                    onProgress(p.percent);
                }
            })
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
    let resolvedInput = inputFilePath;
    if (!fs.existsSync(resolvedInput)) {
        const uploadDir = path.resolve(process.env.UPLOAD_DIR || "storage/uploads/resumable");
        const altPath = path.join(uploadDir, path.basename(inputFilePath));
        if (fs.existsSync(altPath)) {
            resolvedInput = altPath;
        } else {
            const err = new Error(`Input file not found: ${inputFilePath}`);
            await Video.findByIdAndUpdate(videoId, { transcodingStatus: "FAILED" });
            throw err;
        }
    }

    try {
        await Video.findByIdAndUpdate(videoId, {
            transcodingStatus: "PROCESSING",
            transcodeProgress: 10,
        });

        // 1. Generate Storyboard sprites and VTT
        try {
            await generateStoryboardJob(videoId, resolvedInput);
        } catch (sbErr) {
            console.warn(`[Worker] Storyboard generation warning for ${videoId}:`, sbErr?.message || sbErr);
        }

        await Video.findByIdAndUpdate(videoId, {
            transcodeProgress: 35,
        });

        // 2. Generate HLS multi-bitrate streams
        const hlsBaseDir = path.resolve("public/uploads/hls");
        const videoHlsDir = path.join(hlsBaseDir, String(videoId));

        if (!fs.existsSync(videoHlsDir)) {
            fs.mkdirSync(videoHlsDir, { recursive: true });
        }

        const completedProfiles = [];
        let profileIndex = 0;

        for (const profile of HLS_PROFILES) {
            try {
                await transcodeToProfile(resolvedInput, videoHlsDir, profile);
                completedProfiles.push(profile);
            } catch (err) {
                console.warn(`[Worker] Skipping profile ${profile.name}:`, err.message);
            }
            profileIndex++;
            const currentProgress = 35 + Math.round((profileIndex / HLS_PROFILES.length) * 50);
            await Video.findByIdAndUpdate(videoId, {
                transcodeProgress: currentProgress,
            });
        }

        if (completedProfiles.length === 0) {
            throw new Error("Transcode failed for all profiles");
        }

        generateMasterManifest(videoHlsDir, completedProfiles);

        await Video.findByIdAndUpdate(videoId, {
            transcodeProgress: 90,
        });

        // 3. Upload finished HLS and storyboard folder to CDN (if credentials exist) or keep local disk
        const { hlsPath, storyboardVtt } = await uploadHlsFolder(videoId);

        await Video.findByIdAndUpdate(videoId, {
            transcodingStatus: "COMPLETED",
            transcodeProgress: 100,
            hlsPath,
            ...(storyboardVtt ? { storyboardVtt } : {}),
            qualities: completedProfiles.map((p) => p.name),
        });

        return {
            hlsPath,
            storyboardVtt,
            qualities: completedProfiles.map((p) => p.name),
        };
    } catch (error) {
        console.error(`Transcoding error (${videoId}):`, error?.message || error);
        await Video.findByIdAndUpdate(videoId, { transcodingStatus: "FAILED" });
        throw error;
    }
};
