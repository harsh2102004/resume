import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// High quality sample videos
const DEMO_VIDEOS = [
  {
    _id: "demo-hls-video",
    title: "Big Buck Bunny — Open Animation Film",
    description: "A large, lovable rabbit deals with bullying forest creatures in this classic open-source animated comedy.",
    videoFile: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    thumbnail: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80",
    views: 14200,
    duration: 596,
    quality: "1080p",
    category: "Animation",
    owner: { fullName: "Open Media Project", username: "openmedia", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
    createdAt: new Date().toISOString(),
  },
  {
    _id: "demo-sample-2",
    title: "Pacific Coastline — 4K Tropical Beach & Sunset Waves",
    description: "Relaxing high-definition ocean waves rolling against the pristine sandy beach during golden hour.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
    views: 8900,
    duration: 15,
    quality: "4K HDR",
    category: "Nature",
    owner: { fullName: "Nature Horizon", username: "naturehorizon", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: "demo-sample-3",
    title: "Metropolis Lights — Urban Night Cityscape & Drone Flight",
    description: "Cinematic night aerial flight through illuminated downtown skyscrapers and vibrant highway traffic.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&auto=format&fit=crop&q=80",
    views: 23100,
    duration: 15,
    quality: "4K",
    category: "Travel",
    owner: { fullName: "SkyDrone Studios", username: "skydrone", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const CATEGORIES = [
  "All",
  "Trending",
  "Nature",
  "Animation",
  "Travel",
  "Technology",
];

export const Home = () => {
  const [videos, setVideos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
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
    const matchesSearch =
      v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedCategory === "All") return matchesSearch;
    if (v.category) return matchesSearch && v.category === selectedCategory;
    return matchesSearch;
  });

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Search & Discover Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-white text-slate-900 shadow-md font-bold"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/5"
              }`}
            >
              {cat}
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
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm pl-10 pr-9 py-2.5 rounded-xl border border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
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
          <h3 className="text-xl font-bold text-white">No videos found</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Try adjusting your search query or select another category filter.
          </p>
          <button
            onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 font-medium transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-40 group-hover:opacity-20 transition-opacity"></div>

                  {/* Play Overlay Icon on Hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                      <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>

                  {/* Quality Badge */}
                  {video.quality && (
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/75 backdrop-blur-md text-white border border-white/10">
                      {video.quality}
                    </span>
                  )}

                  {/* Duration Badge */}
                  {video.duration ? (
                    <span className="absolute bottom-2.5 right-2.5 bg-black/85 backdrop-blur-md text-white text-xs px-2 py-0.5 rounded-md font-medium">
                      {formatDuration(video.duration)}
                    </span>
                  ) : null}
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-2">
                  <h2 className="font-bold text-white text-base leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
                    {video.title}
                  </h2>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {video.description}
                  </p>
                </div>
              </div>

              {/* Creator & Views Footer */}
              <div className="p-4 pt-0 flex items-center justify-between mt-2">
                <div className="flex items-center gap-2.5">
                  {video.owner?.avatar ? (
                    <img
                      src={video.owner.avatar}
                      alt={video.owner.fullName}
                      className="w-7 h-7 rounded-full object-cover border border-white/20"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {video.owner?.fullName?.charAt(0) || "P"}
                    </div>
                  )}
                  <span className="text-xs font-medium text-slate-300 truncate max-w-[130px]">
                    {video.owner?.fullName || "PulseCast Creator"}
                  </span>
                </div>

                <span className="text-xs text-slate-400">
                  {video.views?.toLocaleString() || "0"} views
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
