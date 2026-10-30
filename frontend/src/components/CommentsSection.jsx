import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";

const INITIAL_COMMENTS = {
  "demo-hls-video": [
    {
      _id: "c1",
      owner: {
        fullName: "Marcus Vance",
        username: "marcus_v",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      },
      content: "The 1080p stream quality and frame pacing here is buttery smooth! Zero buffering when skipping ahead.",
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      likes: 24,
      dislikes: 0,
      userLiked: false,
      userDisliked: false,
    },
    {
      _id: "c2",
      owner: {
        fullName: "Sarah Chen",
        username: "sarahc",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      },
      content: "Watched this with friends in the watch party room. Play and pause were totally in sync for all of us, loved it!",
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      likes: 15,
      dislikes: 1,
      userLiked: false,
      userDisliked: false,
    },
    {
      _id: "c3",
      owner: {
        fullName: "David Miller",
        username: "dmiller",
        avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
      },
      content: "Classic Big Buck Bunny animation! The video player UI looks very sleek and modern.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      likes: 8,
      dislikes: 0,
      userLiked: false,
      userDisliked: false,
    },
  ],
  "demo-sample-2": [
    {
      _id: "c4",
      owner: {
        fullName: "Elena Rostova",
        username: "elena_r",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
      },
      content: "The colors in the 4K landscape are breathtaking! Perfect relaxation video.",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      likes: 19,
      dislikes: 0,
      userLiked: false,
      userDisliked: false,
    },
  ],
};

const formatTimeAgo = (dateString) => {
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
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [sortBy, setSortBy] = useState("top"); // "top" or "newest"
  const [submitting, setSubmitting] = useState(false);
  const [replyOpenId, setReplyOpenId] = useState(null);
  const [replyText, setReplyText] = useState("");

  // Load comments
  useEffect(() => {
    const fetchComments = async () => {
      // 1. Check local storage first for user-added comments
      const localKey = `pulsecast_comments_${videoId}`;
      const saved = localStorage.getItem(localKey);
      let initialList = [];

      if (saved) {
        try {
          initialList = JSON.parse(saved);
        } catch (e) {
          initialList = INITIAL_COMMENTS[videoId] || [];
        }
      } else {
        initialList = INITIAL_COMMENTS[videoId] || [
          {
            _id: "default-1",
            owner: {
              fullName: "Jordan Lee",
              username: "jordan_l",
              avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
            },
            content: "Great stream! Looking forward to more content.",
            createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
            likes: 6,
            dislikes: 0,
            userLiked: false,
            userDisliked: false,
          },
        ];
      }

      // Try fetching from backend API
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/comments/${videoId}`);
        const data = await res.json();
        if (data.data?.docs && data.data.docs.length > 0) {
          // Merge backend comments with local
          const backendList = data.data.docs.map((doc) => ({
            _id: doc._id,
            owner: doc.owner || { fullName: "Viewer", username: "viewer" },
            content: doc.content,
            createdAt: doc.createdAt,
            likes: doc.likes || 0,
            dislikes: 0,
            userLiked: false,
            userDisliked: false,
          }));
          setComments([...backendList, ...initialList]);
          return;
        }
      } catch (err) {
        // Fallback to local
      }

      setComments(initialList);
    };

    fetchComments();
  }, [videoId]);

  const saveLocalComments = (list) => {
    setComments(list);
    try {
      localStorage.setItem(`pulsecast_comments_${videoId}`, JSON.stringify(list));
    } catch (e) {}
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const commentItem = {
      _id: `c_${Date.now()}`,
      owner: {
        fullName: "You",
        username: "user",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      },
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      dislikes: 0,
      userLiked: false,
      userDisliked: false,
    };

    // Attempt backend save
    try {
      await fetch(`${API_BASE_URL}/api/v1/comments/${videoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
    } catch (err) {
      // Offline fallback
    }

    const updated = [commentItem, ...comments];
    saveLocalComments(updated);
    setNewComment("");
    setIsFocused(false);
    setSubmitting(false);
  };

  const handleLike = (commentId) => {
    const updated = comments.map((c) => {
      if (c._id === commentId) {
        const wasLiked = c.userLiked;
        return {
          ...c,
          userLiked: !wasLiked,
          likes: wasLiked ? c.likes - 1 : c.likes + 1,
          userDisliked: false,
        };
      }
      return c;
    });
    saveLocalComments(updated);
  };

  const handleDislike = (commentId) => {
    const updated = comments.map((c) => {
      if (c._id === commentId) {
        const wasDisliked = c.userDisliked;
        return {
          ...c,
          userDisliked: !wasDisliked,
          userLiked: false,
          likes: c.userLiked ? c.likes - 1 : c.likes,
        };
      }
      return c;
    });
    saveLocalComments(updated);
  };

  const handleAddReply = (commentId) => {
    if (!replyText.trim()) return;

    const replyItem = {
      _id: `r_${Date.now()}`,
      owner: {
        fullName: "You",
        username: "user",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      },
      content: replyText.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    const updated = comments.map((c) => {
      if (c._id === commentId) {
        return {
          ...c,
          replies: [...(c.replies || []), replyItem],
        };
      }
      return c;
    });

    saveLocalComments(updated);
    setReplyText("");
    setReplyOpenId(null);
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === "top") return (b.likes || 0) - (a.likes || 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="space-y-6 pt-6 border-t border-white/10">
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
          Y
        </div>
        <div className="flex-1 space-y-2">
          <textarea
            rows={isFocused ? 3 : 1}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Add a comment..."
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
      <div className="space-y-5 pt-2">
        {sortedComments.map((comment) => (
          <div key={comment._id} className="flex gap-3 group">
            {/* Avatar */}
            {comment.owner?.avatar ? (
              <img
                src={comment.owner.avatar}
                alt={comment.owner.fullName}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {comment.owner?.fullName?.charAt(0) || "U"}
              </div>
            )}

            {/* Comment Body */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  {comment.owner?.fullName || "Viewer"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  @{comment.owner?.username || "user"}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[11px] text-slate-400">
                  {formatTimeAgo(comment.createdAt)}
                </span>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>

              {/* Action Buttons: Like, Dislike, Reply */}
              <div className="flex items-center gap-4 pt-1 text-xs text-slate-400">
                {/* Like */}
                <button
                  onClick={() => handleLike(comment._id)}
                  className={`flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer ${
                    comment.userLiked ? "text-indigo-400 font-bold" : ""
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill={comment.userLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  <span>{comment.likes || 0}</span>
                </button>

                {/* Dislike */}
                <button
                  onClick={() => handleDislike(comment._id)}
                  className={`hover:text-white transition-colors cursor-pointer ${
                    comment.userDisliked ? "text-indigo-400 font-bold" : ""
                  }`}
                >
                  <svg className="w-3.5 h-3.5 rotate-180" fill={comment.userDisliked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>

                {/* Reply */}
                <button
                  onClick={() => setReplyOpenId(replyOpenId === comment._id ? null : comment._id)}
                  className="hover:text-white font-medium transition-colors cursor-pointer"
                >
                  Reply
                </button>
              </div>

              {/* Inline Reply Box */}
              {replyOpenId === comment._id && (
                <div className="pt-2 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 bg-slate-900 text-white placeholder-slate-500 text-xs px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleAddReply(comment._id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Reply
                  </button>
                </div>
              )}

              {/* Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="pl-4 pt-2 space-y-2 border-l border-white/10">
                  {comment.replies.map((reply) => (
                    <div key={reply._id} className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {reply.owner.fullName.charAt(0)}
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white mr-1.5">{reply.owner.fullName}</span>
                        <span className="text-slate-400">{reply.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentsSection;
