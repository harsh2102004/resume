import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { TusUploader } from "../utils/tusUploader";

export const Upload = () => {
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
      setErrorMessage("Please choose or drop a video file to upload.");
      return;
    }

    setErrorMessage("");
    setIsUploading(true);
    setIsPaused(false);
    setUploadSuccess(false);

    const uploader = new TusUploader(file, {
      endpoint: "http://localhost:8000/api/v1/videos/resumable-upload",
      chunkSize: 2 * 1024 * 1024, // 2MB chunking
      metadata: {
        filename: file.name,
        filetype: file.type || "video/mp4",
        title: title || file.name,
        description: description || "Uploaded via TUS Resumable Protocol",
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
        setErrorMessage(err.message || "Upload disconnected. Ready to resume from byte offset.");
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
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Page Title & Tech Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
            Resumable Chunk Pipeline
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Ingest Media Stream</h1>
          <p className="text-sm text-slate-400 mt-1">
            Byte-level chunking conforming to open TUS v1.0.0 protocol with crash-recovery and zero server RAM blowup.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300">
          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          Chunk Size: 2 MB Fixed
        </div>
      </div>

      {uploadSuccess ? (
        <div className="glass-panel p-10 rounded-3xl border border-emerald-500/30 text-center space-y-5 shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-lg shadow-emerald-500/20">
            ✓
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Stream Ingested Successfully!</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Your file has been stored and registered. The asynchronous FFmpeg transcoding worker has been dispatched to generate multi-bitrate HLS segments.
            </p>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <Link
              to="/"
              className="glow-btn px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all"
            >
              Explore Stream Feed
            </Link>
            <button
              onClick={() => {
                setUploadSuccess(false);
                setFile(null);
                setTitle("");
                setDescription("");
                setUploadProgress(0);
              }}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors"
            >
              Ingest Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStartUpload} className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all p-8 text-center ${
              dragActive
                ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
                : file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-700/80 hover:border-slate-600 bg-slate-900/40"
            }`}
          >
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {file ? file.name : "Drag and drop your video file here, or browse"}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {file ? `${formatFileSize(file.size)} • ${file.type || "video/mp4"}` : "Supports MP4, MOV, MKV, WebM up to 5GB"}
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Stream Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Consensus in Raft — Architecture & Benchmark"
                disabled={isUploading}
                className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Description & Manifest Metadata
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the video content and bitrate characteristics..."
                disabled={isUploading}
                className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          {/* Active Upload Live Progress Panel */}
          {(isUploading || uploadProgress > 0) && (
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-indigo-500/30 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`}></span>
                  {isPaused ? "Ingestion Paused" : "Uploading in 2MB Resumable Chunks..."}
                </span>
                <span className="font-mono text-indigo-400 font-bold text-sm">{uploadProgress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 font-mono pt-1">
                <span>
                  {formatFileSize(loadedBytes)} / {formatFileSize(totalBytes)}
                </span>
                <div className="flex gap-2">
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={handleResume}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold text-xs cursor-pointer shadow transition-all"
                    >
                      ▶ Resume Offset
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg font-bold text-xs cursor-pointer shadow transition-all"
                    >
                      ⏸ Pause Stream
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-red-950/60 border border-red-500/40 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Action */}
          {!isUploading && !uploadSuccess && (
            <button
              type="submit"
              disabled={!file}
              className="glow-btn w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold text-sm py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed"
            >
              Start Chunk Ingestion (TUS)
            </button>
          )}
        </form>
      )}

      {/* Pipeline Technical Diagram */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
          Asynchronous Transcoding Pipeline Architecture
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-indigo-400 font-mono font-bold">Step 1</span>
            <p className="font-semibold text-white">TUS Protocol Ingest</p>
            <p className="text-[11px] text-slate-400">2MB chunk verification with continuous byte-offset handshake.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-violet-400 font-mono font-bold">Step 2</span>
            <p className="font-semibold text-white">FFmpeg Transcoding</p>
            <p className="text-[11px] text-slate-400">Multi-variant ladder: 1080p, 720p, 480p, 360p with .ts segments.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-pink-400 font-mono font-bold">Step 3</span>
            <p className="font-semibold text-white">Storyboard Sprites</p>
            <p className="text-[11px] text-slate-400">100-frame mosaic generation and WebVTT coordinate mapping.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-mono font-bold">Step 4</span>
            <p className="font-semibold text-white">Signed Delivery</p>
            <p className="text-[11px] text-slate-400">HMAC-SHA256 authenticated playback URL generation.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
