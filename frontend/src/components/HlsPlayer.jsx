import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const formatTime = (seconds) => {
  if (isNaN(seconds)) return "00:00";
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
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const progressTrackRef = useRef(null);

  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
  const [isHls, setIsHls] = useState(false);

  // Playback state
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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
              const [url, coordPart] = cuePayload.split("#xywh=");
              const [x, y, w, h] = coordPart.split(",").map(Number);

              parsedCues.push({
                start: parseVttTimestamp(startStr),
                end: parseVttTimestamp(endStr),
                url,
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
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else {
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

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
        clientX: Math.max(10, Math.min(rect.width - 170, offsetX - 80)),
      });
    } else {
      setHoverPreview({
        time: targetTime,
        clientX: Math.max(10, Math.min(rect.width - 60, offsetX - 30)),
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

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 group select-none">
      <video
        ref={videoRef}
        poster={poster}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full aspect-video object-contain bg-black"
        playsInline
        controls
      />

      {/* Adaptive Quality Switcher Overlay (for HLS streams) */}
      {isHls && qualities.length > 0 && (
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-xl">
          <span className="text-[11px] text-slate-300 font-mono font-medium">Quality:</span>
          <select
            value={currentQuality}
            onChange={(e) => {
              const lvl = parseInt(e.target.value, 10);
              setCurrentQuality(lvl);
              if (hlsRef.current) hlsRef.current.currentLevel = lvl;
            }}
            className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
          >
            <option value={-1} className="bg-slate-900 text-white">Auto (Adaptive)</option>
            {qualities.map((q) => (
              <option key={q.id} value={q.id} className="bg-slate-900 text-white">
                {q.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Interactive Storyboard Timeline Scrubber Bar */}
      {cues.length > 0 && (
        <div className="absolute bottom-14 left-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Floating Hover Thumbnail Preview */}
          {hoverPreview && (
            <div
              className="absolute bottom-6 flex flex-col items-center pointer-events-none transition-transform"
              style={{ left: `${hoverPreview.clientX}px` }}
            >
              {hoverPreview.url ? (
                <div
                  className="rounded-lg border-2 border-indigo-400/80 shadow-2xl overflow-hidden bg-black"
                  style={{
                    width: `${hoverPreview.w}px`,
                    height: `${hoverPreview.h}px`,
                    backgroundImage: `url(${hoverPreview.url})`,
                    backgroundPosition: `-${hoverPreview.x}px -${hoverPreview.y}px`,
                    backgroundRepeat: "no-repeat",
                  }}
                />
              ) : null}
              <span className="mt-1 bg-black/90 text-white text-xs px-2 py-0.5 rounded font-mono font-medium shadow border border-white/10">
                {formatTime(hoverPreview.time)}
              </span>
            </div>
          )}

          {/* Interactive Scrubbing Track */}
          <div
            ref={progressTrackRef}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            onClick={handleTimelineClick}
            className="relative h-2 hover:h-3 w-full bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-all flex items-center"
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full shadow-lg"
              style={{
                width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HlsPlayer;
