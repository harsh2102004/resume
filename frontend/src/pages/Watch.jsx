import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import HlsPlayer from "../components/HlsPlayer";
import CommentsSection from "../components/CommentsSection";

const RELATED_STREAMS = [
  {
    _id: "demo-hls-video",
    title: "Big Buck Bunny — Open Animation Film",
    thumbnail: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80",
    duration: 596,
    views: "14.2K",
    owner: { fullName: "Open Media Project" },
  },
  {
    _id: "demo-sample-2",
    title: "Pacific Coastline — 4K Tropical Beach & Sunset Waves",
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80",
    duration: 15,
    views: "8.9K",
    owner: { fullName: "Nature Horizon" },
  },
  {
    _id: "demo-sample-3",
    title: "Metropolis Lights — Urban Night Cityscape & Drone Flight",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&auto=format&fit=crop&q=80",
    duration: 15,
    views: "23.1K",
    owner: { fullName: "SkyDrone Studios" },
  },
];

export const Watch = () => {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [video, setVideo] = useState(location.state?.video || null);
  const [loading, setLoading] = useState(!location.state?.video);
  const [likes, setLikes] = useState(1420);
  const [hasLiked, setHasLiked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/videos/${videoId}`);
        const json = await res.json();
        if (json.data) {
          setVideo(json.data);
        } else {
          const found = RELATED_STREAMS.find((s) => s._id === videoId);
          if (found) setVideo(found);
        }
      } catch (err) {
        const found = RELATED_STREAMS.find((s) => s._id === videoId);
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
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
        <p className="text-xs text-slate-400">Loading video...</p>
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
      setLikes((prev) => prev + 1);
      setHasLiked(true);
    } else {
      setLikes((prev) => prev - 1);
      setHasLiked(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Player, Video Info & Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cinema Player Container */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
            <HlsPlayer
              src={videoSrc}
              poster={video?.thumbnail}
              storyboardVtt={vttSrc}
            />
          </div>

          {/* Video Title */}
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {video?.title || "Video Stream"}
            </h1>

            {/* Channel Bar & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-white/5">
              {/* Creator Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {video?.owner?.fullName?.charAt(0) || "P"}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {video?.owner?.fullName || "PulseCast Channel"}
                  </h3>
                  <p className="text-xs text-slate-400">14.2K subscribers</p>
                </div>
                <button
                  onClick={() => setIsSubscribed(!isSubscribed)}
                  className={`ml-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSubscribed
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-white text-slate-900 hover:bg-slate-200 font-bold"
                  }`}
                >
                  {isSubscribed ? "Subscribed" : "Subscribe"}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Like Button */}
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
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

                {/* Share Button */}
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>{copied ? "Copied!" : "Share"}</span>
                </button>

                {/* Watch Party Button */}
                <button
                  onClick={handleStartWatchParty}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <span>🍿</span>
                  <span>Watch Party</span>
                </button>
              </div>
            </div>

            {/* Description Box */}
            <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                <span className="text-white">{(video?.views || 14200).toLocaleString()} views</span>
                <span>•</span>
                <span>Published recently</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {video?.description || "Enjoy watching this video in high resolution on PulseCast."}
              </p>
            </div>
          </div>

          {/* Interactive Comments Section */}
          <CommentsSection videoId={videoId} />
        </div>

        {/* Right Column: Up Next Videos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Up Next
            </h2>
          </div>

          <div className="space-y-3">
            {RELATED_STREAMS.map((item) => (
              <Link
                key={item._id}
                to={`/watch/${item._id}`}
                state={{ video: item }}
                className={`flex gap-3 p-2 rounded-xl glass-card border border-white/5 group ${
                  item._id === videoId ? "ring-1 ring-indigo-500 bg-white/5" : ""
                }`}
              >
                <div className="relative w-36 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-slate-950">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-1 right-1 bg-black/85 text-[10px] px-1 py-0.2 rounded text-white font-medium">
                    {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex flex-col justify-between overflow-hidden">
                  <h4 className="text-xs font-bold text-white line-clamp-2 group-hover:text-indigo-400 transition-colors">
                    {item.title}
                  </h4>
                  <div className="text-[11px] text-slate-400">
                    <p className="truncate">{item.owner.fullName}</p>
                    <p>{item.views} views</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Watch Party Callout */}
          <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
              <span className="text-base">🍿</span>
              <span>Watch Together with Friends</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Create an instant synchronized room to watch videos simultaneously with real-time chat.
            </p>
            <button
              onClick={handleStartWatchParty}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              Start Watch Party
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;
