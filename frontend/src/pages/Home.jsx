import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import Toast from "../components/Toast";

const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80";

const CATEGORIES = [
  { label: "All", keywords: [] },
  { label: "Adaptive HLS", keywords: ["hls", "adaptive", "bitrate", "streaming"] },
  { label: "Architecture", keywords: ["websocket", "pipeline", "distributed", "ffmpeg", "node"] },
  { label: "Cinema & VFX", keywords: ["sintel", "tears", "steel", "bunny", "elephants", "cinema", "4k"] },
  { label: "Benchmarks", keywords: ["benchmark", "test", "profile", "latency", "encoding"] },
];

export const Home = () => {
  const [videos, setVideos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/videos?limit=24`);
        const json = await res.json();
        const apiDocs = json.data?.docs || [];
        const validApiDocs = apiDocs.filter((v) => v.videoFile && !v.mimeType?.startsWith("image/"));
        setVideos(validApiDocs);
      } catch {
        setVideos([]);
        setErrorMessage("Failed to load videos. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const filteredVideos = videos.filter((v) => {
    const text = `${v.title || ""} ${v.description || ""}`.toLowerCase();
    const matchesSearch = !searchQuery.trim() || text.includes(searchQuery.toLowerCase());

    if (selectedCategory === "All") return matchesSearch;
    if (selectedCategory === "Adaptive HLS") {
      return matchesSearch && (Boolean(v.hlsPath) || v.qualities?.length > 0 || text.includes("hls"));
    }
    const catObj = CATEGORIES.find((c) => c.label === selectedCategory);
    if (catObj && catObj.keywords.length > 0) {
      return matchesSearch && catObj.keywords.some((kw) => text.includes(kw));
    }
    return matchesSearch;
  });

  const featuredVideo = videos.find((v) => v.hlsPath) || videos[0] || null;

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Contrasting Deep-Navy & Blue Featured Spotlight Hero */}
      {!loading && featuredVideo && !searchQuery && selectedCategory === "All" && (
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="absolute inset-0">
            <img
              src={featuredVideo.thumbnail || FALLBACK_THUMBNAIL}
              alt={featuredVideo.title}
              onError={(e) => { e.currentTarget.src = FALLBACK_THUMBNAIL; }}
              className="w-full h-full object-cover opacity-35 scale-105 blur-[1px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-blue-950/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
          </div>

          <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-2xl space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-600/25 text-sky-200 border border-blue-400/35">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                Featured Stream
              </span>
              {(featuredVideo.hlsPath || featuredVideo.qualities?.length > 0) && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-white border border-white/20">
                  Adaptive HLS
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/10 text-slate-200 border border-white/15">
                {featuredVideo.views?.toLocaleString() || "0"} views
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {featuredVideo.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 line-clamp-2 leading-relaxed">
              {featuredVideo.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to={`/watch/${featuredVideo._id}`}
                state={{ video: featuredVideo }}
                className="glow-btn inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/35"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Watch Stream</span>
              </Link>

              <Link
                to={`/watch-party?roomId=room-live&videoId=${featuredVideo._id}`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 hover:bg-blue-50 font-bold text-sm transition-all shadow"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Start Watch Party</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Search & Discover White Glass Toolbar */}
      <div className="glass-panel rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {CATEGORIES.map(({ label }) => (
            <button
              key={label}
              onClick={() => setSelectedCategory(label)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                selectedCategory === label
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                  : "bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search streams, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-slate-900 placeholder-slate-400 text-sm pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Video Streams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden p-3 space-y-3">
              <div className="aspect-video rounded-xl bg-slate-200 animate-shimmer"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4 animate-shimmer"></div>
              <div className="h-3 bg-slate-100 rounded w-1/2 animate-shimmer"></div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">No videos yet</h3>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            There are no videos published yet. Be the first creator to share high-performance streaming videos on PulseCast!
          </p>
          <Link
            to="/upload"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-semibold shadow-md transition-all cursor-pointer"
          >
            Upload a Video
          </Link>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">No videos found</h3>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            Try adjusting your search query or select another category filter.
          </p>
          <button
            onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sm text-white font-medium transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => {
            const isAbr = Boolean(video.hlsPath) || video.qualities?.length > 0;
            return (
              <Link
                key={video._id}
                to={`/watch/${video._id}`}
                state={{ video }}
                className="group glass-card rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail Container */}
                  <div className="relative aspect-video overflow-hidden bg-slate-900">
                    <img
                      src={video.thumbnail || FALLBACK_THUMBNAIL}
                      alt={video.title}
                      onError={(e) => { e.currentTarget.src = FALLBACK_THUMBNAIL; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-60 group-hover:opacity-35 transition-opacity"></div>

                    {/* Play Overlay Icon on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                        <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>

                    {/* HLS / Quality Badge */}
                    {isAbr && (
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-600 text-white shadow">
                        HLS ABR
                      </span>
                    )}

                    {/* Duration Badge */}
                    {video.duration ? (
                      <span className="absolute bottom-2.5 right-2.5 bg-slate-950/85 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded-md font-mono font-semibold">
                        {formatDuration(video.duration)}
                      </span>
                    ) : null}
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-1.5">
                    <h2 className="font-bold text-slate-900 text-[15.5px] leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {video.title}
                    </h2>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {video.description}
                    </p>
                  </div>
                </div>

                {/* Creator & Views Footer */}
                <div className="px-4 pb-4 pt-2.5 flex items-center justify-between border-t border-slate-100 mt-1">
                  <div className="flex items-center gap-2.5">
                    {video.owner?.avatar ? (
                      <img
                        src={video.owner.avatar}
                        alt={video.owner.fullName}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {video.owner?.fullName?.charAt(0) || "P"}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">
                      {video.owner?.fullName || "PulseCast Creator"}
                    </span>
                  </div>

                  <span className="text-[11px] font-medium text-slate-500">
                    {video.views?.toLocaleString() || "0"} views
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Toast message={errorMessage} onClose={() => setErrorMessage("")} />
    </div>
  );
};

export default Home;
