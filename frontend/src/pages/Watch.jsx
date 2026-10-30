import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import HlsPlayer from "../components/HlsPlayer";
import CommentsSection from "../components/CommentsSection";
import { DEMO_VIDEOS } from "../data/demoVideos";
import { useAuth } from "../context/AuthContext";

export const Watch = () => {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();

  const [video, setVideo] = useState(
    location.state?.video?._id === videoId
      ? location.state.video
      : DEMO_VIDEOS.find((s) => s._id === videoId) || null
  );
  const [loading, setLoading] = useState(!video);
  const [likes, setLikes] = useState(1420);
  const [hasLiked, setHasLiked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(14200);
  const [copied, setCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Deterministic base like count for videos
  const getBaseLikes = (vid) => {
    if (vid?.likes !== undefined && vid?.likes > 0) return vid.likes;
    let hash = 0;
    const str = String(videoId || "video");
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 1200 + Math.abs(hash % 3800);
  };

  // Sync video metadata
  useEffect(() => {
    let isMounted = true;
    const fetchVideo = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/videos/${videoId}`);
        const json = await res.json();
        if (isMounted) {
          if (json.data) {
            setVideo(json.data);
          } else {
            const found = DEMO_VIDEOS.find((s) => s._id === videoId);
            if (found) setVideo(found);
          }
        }
      } catch (err) {
        if (isMounted) {
          const found = DEMO_VIDEOS.find((s) => s._id === videoId);
          if (found) setVideo(found);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVideo();
    return () => {
      isMounted = false;
    };
  }, [videoId]);

  // Restore persistent likes and liked status
  useEffect(() => {
    if (!videoId) return;

    // 1. Retrieve persisted like count
    const savedLikes = localStorage.getItem(`pulsecast_likes_${videoId}`);
    if (savedLikes !== null) {
      setLikes(parseInt(savedLikes, 10));
    } else {
      setLikes(getBaseLikes(video));
    }

    // 2. Retrieve user's specific liked status
    if (user?._id) {
      const userLiked = localStorage.getItem(`pulsecast_liked_${user._id}_${videoId}`) === "true";
      setHasLiked(userLiked);
    } else {
      setHasLiked(false);
    }
  }, [videoId, user?._id]);

  // Load channel subscription status
  useEffect(() => {
    if (!video) return;
    const channelKey = video?.owner?._id || video?.owner?.username || "default_channel";
    const savedSub = localStorage.getItem(`pulsecast_sub_${channelKey}`) === "true";
    setIsSubscribed(savedSub);

    const baseSubs = video?.owner?.subscribers || 14200;
    setSubscriberCount(savedSub ? baseSubs + 1 : baseSubs);
  }, [video]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
        <p className="text-xs text-slate-400">Loading video...</p>
      </div>
    );
  }

  // Determine media URL accurately for the current videoId
  const currentVideo = (video && String(video._id) === String(videoId))
    ? video
    : DEMO_VIDEOS.find((s) => s._id === videoId);

  const videoSrc = currentVideo?.videoFile?.startsWith("http")
    ? currentVideo.videoFile
    : currentVideo?.videoFile
    ? `http://localhost:8000${currentVideo.videoFile}`
    : "https://vjs.zencdn.net/v/oceans.mp4";

  const vttSrc = currentVideo?.storyboardVtt
    ? currentVideo.storyboardVtt.startsWith("http")
      ? currentVideo.storyboardVtt
      : `http://localhost:8000${currentVideo.storyboardVtt}`
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

  const handleLike = async () => {
    // Gating: only logged-in users can like
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    const nextHasLiked = !hasLiked;
    const nextLikes = nextHasLiked ? likes + 1 : Math.max(0, likes - 1);

    setHasLiked(nextHasLiked);
    setLikes(nextLikes);

    // Persist immediately in localStorage
    localStorage.setItem(`pulsecast_likes_${videoId}`, String(nextLikes));
    if (user?._id) {
      localStorage.setItem(`pulsecast_liked_${user._id}_${videoId}`, String(nextHasLiked));
    }

    // Synchronize to backend if token available
    if (token) {
      try {
        await fetch(`http://localhost:8000/api/v1/likes/toggle/v/${videoId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.warn("Backend like sync warning:", err);
      }
    }
  };

  const handleToggleSubscribe = async () => {
    const channelKey = video?.owner?._id || video?.owner?.username || "default_channel";
    const nextState = !isSubscribed;

    setIsSubscribed(nextState);
    setSubscriberCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    // Persist in localStorage
    localStorage.setItem(`pulsecast_sub_${channelKey}`, nextState.toString());

    // Send to backend API
    try {
      await fetch(`http://localhost:8000/api/v1/subscriptions/c/${channelKey}`, {
        method: "POST",
      });
    } catch (err) {
      // Offline fallback
    }
  };

  const formatSubscribers = (num) => {
    if (!num) return "0 subscribers";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M subscribers`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K subscribers`;
    return `${num} subscribers`;
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
                  <p className="text-xs text-slate-400">
                    {formatSubscribers(subscriberCount)}
                  </p>
                </div>

                {/* Working Subscribe Button */}
                <button
                  type="button"
                  id="subscribe-button"
                  onClick={handleToggleSubscribe}
                  className={`ml-3 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    isSubscribed
                      ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/10"
                      : "bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-md hover:scale-102"
                  }`}
                >
                  {isSubscribed ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Subscribed</span>
                    </>
                  ) : (
                    <span>Subscribe</span>
                  )}
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
            {DEMO_VIDEOS.filter((v) => v._id !== videoId).slice(0, 7).map((item) => (
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

      {/* Sign In Required Modal for Liking */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto shadow-inner">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Sign in to like this video</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Join PulseCast to like videos, save them to your library, and engage with creator communities.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => navigate(`/login?redirect=/watch/${videoId}&mode=login`)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer text-center"
              >
                Sign In
              </button>
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Watch;
