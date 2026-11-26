import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import HlsPlayer from "../components/HlsPlayer";
import CommentsSection from "../components/CommentsSection";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";

export const Watch = () => {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, isAuthenticated, authFetch } = useAuth();

  const [video, setVideo] = useState(
    location.state?.video?._id === videoId ? location.state.video : null
  );
  const [loading, setLoading] = useState(!video);
  const [likes, setLikes] = useState(video?.likesCount ?? 0);
  const [hasLiked, setHasLiked] = useState(Boolean(video?.isLiked));
  const [isSubscribed, setIsSubscribed] = useState(Boolean(video?.isSubscribed));
  const [subscriberCount, setSubscriberCount] = useState(video?.subscribersCount ?? 0);
  const [upNextVideos, setUpNextVideos] = useState([]);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Sync video metadata from server
  useEffect(() => {
    let isMounted = true;
    const fetchVideo = async () => {
      try {
        const headers = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_BASE_URL}/api/v1/videos/${videoId}`, { headers });
        const json = await res.json();
        if (isMounted && json.data) {
          setVideo(json.data);
          setLikes(json.data.likesCount ?? 0);
          setHasLiked(Boolean(json.data.isLiked));
          setIsSubscribed(Boolean(json.data.isSubscribed));
          setSubscriberCount(json.data.subscribersCount ?? 0);
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Failed to load video details");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVideo();
    return () => {
      isMounted = false;
    };
  }, [videoId, token]);

  // Poll for transcoding completion when a newly uploaded video is PENDING or PROCESSING
  useEffect(() => {
    const status = video?.transcodingStatus;
    if (!videoId || (status !== "PENDING" && status !== "PROCESSING")) return;

    let isMounted = true;
    const intervalId = setInterval(async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/api/v1/videos/${videoId}`, { headers });
        const json = await res.json();
        if (isMounted && json.data) {
          setVideo(json.data);
        }
      } catch {
        // Ignore transient polling errors
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [videoId, token, video?.transcodingStatus]);

  // Load Up Next videos from server
  useEffect(() => {
    let isMounted = true;
    const fetchUpNext = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/videos?limit=10`);
        const json = await res.json();
        const docs = json.data?.docs || [];
        if (isMounted) {
          setUpNextVideos(docs.filter((v) => String(v._id) !== String(videoId)));
        }
      } catch {
        if (isMounted) setUpNextVideos([]);
      }
    };

    fetchUpNext();
    return () => {
      isMounted = false;
    };
  }, [videoId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
        <p className="text-xs text-slate-400">Loading video...</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="glass-panel rounded-3xl p-16 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Video not found</h3>
        <p className="text-slate-400 text-sm">
          The requested video could not be loaded or does not exist.
        </p>
        <Link
          to="/"
          className="inline-block px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 font-medium transition-colors"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const preferredSrc = video.hlsPath || video.videoFile;
  const videoSrc = preferredSrc?.startsWith("http")
    ? preferredSrc
    : preferredSrc
    ? `${API_BASE_URL}${preferredSrc}`
    : "https://vjs.zencdn.net/v/oceans.mp4";

  const vttSrc = video.storyboardVtt
    ? video.storyboardVtt.startsWith("http")
      ? video.storyboardVtt
      : `${API_BASE_URL}${video.storyboardVtt}`
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
    if (!isAuthenticated || !token) {
      setShowAuthModal(true);
      return;
    }

    const prevHasLiked = hasLiked;
    const prevLikes = likes;
    const nextHasLiked = !prevHasLiked;
    const nextLikes = nextHasLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1);

    // Optimistic UI update
    setHasLiked(nextHasLiked);
    setLikes(nextLikes);

    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn(`${API_BASE_URL}/api/v1/likes/toggle/v/${videoId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        setShowAuthModal(true);
        throw new Error("Session expired. Please sign in to like this video.");
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update like status");
      }
      // Server response as source of truth
      if (typeof data.data?.isLiked === "boolean") {
        setHasLiked(data.data.isLiked);
      }
      if (typeof data.data?.likesCount === "number") {
        setLikes(data.data.likesCount);
      }
    } catch (err) {
      // Rollback on failure
      setHasLiked(prevHasLiked);
      setLikes(prevLikes);
      setErrorMessage(err.message || "Failed to like video. Please try again.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleToggleSubscribe = async () => {
    if (!isAuthenticated || !token) {
      setShowAuthModal(true);
      return;
    }

    const channelId = video?.owner?._id || video?.owner;
    if (!channelId) return;

    if (user?._id && String(channelId) === String(user._id)) {
      setErrorMessage("You cannot subscribe to your own channel");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    const prevIsSubscribed = isSubscribed;
    const prevCount = subscriberCount;
    const nextState = !prevIsSubscribed;

    // Optimistic UI update
    setIsSubscribed(nextState);
    setSubscriberCount(nextState ? prevCount + 1 : Math.max(0, prevCount - 1));

    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn(`${API_BASE_URL}/api/v1/subscriptions/c/${channelId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        setShowAuthModal(true);
        throw new Error("Session expired. Please sign in to subscribe.");
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update subscription");
      }
      if (typeof data.data?.isSubscribed === "boolean") {
        setIsSubscribed(data.data.isSubscribed);
      }
      if (typeof data.data?.subscribersCount === "number") {
        setSubscriberCount(data.data.subscribersCount);
      }
    } catch (err) {
      // Rollback on failure
      setIsSubscribed(prevIsSubscribed);
      setSubscriberCount(prevCount);
      setErrorMessage(err.message || "Failed to update subscription. Please try again.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const formatSubscribers = (num) => {
    if (!num) return "0 subscribers";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M subscribers`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K subscribers`;
    return `${num} subscribers`;
  };

  const isOwner = Boolean(
    user?._id &&
      (video?.owner?._id === user._id ||
        video?.owner === user._id ||
        (video?.owner?.username && user?.username && video.owner.username === user.username))
  );

  const handleDeleteVideo = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const fetchFn = authFetch || fetch;
      const res = await fetchFn(`${API_BASE_URL}/api/v1/videos/${videoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete video");
      }
      navigate("/profile");
    } catch (err) {
      setDeleteError(err.message || "Failed to delete video.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between animate-fade-in">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage("")}
            className="text-red-400 hover:text-white font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

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
                <Link
                  to={video?.owner?.username ? `/channel/${video.owner.username}` : "/profile"}
                  className="flex items-center gap-3 group cursor-pointer"
                  title="View creator channel & videos"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:ring-2 group-hover:ring-indigo-500/70 transition-all overflow-hidden">
                    {video?.owner?.avatar ? (
                      <img
                        src={video.owner.avatar}
                        alt={video.owner.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      video?.owner?.fullName?.charAt(0) || "P"
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">
                      {video?.owner?.fullName || "PulseCast Channel"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {formatSubscribers(subscriberCount)}
                    </p>
                  </div>
                </Link>

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
                  <span>👥</span>
                  <span>Watch Party</span>
                </button>

                {/* Delete Video Button for Owner */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 transition-all cursor-pointer shadow-sm"
                    title="Delete this video from your channel"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>

            {/* Description Box */}
            <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold flex-wrap">
                <span className="text-white">{(video?.views || 0).toLocaleString()} views</span>
                <span>•</span>
                <span>Published on PulseCast</span>
                {video?.transcodingStatus &&
                  video.transcodingStatus !== "COMPLETED" &&
                  (!video.videoFile?.startsWith("http") || video.transcodingStatus === "PROCESSING") && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                      <span>
                        {video.transcodingStatus === "FAILED"
                          ? "Transcode Failed"
                          : `Processing… ${video.transcodeProgress || 0}%`}
                      </span>
                    </span>
                  </>
                )}
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

          {upNextVideos.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 text-center text-xs text-slate-500">
              No other videos available yet
            </div>
          ) : (
            <div className="space-y-3">
              {upNextVideos.slice(0, 7).map((item) => (
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
                      src={item.thumbnail || "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800"}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {item.duration ? (
                      <span className="absolute bottom-1 right-1 bg-black/85 text-[10px] px-1 py-0.2 rounded text-white font-medium">
                        {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden">
                    <h4 className="text-xs font-bold text-white line-clamp-2 group-hover:text-indigo-400 transition-colors">
                      {item.title}
                    </h4>
                    <div className="text-[11px] text-slate-400">
                      <p className="truncate">{item.owner?.fullName || "Creator"}</p>
                      <p>{item.views || 0} views</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Watch Party Callout */}
          <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
              <span className="text-base">👥</span>
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

      {/* Sign In Required Modal */}
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
              <h3 className="text-lg font-bold text-white">Sign in required</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Join PulseCast to like videos, subscribe to channels, and engage with creators.
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

      {/* Delete Confirmation Modal for Video Owner */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Delete this video?</h3>
                <p className="text-xs text-slate-400">
                  This video will be permanently removed from your channel and storage.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5">
              <p className="text-xs text-slate-400 mb-1">Target Video:</p>
              <p className="text-sm font-semibold text-white line-clamp-2">
                {video?.title || "Untitled Video"}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteVideo}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast message={errorMessage} onClose={() => setErrorMessage("")} />
    </div>
  );
};

export default Watch;
