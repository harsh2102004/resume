import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import HlsPlayer from "../components/HlsPlayer";

export const Watch = () => {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [video, setVideo] = useState(location.state?.video || null);
  const [loading, setLoading] = useState(!location.state?.video);

  useEffect(() => {
    if (!video) {
      const fetchVideo = async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/v1/videos/${videoId}`);
          const json = await res.json();
          if (json.data) {
            setVideo(json.data);
          }
        } catch (err) {
          console.error("Failed to fetch video details:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchVideo();
    }
  }, [videoId, video]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Determine media URL
  const videoSrc = video?.videoFile?.startsWith("http")
    ? video.videoFile
    : video?.videoFile
    ? `http://localhost:8000${video.videoFile}`
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Video Player Section */}
      <HlsPlayer
        src={videoSrc}
        poster={video?.thumbnail}
        storyboardVtt={vttSrc}
      />

      {/* Video Metadata Header */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            {video?.title || "Video Stream"}
          </h1>
          <button
            onClick={handleStartWatchParty}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-orange-600/20 cursor-pointer self-start md:self-auto"
          >
            🍿 Start Watch Party
          </button>
        </div>

        {/* Creator Channel Bar */}
        <div className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-xl border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center font-bold text-white uppercase text-sm">
              {video?.owner?.fullName?.[0] || "P"}
            </div>
            <div>
              <p className="font-bold text-white text-sm">
                {video?.owner?.fullName || "PulseCast Channel"}
              </p>
              <p className="text-xs text-gray-400">
                @{video?.owner?.username || "pulsecast"}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p className="font-semibold text-white">
              {video?.views?.toLocaleString() || 0} views
            </p>
          </div>
        </div>

        {/* Description Box */}
        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {video?.description || "No description provided for this stream."}
        </div>
      </div>
    </div>
  );
};

export default Watch;
