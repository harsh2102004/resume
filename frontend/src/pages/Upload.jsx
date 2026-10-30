import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { TusUploader } from "../utils/tusUploader";
import { API_BASE_URL } from "../config/api";

export const Upload = () => {
  const { isAuthenticated, token, user } = useAuth();

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const uploaderRef = useRef(null);

  // If not logged in, show authentication barrier
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[65vh] px-4">
        <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Sign In Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              You must be signed in to your PulseCast account to upload videos and publish streams.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              to="/login?redirect=/upload&mode=login"
              className="glow-btn block w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/30"
            >
              Sign In to Upload
            </Link>
            <Link
              to="/login?redirect=/upload&mode=signup"
              className="block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-white/10 transition-colors"
            >
              Create New Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleStartUpload = (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select or drop a video file to upload.");
      return;
    }

    setErrorMessage("");
    setIsUploading(true);
    setIsPaused(false);
    setUploadSuccess(false);

    const uploader = new TusUploader(file, {
      endpoint: `${API_BASE_URL}/api/v1/videos/resumable-upload`,
      chunkSize: 2 * 1024 * 1024,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      metadata: {
        filename: file.name,
        filetype: file.type || "video/mp4",
        title: title || file.name,
        description: description || "",
        userId: user?._id || "",
      },
      onProgress: ({ percentage, loaded, total }) => {
        setUploadProgress(percentage);
        setLoadedBytes(loaded);
        setTotalBytes(total);
      },
      onSuccess: () => {
        setIsUploading(false);
        setUploadSuccess(true);
      },
      onError: (err) => {
        setIsUploading(false);
        setErrorMessage(err.message || "Upload interrupted. Click resume to continue.");
      },
    });

    uploaderRef.current = uploader;
    uploader.start();
  };

  const handlePause = () => {
    if (uploaderRef.current) {
      uploaderRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (uploaderRef.current) {
      uploaderRef.current.resume();
      setIsPaused(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Page Title & User Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Upload Video</h1>
          <p className="text-sm text-slate-400 mt-1">
            Publish your video to PulseCast with automatic multi-bitrate processing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-white/5 text-xs text-slate-300">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white">
            {user?.fullName?.charAt(0) || "U"}
          </div>
          <span>Uploading as <strong className="text-white">{user?.username}</strong></span>
        </div>
      </div>

      {uploadSuccess ? (
        <div className="glass-panel p-10 rounded-2xl border border-emerald-500/30 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-3xl mx-auto">
            ✓
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Upload Complete</h2>
            <p className="text-sm text-slate-300">
              Your video has been uploaded and registered to your channel.
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/"
              className="px-6 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-200 font-bold text-sm transition-all"
            >
              Go to Home Feed
            </Link>
            <button
              onClick={() => {
                setUploadSuccess(false);
                setFile(null);
                setTitle("");
                setDescription("");
                setUploadProgress(0);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
            >
              Upload Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStartUpload} className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all p-8 text-center ${
              dragActive
                ? "border-indigo-400 bg-indigo-500/10"
                : file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-700 hover:border-slate-600 bg-slate-900/40"
            }`}
          >
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white">
                {file ? file.name : "Select video to upload"}
              </p>
              <p className="text-xs text-slate-400">
                {file ? `${formatFileSize(file.size)}` : "Or drag and drop video files"}
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title that describes your video"
                disabled={isUploading}
                required
                className="w-full bg-slate-900 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell viewers about your video"
                disabled={isUploading}
                className="w-full bg-slate-900 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Active Upload Live Progress Panel */}
          {(isUploading || uploadProgress > 0) && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">
                  {isPaused ? "Upload Paused" : "Uploading..."}
                </span>
                <span className="text-indigo-400 font-bold">{uploadProgress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                <span>
                  {formatFileSize(loadedBytes)} of {formatFileSize(totalBytes)}
                </span>
                <div className="flex gap-2">
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={handleResume}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold text-xs cursor-pointer"
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="text-amber-400 hover:text-amber-300 font-semibold text-xs cursor-pointer"
                    >
                      Pause
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 text-red-300 text-xs rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Submit Action */}
          {!isUploading && !uploadSuccess && (
            <button
              type="submit"
              disabled={!file}
              className="glow-btn w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed"
            >
              Upload Video
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default Upload;
