import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Sample fallback videos for instantaneous offline demoing
const DEMO_VIDEOS = [
  {
    _id: "demo-hls-video",
    title: "Big Buck Bunny — Adaptive HLS Stream (360p to 1080p)",
    description: "Adaptive Bitrate Streaming demo with multi-quality playlist and chunked buffering.",
    videoFile: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    thumbnail: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=60",
    views: 14200,
    duration: 596,
    owner: { fullName: "Open Media Project", username: "openmedia" },
    createdAt: new Date().toISOString(),
  },
  {
    _id: "demo-sample-2",
    title: "Synthesized Nature Stream — 4K Landscape Demo",
    description: "High frame rate nature documentary video featuring HTTP 206 chunked playback.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=60",
    views: 8900,
    duration: 15,
    owner: { fullName: "Nature Horizon", username: "naturehorizon" },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: "demo-sample-3",
    title: "Urban Motion — Night Architecture & Drone Footage",
    description: "Low-light drone footage showcasing progressive byte range seeking.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=60",
    views: 23100,
    duration: 15,
    owner: { fullName: "SkyDrone Studios", username: "skydrone" },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

export const Home = () => {
  const [videos, setVideos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
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
        // Fallback to demo items if backend is not seeded
        setVideos(DEMO_VIDEOS);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const filteredVideos = videos.filter((v) =>
    v.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Search Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Explore Streams</h1>
          <p className="text-sm text-gray-400">Adaptive HLS playback with native byte-range chunking</p>
        </div>
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Video Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No streams found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Link
              key={video._id}
              to={`/watch/${video._id}`}
              state={{ video }}
              className="group bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-800/80 hover:border-gray-700 transition-all hover:-translate-y-1 shadow-lg"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-black">
                <img
                  src={video.thumbnail || "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600"}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {video.duration ? (
                  <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded font-mono font-medium">
                    {Math.floor(video.duration / 60)}:
                    {String(Math.floor(video.duration % 60)).padStart(2, "0")}
                  </span>
                ) : null}
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <h3 className="font-bold text-white text-sm line-clamp-2 group-hover:text-orange-400 transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                  <span>{video.owner?.fullName || "PulseCast Creator"}</span>
                  <span>{video.views?.toLocaleString()} views</span>
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
