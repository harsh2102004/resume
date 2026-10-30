import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { Video } from "../models/video.model.js";

if (ffmpegInstaller?.path) ffmpeg.setFfmpegPath(ffmpegInstaller.path);
if (ffprobeInstaller?.path) ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Format seconds into WebVTT timestamp format (HH:MM:SS.mmm)
 */
const formatVttTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 1000);

    const pad = (num, size = 2) => String(num).padStart(size, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
};

/**
 * Probe video duration using ffprobe
 */
const probeVideoDuration = (filePath) => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err || !metadata?.format?.duration) {
                resolve(30); // Fallback 30 seconds
            } else {
                resolve(Math.max(1, Math.round(metadata.format.duration)));
            }
        });
    });
};

/**
 * Storyboard Sprite Generator Worker
 * Extracts frames at 5-second intervals, tiles them into a 5x5 image sprite grid,
 * and compiles a standard WebVTT cue file for video scrubbing timeline previews.
 */
export const generateStoryboardJob = async (videoId, inputFilePath) => {
    if (!fs.existsSync(inputFilePath)) {
        console.error(`[Storyboard] Input file not found: ${inputFilePath}`);
        return null;
    }

    try {
        console.log(`[Storyboard] Generating scrubbing sprite sheet for Video ${videoId}...`);

        const duration = await probeVideoDuration(inputFilePath);
        const interval = 5; // Frame every 5 seconds
        const thumbWidth = 160;
        const thumbHeight = 90;
        const gridCols = 5;
        const gridRows = 5;
        const tilesPerSheet = gridCols * gridRows; // 25 tiles

        const totalFrames = Math.max(1, Math.ceil(duration / interval));

        const baseDir = path.resolve("public/uploads/storyboards");
        const videoDir = path.join(baseDir, String(videoId));

        if (!fs.existsSync(videoDir)) {
            fs.mkdirSync(videoDir, { recursive: true });
        }

        const spritePattern = path.join(videoDir, "sprite_%03d.jpg");

        await new Promise((resolve, reject) => {
            ffmpeg(inputFilePath)
                .outputOptions([
                    "-vf", `fps=1/${interval},scale=${thumbWidth}:${thumbHeight},tile=${gridCols}x${gridRows}`,
                    "-q:v", "3",
                ])
                .output(spritePattern)
                .on("end", () => {
                    console.log(`[Storyboard] Sprite sheet images rendered for Video ${videoId}`);
                    resolve();
                })
                .on("error", (err) => {
                    console.error(`[Storyboard] Error rendering sprites:`, err.message);
                    reject(err);
                })
                .run();
        });

        // Generate WebVTT cue index
        let vttContent = "WEBVTT\n\n";

        for (let i = 0; i < totalFrames; i++) {
            const startTime = i * interval;
            const endTime = Math.min((i + 1) * interval, duration);

            const sheetIndex = Math.floor(i / tilesPerSheet) + 1;
            const indexInSheet = i % tilesPerSheet;
            const col = indexInSheet % gridCols;
            const row = Math.floor(indexInSheet / gridCols);

            const x = col * thumbWidth;
            const y = row * thumbHeight;

            const sheetFile = `sprite_${String(sheetIndex).padStart(3, "0")}.jpg`;
            const cueUrl = `/uploads/storyboards/${videoId}/${sheetFile}#xywh=${x},${y},${thumbWidth},${thumbHeight}`;

            vttContent += `${formatVttTime(startTime)} --> ${formatVttTime(endTime)}\n`;
            vttContent += `${cueUrl}\n\n`;
        }

        const vttPath = path.join(videoDir, "storyboard.vtt");
        fs.writeFileSync(vttPath, vttContent);

        const relativeVttPath = `/uploads/storyboards/${videoId}/storyboard.vtt`;

        await Video.findByIdAndUpdate(videoId, {
            storyboardVtt: relativeVttPath,
            duration,
        });

        console.log(`[Storyboard] WebVTT manifest created: ${relativeVttPath}`);
        return relativeVttPath;
    } catch (err) {
        console.error(`[Storyboard] Generation failed for Video ${videoId}:`, err);
        return null;
    }
};
