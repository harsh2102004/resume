import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import HlsPlayer from "../components/HlsPlayer";

const RELATED_STREAMS = [
  {
    _id: "demo-hls-video",
    title: "Big Buck Bunny — Adaptive HLS Multi-Bitrate Stream",
    thumbnail: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80",
    duration: 596,
    views: "14.2K",
    owner: { fullName: "Open Media Project" },
    tag: "HLS ABR"
  },
  {
    _id: "demo-sample-2",
    title: "Synthesized Nature Stream — 4K Landscape Demo",
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80",
    duration: 15,
    views: "8.9K",
    owner: { fullName: "Nature Horizon" },
    tag: "HTTP 206"
  },
  {
    _id: "demo-sample-3",
    title: "Urban Motion — Night Architecture & Drone Footage",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&auto=format&fit=crop&q=80",
    duration: 15,
    views: "23.1K",
    owner: { fullName: "SkyDrone Studios" },
    tag: "STORYBOARD"
  }
];

export const Watch = () => {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [video, setVideo] = useState(location.state?.video || null);
  const [loading, setLoading] = useState(!location.state?.video);
  const [likes, setLikes] = useState(1420);
  const [hasLiked, setHasLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  useEffect(() => {
    // If not passed via state or if switching videos, fetch details
    const fetchVideo = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/videos/${videoId}`);
        const json = await res.json();
        if (json.data) {
          setVideo(json.data);
        } else {
          // Fallback to related stream if matches id
          const found = RELATED_STREAMS.find(s => s._id === videoId);
          if (found) setVideo(found);
        }
      } catch (err) {
        const found = RELATED_STREAMS.find(s => s._id === videoId);
        if (found) setVideo(found);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
        <p className="text-sm font-mono text-slate-400">Mounting video decoder stream...</p>
      </div>
    );
  }

  // Determine media URL
  const videoSrc = video?.videoFile?.startsWith("http")
    ? video.videoFile
    : video?.videoFile
    ? `http://localhost:8000${video.videoFile}`
    : videoId === "demo-sample-2"
    ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    : videoId === "demo-sample-3"
    ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
    : "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

  const vttSrc = video?.storyboardVtt
    ? video.storyboardVtt.startsWith("http")
      ? video.storyboardVtt
      : `http://localhost:8000${video.storyboardVtt}`
    : null;

  const handleStartWatchParty = () => {
    const randomRoomId = `room-${Math.random().toString(36).substring(2, 8)}`;
    navigate(`/watch-party?roomId=${randomRoomId}&videoId=${videoId}`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = () => {
    if (!hasLiked) {
      setLikes(prev => prev + 1);
      setHasLiked(true);
    } else {
      setLikes(prev => prev - 1);
      setHasLiked(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Player & Video Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cinema Player Container with Ambient Glow */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-pink-500/20 rounded-3xl blur-xl opacity-40 group-hover:opacity-70 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
              <HlsPlayer
                src={videoSrc}
                poster={video?.thumbnail}
                storyboardVtt={vttSrc}
              />
            </div>
          </div>

          {/* Video Title and Quick Actions */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {video?.title || "Adaptive Bitrate Stream Showcase"}
              </h1>
              <button
                onClick={handleStartWatchParty}
                className="glow-btn inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                Start Watch Party
              </button>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {video?.owner?.fullName?.charAt(0) || "P"}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                    {video?.owner?.fullName || "PulseCast Engineering"}
                    <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </h3>
                  <p className="text-xs text-slate-400">12.8K subscribers</p>
                </div>
                <button className="ml-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors">
                  Subscribe
                </button>
              </div>

              {/* Interaction Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    hasLiked
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <svg className="w-4 h-4" fill={hasLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  <span>{likes.toLocaleString()}</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>{copied ? "Link Copied!" : "Share"}</span>
                </button>

                <button
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span>{showTechDetails ? "Hide Spec" : "Specs"}</span>
                </button>
              </div>
            </div>

            {/* Description Box */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span className="font-semibold text-white">{(video?.views || 14200).toLocaleString()} views</span>
                <span>•</span>
                <span>Uploaded recently</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-semibold">
                  {videoSrc.includes(".m3u8") ? "HLS Master Playlist" : "HTTP 206 Partial Chunk"}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {video?.description || "High-performance distributed media stream rendered via the PulseCast core transcoding and chunking engine."}
              </p>

              {/* Engineering Spec Accordion */}
              {showTechDetails && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-xs font-mono text-slate-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
                    <div>
                      <span className="text-slate-500">Protocol: </span>
                      <span className="text-indigo-400">{videoSrc.includes(".m3u8") ? "HLS (RFC 8216)" : "HTTP/1.1 Range RFC 7233"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Security: </span>
                      <span className="text-emerald-400">HMAC-SHA256 Token</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Ingestion: </span>
                      <span className="text-violet-400">TUS v1.0.0 Resumable</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Storyboard: </span>
                      <span className="text-amber-400">{vttSrc ? "WebVTT Sprite Matrix" : "Default Canvas"}</span>
                    </div>
                  </div>
                  <div className="truncate text-slate-400 text-[11px] bg-slate-950 p-2 rounded-lg">
                    <span className="text-slate-500">Stream URI: </span>{videoSrc}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Up Next Streams */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Engineering Demos
            </h2>
            <span className="text-xs text-slate-400 font-mono">3 Streams</span>
          </div>

          <div className="space-y-3">
            {RELATED_STREAMS.map((item) => (
              <Link
                key={item._id}
                to={`/watch/${item._id}`}
                state={{ video: item }}
                className={`flex gap-3 p-2.5 rounded-xl glass-card border border-white/5 group ${
                  item._id === videoId ? "ring-1 ring-indigo-500 bg-white/5" : ""
                }`}
              >
                <div className="relative w-36 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-slate-950">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-1 right-1 bg-black/85 text-[10px] font-mono px-1 py-0.2 rounded text-white">
                    {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}
                  </span>
                  <span className="absolute top-1 left-1 bg-black/80 text-[9px] font-mono font-bold px-1 rounded text-indigo-300">
                    {item.tag}
                  </span>
                </div>
                <div className="flex flex-col justify-between overflow-hidden">
                  <h4 className="text-xs font-bold text-white line-clamp-2 group-hover:text-indigo-400 transition-colors">
                    {item.title}
                  </h4>
                  <div className="text-[11px] text-slate-400">
                    <p className="truncate">{item.owner.fullName}</p>
                    <p className="font-mono">{item.views} views</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Watch Party Callout Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
              <span className="text-base">🍿</span>
              <span>Synchronized Watch Rooms</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Experience zero-lag synchronized streaming with friends with automated drift compensation.
            </p>
            <button
              onClick={handleStartWatchParty}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              Join Live Theater
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;
