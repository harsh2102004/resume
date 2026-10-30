import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Sample verified fallback streams showcasing system capabilities
const DEMO_VIDEOS = [
  {
    _id: "demo-hls-video",
    title: "Big Buck Bunny — Adaptive HLS Multi-Bitrate Master Stream",
    description: "Multi-variant HLS manifest (360p to 1080p) transcoding demo with segmented .ts chunks and auto-bandwidth adaptation.",
    videoFile: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    thumbnail: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80",
    views: 14200,
    duration: 596,
    streamType: "HLS ABR",
    quality: "1080p60",
    owner: { fullName: "Open Media Project", username: "openmedia", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
    createdAt: new Date().toISOString(),
  },
  {
    _id: "demo-sample-2",
    title: "Synthesized Nature Stream — 4K Landscape Demo (Native HTTP 206)",
    description: "High frame-rate nature documentary showcasing progressive byte-range seeking with Range: bytes=start-end headers.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
    views: 8900,
    duration: 15,
    streamType: "HTTP 206",
    quality: "4K HDR",
    owner: { fullName: "Nature Horizon", username: "naturehorizon", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: "demo-sample-3",
    title: "Urban Motion — Night Architecture & Drone Footage",
    description: "Low-light drone footage showcasing instantaneous scrubbing with WebVTT storyboard sprite sheet hover previews.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&auto=format&fit=crop&q=80",
    views: 23100,
    duration: 15,
    streamType: "STORYBOARD",
    quality: "1080p",
    owner: { fullName: "SkyDrone Studios", username: "skydrone", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const CATEGORIES = [
  "All Streams",
  "Adaptive HLS",
  "HTTP 206 Range",
  "Watch Party Ready",
  "Ultra HD",
];

export const Home = () => {
  const [videos, setVideos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Streams");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/videos");
        const json = await res.json();
        if (json.data?.docs && json.data.docs.length > 0) {
          setVideos(json.data.docs);
        } else {
          setVideos(DEMO_VIDEOS);
        }
      } catch (err) {
        setVideos(DEMO_VIDEOS);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const filteredVideos = videos.filter((v) => {
    const matchesSearch = v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === "Adaptive HLS") {
      return matchesSearch && (v.streamType === "HLS ABR" || v.videoFile?.endsWith(".m3u8"));
    }
    if (selectedCategory === "HTTP 206 Range") {
      return matchesSearch && (v.streamType === "HTTP 206" || v.videoFile?.endsWith(".mp4"));
    }
    return matchesSearch;
  });

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Engineering Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-10 border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 bg-gradient-to-tr from-pink-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              PulseCast Media Pipeline v1.0
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Adaptive Bitrate Streaming & Real-Time Sync
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Engineering showcase featuring HTTP 206 partial chunking, FFmpeg multi-quality HLS transcoding, resumable TUS chunk recovery, and WebSocket watch parties.
            </p>

            {/* Architecture Metrics Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                TUS Ingestion: Resumable
              </span>
              <span className="px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                FFmpeg Worker: 360p—1080p
              </span>
              <span className="px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Drift Sync: &lt;50ms
              </span>
            </div>
          </div>

          {/* Quick Search & Filter in Hero */}
          <div className="w-full lg:w-96 space-y-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search streams or video manifest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 text-white placeholder-slate-400 text-sm pl-11 pr-4 py-3 rounded-2xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
              <span>Streams indexed: {videos.length}</span>
              <span>Backend: port 8000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              selectedCategory === cat
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-102"
                : "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Streams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden p-3 space-y-3">
              <div className="aspect-video rounded-xl bg-slate-800/60 animate-shimmer"></div>
              <div className="h-4 bg-slate-800/80 rounded w-3/4 animate-shimmer"></div>
              <div className="h-3 bg-slate-800/50 rounded w-1/2 animate-shimmer"></div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white">No streams match your query</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Try adjusting your search query or upload a new stream using the resumable TUS protocol pipeline.
          </p>
          <button
            onClick={() => { setSearchQuery(""); setSelectedCategory("All Streams"); }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 font-medium transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Link
              key={video._id}
              to={`/watch/${video._id}`}
              state={{ video }}
              className="group glass-card rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail Container */}
                <div className="relative aspect-video overflow-hidden bg-slate-950">
                  <img
                    src={video.thumbnail || "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800"}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>

                  {/* Play Overlay Icon on Hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl shadow-indigo-600/50 transform scale-90 group-hover:scale-100 transition-transform">
                      <svg className="w-6 h-6 fill-current translate-x-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-black/75 backdrop-blur-md text-indigo-300 border border-indigo-500/30">
                      {video.streamType || (video.videoFile?.endsWith(".m3u8") ? "HLS ABR" : "HTTP 206")}
                    </span>
                    {video.quality && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {video.quality}
                      </span>
                    )}
                  </div>

                  {/* Bottom Duration Badge */}
                  {video.duration ? (
                    <span className="absolute bottom-2.5 right-2.5 bg-black/85 backdrop-blur-md text-white text-xs px-2 py-0.5 rounded-md font-mono font-semibold border border-white/10">
                      {formatDuration(video.duration)}
                    </span>
                  ) : null}
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-3">
                  <h2 className="font-bold text-white text-base leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
                    {video.title}
                  </h2>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {video.description || "Adaptive media stream distributed via PulseCast chunk engine."}
                  </p>
                </div>
              </div>

              {/* Creator & Stats Footer */}
              <div className="p-4 pt-0 border-t border-white/5 flex items-center justify-between mt-2">
                <div className="flex items-center gap-2.5">
                  {video.owner?.avatar ? (
                    <img
                      src={video.owner.avatar}
                      alt={video.owner.fullName}
                      className="w-7 h-7 rounded-full object-cover border border-white/20"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {video.owner?.fullName?.charAt(0) || "P"}
                    </div>
                  )}
                  <span className="text-xs font-medium text-slate-300 truncate max-w-[130px]">
                    {video.owner?.fullName || "PulseCast Creator"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>{video.views?.toLocaleString() || "0"}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
