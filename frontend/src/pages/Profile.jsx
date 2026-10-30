import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";

export const Profile = () => {
  const { username: paramUsername } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, token, isAuthenticated, logout } = useAuth();

  const isOwnProfile = !paramUsername || paramUsername === currentUser?.username;

  const [profileData, setProfileData] = useState(isOwnProfile ? currentUser : null);
  const [stats, setStats] = useState({
    totalSubscribers: 1,
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
  });
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("videos"); // "videos" | "about"
  const [copiedLink, setCopiedLink] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, videoId: null, videoTitle: "" });
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    let isMounted = true;

    const fetchProfileAndVideos = async () => {
      setLoading(true);
      try {
        const targetUsername = paramUsername || currentUser?.username;

        // 1. Fetch channel info
        if (targetUsername) {
          try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const channelRes = await fetch(
              `${API_BASE_URL}/api/v1/users/c/${targetUsername}`,
              { headers }
            );
            const channelJson = await channelRes.json();
            if (channelJson.data && isMounted) {
              setProfileData(channelJson.data);
            }
          } catch (err) {
            console.warn("Could not fetch channel profile:", err);
          }
        }

        // 2. If viewing own profile and authenticated, fetch dashboard stats & videos
        if (isOwnProfile && token) {
          try {
            const statsRes = await fetch(`${API_BASE_URL}/api/v1/dashboard/stats`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const statsJson = await statsRes.json();
            if (statsJson.data && isMounted) {
              setStats((prev) => ({ ...prev, ...statsJson.data }));
            }

            const videosRes = await fetch(`${API_BASE_URL}/api/v1/dashboard/videos`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const videosJson = await videosRes.json();
            if (videosJson.data?.docs && isMounted) {
              setVideos(videosJson.data.docs);
              setStats((prev) => ({
                ...prev,
                totalVideos: videosJson.data.docs.length,
                totalViews: videosJson.data.docs.reduce((sum, v) => sum + (v.views || 0), 0),
              }));
            }
          } catch (err) {
            console.warn("Dashboard stats fetch error:", err);
          }
        } else if (profileData?._id) {
          // Fetch public videos by userId
          try {
            const pubVideosRes = await fetch(
              `${API_BASE_URL}/api/v1/videos?userId=${profileData._id}`
            );
            const pubJson = await pubVideosRes.json();
            if (pubJson.data?.docs && isMounted) {
              setVideos(pubJson.data.docs);
            }
          } catch (err) {
            console.warn("Public videos fetch error:", err);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfileAndVideos();

    return () => {
      isMounted = false;
    };
  }, [paramUsername, currentUser?.username, token, isOwnProfile]);

  const handleCopyChannelLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Recently joined";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDeleteClick = (e, video) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      videoId: video._id,
      videoTitle: video.title || "Untitled Video",
    });
  };

  const confirmDeleteVideo = async () => {
    if (!deleteModal.videoId) return;
    setDeleting(true);
    setStatusMessage({ text: "", type: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/videos/${deleteModal.videoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete video");
      }

      setVideos((prev) => prev.filter((v) => v._id !== deleteModal.videoId));
      setStats((prev) => ({
        ...prev,
        totalVideos: Math.max(0, prev.totalVideos - 1),
      }));

      setStatusMessage({
        text: `"${deleteModal.videoTitle}" was successfully deleted.`,
        type: "success",
      });
      setTimeout(() => setStatusMessage({ text: "", type: "" }), 4000);
      setDeleteModal({ isOpen: false, videoId: null, videoTitle: "" });
    } catch (err) {
      setStatusMessage({
        text: err.message || "Failed to delete video. Please try again.",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  // If user is accessing /profile while logged out, show sign-in prompt
  if (isOwnProfile && !isAuthenticated && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[65vh] px-4">
        <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Sign In Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Please sign in to view your channel profile, subscriber counts, and uploaded video library.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Link
              to="/login?redirect=/profile&mode=login"
              className="glow-btn block w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/30"
            >
              Sign In to View Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeUser = profileData || currentUser || {};
  const subscriberDisplay = profileData?.subscribersCount !== undefined
    ? profileData.subscribersCount
    : stats.totalSubscribers;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Status Feedback Toast */}
      {statusMessage.text && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between shadow-xl transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === "success" ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage({ text: "", type: "" })}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header Banner & Identity */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-2xl">
        {/* Cover Banner */}
        <div className="h-44 sm:h-56 w-full relative bg-gradient-to-r from-indigo-950 via-slate-900 to-violet-950 overflow-hidden">
          {activeUser.coverImage ? (
            <img
              src={activeUser.coverImage}
              alt="Cover Banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"></div>
        </div>

        {/* Identity Row */}
        <div className="px-6 sm:px-10 pb-8 pt-0 relative flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-16 sm:-mt-20">
          {/* Avatar and Basic Info */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="relative flex-shrink-0">
              {activeUser.avatar ? (
                <img
                  src={activeUser.avatar}
                  alt={activeUser.fullName}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover ring-4 ring-slate-950 shadow-2xl border border-white/20 bg-slate-900"
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-indigo-500 to-violet-600 ring-4 ring-slate-950 shadow-2xl flex items-center justify-center text-white text-3xl font-black">
                  {activeUser.fullName?.charAt(0) || "U"}
                </div>
              )}
              <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-950 rounded-full shadow"></span>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {activeUser.fullName || activeUser.username || "PulseCast Creator"}
                </h1>
                <span className="text-indigo-400" title="Verified Creator">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                <span className="text-slate-300 font-mono">@{activeUser.username}</span>
                <span>•</span>
                <span>{subscriberDisplay} {subscriberDisplay === 1 ? "Subscriber" : "Subscribers"}</span>
                <span>•</span>
                <span>{videos.length} {videos.length === 1 ? "Video" : "Videos"}</span>
                {activeUser.email && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400 truncate max-w-[200px]">{activeUser.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2 md:pt-0">
            {isOwnProfile ? (
              <>
                <Link
                  to="/upload"
                  className="glow-btn px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Upload Video</span>
                </Link>
                <button
                  onClick={handleCopyChannelLink}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>{copiedLink ? "Copied!" : "Share"}</span>
                </button>
                <button
                  onClick={logout}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-red-950/60 hover:text-red-300 text-slate-400 text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
                  title="Sign out of your account"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={handleCopyChannelLink}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Share Channel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Uploaded Videos Card */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{videos.length}</p>
            <p className="text-xs text-slate-400 font-medium">Uploaded Videos</p>
          </div>
        </div>

        {/* Total Subscribers Card */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{subscriberDisplay}</p>
            <p className="text-xs text-slate-400 font-medium">Subscribers</p>
          </div>
        </div>

        {/* Total Views Card */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{stats.totalViews.toLocaleString()}</p>
            <p className="text-xs text-slate-400 font-medium">Channel Views</p>
          </div>
        </div>

        {/* Likes / Interaction Card */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{stats.totalLikes.toLocaleString()}</p>
            <p className="text-xs text-slate-400 font-medium">Likes Received</p>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs: Videos vs About */}
      <div className="border-b border-white/10 flex items-center gap-6">
        <button
          onClick={() => setActiveTab("videos")}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === "videos"
              ? "text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Uploaded Videos ({videos.length})</span>
          {activeTab === "videos" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab("about")}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === "about"
              ? "text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>About Channel</span>
          {activeTab === "about" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>
          )}
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === "videos" ? (
        /* VIDEOS TAB */
        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-2xl p-3 space-y-3">
                  <div className="aspect-video rounded-xl bg-slate-800/60 animate-shimmer"></div>
                  <div className="h-4 bg-slate-800/80 rounded w-3/4 animate-shimmer"></div>
                  <div className="h-3 bg-slate-800/50 rounded w-1/2 animate-shimmer"></div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            /* Empty State */
            <div className="glass-panel rounded-3xl p-16 text-center space-y-5 border border-white/5">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-inner">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">No videos uploaded yet</h3>
                <p className="text-slate-400 text-xs max-w-sm mx-auto">
                  {isOwnProfile
                    ? "Upload your first video to start building your audience on PulseCast."
                    : "This creator has not published any videos yet."}
                </p>
              </div>
              {isOwnProfile && (
                <Link
                  to="/upload"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Upload Your First Video</span>
                </Link>
              )}
            </div>
          ) : (
            /* Videos Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div
                  key={video._id}
                  className="group glass-card rounded-2xl overflow-hidden flex flex-col justify-between border border-white/5 hover:border-indigo-500/40 transition-all duration-300 relative"
                >
                  <Link
                    to={`/watch/${video._id}`}
                    state={{ video }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail */}
                      <div className="relative aspect-video overflow-hidden bg-slate-950">
                        <img
                          src={video.thumbnail || "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800"}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-40 group-hover:opacity-20 transition-opacity"></div>

                        {/* Play Hover Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                            <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>

                        {/* Duration Badge */}
                        {video.duration ? (
                          <span className="absolute bottom-2.5 right-2.5 bg-black/85 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded-md font-medium">
                            {formatDuration(video.duration)}
                          </span>
                        ) : null}
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2">
                        <h3 className="font-bold text-white text-sm line-clamp-2 group-hover:text-indigo-400 transition-colors leading-snug">
                          {video.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {video.description}
                        </p>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-4 pt-0 flex items-center justify-between text-xs text-slate-400 border-t border-white/5 mt-2">
                      <span>{(video.views || 0).toLocaleString()} views</span>
                      <span>{formatDate(video.createdAt)}</span>
                    </div>
                  </Link>

                  {/* Delete Button for channel owner */}
                  {isOwnProfile && (
                    <button
                      type="button"
                      title="Delete Video"
                      onClick={(e) => handleDeleteClick(e, video)}
                      className="absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-xl bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-xl transition-all transform hover:scale-110 opacity-80 hover:opacity-100 backdrop-blur-md cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ABOUT TAB */
        <div className="glass-panel p-8 rounded-3xl border border-white/5 space-y-6 max-w-3xl">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Channel Description</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Welcome to {activeUser.fullName || activeUser.username}'s official PulseCast streaming channel.
              Here you can discover high-definition video productions, real-time sync watch rooms, and engineering media showcases.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Channel Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <span className="text-slate-400">Username</span>
                <p className="text-white font-mono font-semibold">@{activeUser.username}</p>
              </div>

              {activeUser.email && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                  <span className="text-slate-400">Contact Email</span>
                  <p className="text-white font-medium">{activeUser.email}</p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <span className="text-slate-400">Subscribers</span>
                <p className="text-white font-semibold">{subscriberDisplay} subscribers</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <span className="text-slate-400">Total Videos</span>
                <p className="text-white font-semibold">{videos.length} videos published</p>
              </div>
            </div>
          </div>
        </div>
      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Delete Video?</h3>
                <p className="text-xs text-slate-400">
                  This video will be permanently removed from your channel.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5">
              <p className="text-xs text-slate-400 mb-1">Target Video:</p>
              <p className="text-sm font-semibold text-white line-clamp-2">
                {deleteModal.videoTitle}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteModal({ isOpen: false, videoId: null, videoTitle: "" })}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteVideo}
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
    </div>
  );
};

export default Profile;
