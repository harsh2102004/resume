import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { TusUploader } from "../utils/tusUploader";

export const Upload = () => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const uploaderRef = useRef(null);

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
      setErrorMessage("Please select a video file to upload.");
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
        setErrorMessage(err.message || "Upload failed. Ready to resume.");
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
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Resumable Video Upload
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Powered by the open <strong>TUS protocol</strong>. Multi-gigabyte uploads with automatic byte-offset resume on network drops.
        </p>
      </div>

      {uploadSuccess ? (
        <div className="p-8 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-white">Upload Complete!</h2>
          <p className="text-sm text-gray-300">
            Your video was received and HLS multi-bitrate transcoding has started in the background.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Back to Home Feed
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStartUpload} className="space-y-6 bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-xl">
          {/* File Picker / Dropzone */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Select Video File
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-500 cursor-pointer bg-gray-900/50 p-2 rounded-xl border border-gray-800"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Systems Masterclass"
              disabled={isUploading}
              className="w-full bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a brief summary of your stream..."
              disabled={isUploading}
              className="w-full bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Active Upload Progress Bar */}
          {isUploading || uploadProgress > 0 ? (
            <div className="space-y-3 p-4 bg-gray-900 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">
                  {isPaused ? "Upload Paused" : "Uploading in 2MB chunks..."}
                </span>
                <span className="font-mono text-orange-400 font-bold">{uploadProgress}%</span>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-600 to-amber-400 h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
                <span>
                  {formatFileSize(loadedBytes)} of {formatFileSize(totalBytes)}
                </span>
                <div className="flex gap-2">
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={handleResume}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      ▶ Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      ⏸ Pause
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {errorMessage && (
            <div className="p-3 bg-red-950/50 border border-red-500/30 text-red-300 text-xs rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Submit Button */}
          {!isUploading && !uploadSuccess && (
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-orange-600/20 cursor-pointer"
            >
              Start Resumable Upload
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default Upload;
