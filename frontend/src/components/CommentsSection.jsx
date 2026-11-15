import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";

const formatTimeAgo = (dateString) => {
  if (!dateString) return "just now";
  const now = new Date();
  const date = new Date(dateString);
  const diffInSec = Math.max(1, Math.floor((now - date) / 1000));

  if (diffInSec < 60) return `${diffInSec}s ago`;
  const mins = Math.floor(diffInSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const CommentsSection = ({ videoId }) => {
  const { user, token, isAuthenticated } = useAuth();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [sortBy, setSortBy] = useState("top"); // "top" or "newest"
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Editing state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Load comments from API
  useEffect(() => {
    let isMounted = true;

    const fetchComments = async () => {
      if (!videoId) return;
      try {
        setLoading(true);
        const headers = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_BASE_URL}/api/v1/comments/${videoId}`, { headers });
        const data = await res.json();
        if (isMounted) {
          if (data.data?.docs) {
            setComments(data.data.docs);
          } else {
            setComments([]);
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Failed to load comments from server.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchComments();
    return () => {
      isMounted = false;
    };
  }, [videoId, token]);

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 4000);
  };

  // Add Comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    if (!isAuthenticated || !token) {
      showError("Please sign in to post a comment.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/comments/${videoId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to post comment");
      }

      setComments((prev) => [data.data, ...prev]);
      setNewComment("");
      setIsFocused(false);
    } catch (err) {
      showError(err.message || "Failed to post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Like / Unlike Comment
  const handleLike = async (commentId) => {
    if (!isAuthenticated || !token) {
      showError("Please sign in to like comments.");
      return;
    }

    // Save previous state for rollback
    const targetComment = comments.find((c) => c._id === commentId);
    if (!targetComment) return;

    const prevIsLiked = Boolean(targetComment.isLiked);
    const prevLikes = targetComment.likesCount ?? targetComment.likes ?? 0;
    const nextIsLiked = !prevIsLiked;
    const nextLikes = nextIsLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1);

    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c._id === commentId
          ? { ...c, isLiked: nextIsLiked, likesCount: nextLikes, likes: nextLikes }
          : c
      )
    );

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/likes/toggle/c/${commentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update comment like");
      }

      if (typeof data.data?.isLiked === "boolean") {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? {
                  ...c,
                  isLiked: data.data.isLiked,
                  likesCount: data.data.likesCount ?? nextLikes,
                  likes: data.data.likesCount ?? nextLikes,
                }
              : c
          )
        );
      }
    } catch (err) {
      // Rollback
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? { ...c, isLiked: prevIsLiked, likesCount: prevLikes, likes: prevLikes }
            : c
        )
      );
      showError(err.message || "Failed to update like.");
    }
  };

  // Start Editing
  const handleStartEdit = (comment) => {
    setEditingCommentId(comment._id);
    setEditingText(comment.content);
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText("");
  };

  // Save Edit Comment
  const handleSaveEdit = async (commentId) => {
    if (!editingText.trim()) return;

    setActionLoadingId(commentId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/comments/c/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editingText.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update comment");
      }

      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId ? { ...c, content: editingText.trim() } : c
        )
      );
      setEditingCommentId(null);
      setEditingText("");
    } catch (err) {
      showError(err.message || "Failed to save comment edits.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;

    setActionLoadingId(commentId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/comments/c/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete comment");
      }

      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      showError(err.message || "Failed to delete comment.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === "top") {
      const likesA = a.likesCount ?? a.likes ?? 0;
      const likesB = b.likesCount ?? b.likes ?? 0;
      return likesB - likesA;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="space-y-6 pt-6 border-t border-white/10">
      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage("")}
            className="text-red-400 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Comments Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h3 className="text-lg font-bold text-white">
            {comments.length} Comments
          </h3>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <button
              onClick={() => setSortBy("top")}
              className={`hover:text-white transition-colors cursor-pointer ${
                sortBy === "top" ? "text-white font-bold" : ""
              }`}
            >
              Top comments
            </button>
            <span>•</span>
            <button
              onClick={() => setSortBy("newest")}
              className={`hover:text-white transition-colors cursor-pointer ${
                sortBy === "newest" ? "text-white font-bold" : ""
              }`}
            >
              Newest first
            </button>
          </div>
        </div>
      </div>

      {/* Add Comment Input Box */}
      <form onSubmit={handleAddComment} className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
          {user?.fullName?.charAt(0) || "U"}
        </div>
        <div className="flex-1 space-y-2">
          <textarea
            rows={isFocused ? 3 : 1}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder={
              isAuthenticated
                ? "Add a comment..."
                : "Sign in to join the conversation..."
            }
            className="w-full bg-slate-900/80 text-white placeholder-slate-500 text-sm px-4 py-2.5 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 transition-all resize-none"
          />

          {isFocused && (
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsFocused(false);
                  setNewComment("");
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-md shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? "Posting..." : "Comment"}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Loading comments...
        </div>
      ) : sortedComments.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs">
          No comments yet. Be the first to start the conversation!
        </div>
      ) : (
        <div className="space-y-5 pt-2">
          {sortedComments.map((comment) => {
            const isAuthor = Boolean(
              user?._id &&
                (comment.owner?._id === user._id ||
                  comment.owner === user._id ||
                  (comment.owner?.username &&
                    user?.username &&
                    comment.owner.username === user.username))
            );
            const isEditing = editingCommentId === comment._id;
            const isActionLoading = actionLoadingId === comment._id;

            return (
              <div key={comment._id} className="flex gap-3 group">
                {/* Avatar */}
                {comment.owner?.avatar ? (
                  <img
                    src={comment.owner.avatar}
                    alt={comment.owner.fullName || "User"}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {comment.owner?.fullName?.charAt(0) || "U"}
                  </div>
                )}

                {/* Comment Body */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {comment.owner?.fullName || "User"}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        @{comment.owner?.username || "user"}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[11px] text-slate-400">
                        {formatTimeAgo(comment.createdAt)}
                      </span>
                    </div>

                    {/* Owner controls: Edit & Delete */}
                    {isAuthor && !isEditing && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEdit(comment)}
                          className="text-[11px] text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment._id)}
                          disabled={isActionLoading}
                          className="text-[11px] text-slate-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isActionLoading ? "..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Comment text or editing textarea */}
                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full bg-slate-900 text-white placeholder-slate-500 text-sm px-3 py-2 rounded-xl border border-indigo-500/80 focus:outline-none transition-all resize-none"
                        rows={2}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(comment._id)}
                          disabled={!editingText.trim() || isActionLoading}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isActionLoading ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}

                  {/* Like Button */}
                  <div className="flex items-center gap-4 pt-1 text-xs text-slate-400">
                    <button
                      onClick={() => handleLike(comment._id)}
                      className={`flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer ${
                        comment.isLiked ? "text-indigo-400 font-bold" : ""
                      }`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill={comment.isLiked ? "currentColor" : "none"}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                        />
                      </svg>
                      <span>{comment.likesCount ?? comment.likes ?? 0}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentsSection;
