/**
 * @file frontend/src/components/HlsPlayer.jsx
 * @description Custom video player integrating hls.js ABR quality switching, unified scrubber bar, and WebVTT #xywh= storyboard hover previews.
 */

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const formatTime = (seconds) => {
  if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
};

const parseVttTimestamp = (timestamp) => {
  const parts = timestamp.trim().split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return parseFloat(m) * 60 + parseFloat(s);
  }
  return 0;
};

export const HlsPlayer = ({ src, poster, storyboardVtt, onTimeUpdate }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const progressTrackRef = useRef(null);

  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
  const [isHls, setIsHls] = useState(false);

  // Playback state
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Storyboard state
  const [cues, setCues] = useState([]);
  const [hoverPreview, setHoverPreview] = useState(null);

  // 1. Fetch & parse WebVTT storyboard file if provided
  useEffect(() => {
    if (!storyboardVtt) {
      setCues([]);
      return;
    }

    const fetchVtt = async () => {
      try {
        const res = await fetch(storyboardVtt);
        if (!res.ok) return;
        const text = await res.text();

        const parsedCues = [];
        const lines = text.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes("-->")) {
            const [startStr, endStr] = line.split("-->").map((s) => s.trim());
            const cuePayload = lines[i + 1]?.trim();

            if (cuePayload && cuePayload.includes("#xywh=")) {
              const [rawUrl, coordPart] = cuePayload.split("#xywh=");
              const [x, y, w, h] = coordPart.split(",").map(Number);
              let resolvedUrl = rawUrl;
              try {
                const vttBase = new URL(storyboardVtt, window.location.origin);
                resolvedUrl = new URL(rawUrl, vttBase).href;
              } catch {
                // Keep rawUrl if URL resolution fails
              }

              parsedCues.push({
                start: parseVttTimestamp(startStr),
                end: parseVttTimestamp(endStr),
                url: resolvedUrl,
                x,
                y,
                w: w || 160,
                h: h || 90,
              });
            }
          }
        }
        setCues(parsedCues);
      } catch (err) {
        console.warn("Could not load storyboard VTT:", err);
      }
    };

    fetchVtt();
  }, [storyboardVtt]);

  // 2. Initialize HLS or Native Player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHlsSource = src.includes(".m3u8") || src.includes("/hls/");
    setIsHls(isHlsSource);
    setQualities([]);
    setCurrentQuality(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        autoStartLoad: true,
        startLevel: -1,
        enableWorker: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const availableLevels = data.levels.map((level, idx) => ({
          id: idx,
          height: level.height,
          label: `${level.height}p (${Math.round(level.bitrate / 1000)} kbps)`,
        }));
        setQualities(availableLevels);
        video.play().catch(() => {
          // Autoplay policy prevented unmuted playback, user will click to play
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              video.src = src;
              video.load();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else {
      video.src = src;
      video.load();
      video.play().catch(() => {
        // Autoplay policy prevented playback, user can click play
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  // Track fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((err) => console.log("Play interrupted:", err));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    video.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleTimeUpdate = (e) => {
    const video = e.target;
    setCurrentTime(video.currentTime);
    if (onTimeUpdate) onTimeUpdate(video.currentTime, video.duration);
  };

  const handleLoadedMetadata = (e) => {
    setDuration(e.target.duration);
  };

  const handleTimelineMouseMove = (e) => {
    const rect = progressTrackRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;

    const offsetX = e.clientX - rect.left;
    const hoverPercent = Math.max(0, Math.min(1, offsetX / rect.width));
    const targetTime = hoverPercent * duration;

    const matchingCue = cues.find(
      (c) => targetTime >= c.start && targetTime <= c.end
    );

    if (matchingCue) {
      setHoverPreview({
        time: targetTime,
        url: matchingCue.url,
        x: matchingCue.x,
        y: matchingCue.y,
        w: matchingCue.w,
        h: matchingCue.h,
        clientX: Math.max(8, Math.min(rect.width - (matchingCue.w || 160) - 8, offsetX - (matchingCue.w || 160) / 2)),
      });
    } else {
      setHoverPreview({
        time: targetTime,
        clientX: Math.max(8, Math.min(rect.width - 56, offsetX - 24)),
      });
    }
  };

  const handleTimelineMouseLeave = () => {
    setHoverPreview(null);
  };

  const handleTimelineClick = (e) => {
    const rect = progressTrackRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current || !duration) return;

    const offsetX = e.clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = clickPercent * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progressPct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 group select-none"
    >
      <video
        ref={videoRef}
        poster={poster}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="auto"
        className="w-full aspect-video object-contain bg-black cursor-pointer"
        playsInline
      />

      {/* Centered Play Button Overlay when paused */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px] cursor-pointer group-hover:bg-black/20 transition-all z-10"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-500/85 hover:bg-indigo-400/90 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-200 border border-white/20">
            <svg className="w-8 h-8 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Unified Custom Bottom Control Bar (Single Progress Bar + Storyboard Preview) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-3 px-4 transition-opacity duration-200 ${
          isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        }`}
      >
        {/* Floating Storyboard / Timestamp Hover Preview */}
        {hoverPreview && (
          <div
            className="absolute bottom-14 flex flex-col items-center pointer-events-none"
            style={{ left: `${hoverPreview.clientX}px` }}
          >
            {hoverPreview.url ? (
              <div
                className="rounded-lg border-2 border-indigo-300/80 shadow-2xl overflow-hidden bg-black"
                style={{
                  width: `${hoverPreview.w}px`,
                  height: `${hoverPreview.h}px`,
                  backgroundImage: `url(${hoverPreview.url})`,
                  backgroundPosition: `-${hoverPreview.x}px -${hoverPreview.y}px`,
                  backgroundRepeat: "no-repeat",
                }}
              />
            ) : null}
            <span className="mt-1 bg-black/90 text-white text-[11px] px-2 py-0.5 rounded font-mono font-medium shadow border border-white/10">
              {formatTime(hoverPreview.time)}
            </span>
          </div>
        )}

        {/* Single Interactive Progress Bar */}
        <div
          ref={progressTrackRef}
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
          onClick={handleTimelineClick}
          className="relative h-1.5 hover:h-2.5 w-full bg-white/25 hover:bg-white/35 rounded-full cursor-pointer transition-all flex items-center mb-2.5"
        >
          <div
            className="h-full bg-gradient-to-r from-indigo-400 to-teal-300 rounded-full relative"
            style={{ width: `${progressPct}%` }}
          >
            <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-3 text-white text-xs">
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 accent-indigo-400 cursor-pointer hidden sm:block"
              />
            </div>

            {/* Time Display */}
            <span className="font-mono text-[11px] text-slate-200">
              {formatTime(currentTime)} <span className="text-slate-400">/</span> {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Adaptive Quality Switcher (for HLS streams) */}
            {isHls && qualities.length > 0 && (
              <select
                value={currentQuality}
                onChange={(e) => {
                  const lvl = parseInt(e.target.value, 10);
                  setCurrentQuality(lvl);
                  if (hlsRef.current) hlsRef.current.currentLevel = lvl;
                }}
                className="bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold px-2 py-1 rounded-lg border border-white/10 focus:outline-none cursor-pointer"
                title="Stream Quality"
              >
                <option value={-1} className="bg-slate-900 text-white">Auto (ABR)</option>
                {qualities.map((q) => (
                  <option key={q.id} value={q.id} className="bg-slate-900 text-white">
                    {q.label}
                  </option>
                ))}
              </select>
            )}

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HlsPlayer;
