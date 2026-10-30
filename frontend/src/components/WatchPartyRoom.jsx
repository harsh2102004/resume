import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import HlsPlayer from "./HlsPlayer";

export const WatchPartyRoom = ({
  roomId = "demo-room",
  username = "GuestUser",
  videoSrc = "http://localhost:8000/api/v1/videos/stream/sample",
  storyboardVtt = null,
  poster = null,
}) => {
  const socketRef = useRef(null);
  const isRemoteActionRef = useRef(false);
  const videoElementRef = useRef(null);

  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState("");
  const [syncStatus, setSyncStatus] = useState("Connected");
  const [driftMs, setDriftMs] = useState(0);

  useEffect(() => {
    // Connect to Watch Party namespace
    const socket = io("http://localhost:8000/watch-party", {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSyncStatus("Synchronized");
      socket.emit("join-room", { roomId, username });
    });

    // Receive initial room state
    socket.on("room-state", (state) => {
      setParticipants(state.participants || []);
      const video = document.querySelector("video");
      if (video && typeof state.currentTime === "number") {
        video.currentTime = state.currentTime;
        if (state.isPlaying) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    });

    // Remote user actions (PLAY, PAUSE, SEEK)
    socket.on("sync-action", ({ action, currentTime, senderName, serverTimestamp }) => {
      const video = document.querySelector("video");
      if (!video) return;

      isRemoteActionRef.current = true;
      const latencySeconds = Math.max(0, (Date.now() - serverTimestamp) / 1000);

      if (action === "PLAY") {
        video.currentTime = currentTime + latencySeconds;
        video.play().catch(() => {});
      } else if (action === "PAUSE") {
        video.currentTime = currentTime;
        video.pause();
      } else if (action === "SEEK") {
        video.currentTime = currentTime;
      }

      setTimeout(() => {
        isRemoteActionRef.current = false;
      }, 150);
    });

    // Drift correction heartbeat response
    socket.on("heartbeat-ack", ({ serverTime, isPlaying }) => {
      const video = document.querySelector("video");
      if (!video || !isPlaying) return;

      const drift = video.currentTime - serverTime;
      const absDrift = Math.abs(drift);
      setDriftMs(Math.round(absDrift * 1000));

      if (absDrift > 1.5) {
        // Hard snap if drift is > 1.5 seconds
        video.currentTime = serverTime;
        video.playbackRate = 1.0;
        setSyncStatus("Hard Resync");
      } else if (absDrift > 0.15) {
        // Soft rate adjust (drift compensation)
        video.playbackRate = drift < 0 ? 1.05 : 0.95;
        setSyncStatus(`Compensating (${Math.round(absDrift * 1000)}ms)`);
      } else {
        video.playbackRate = 1.0;
        setSyncStatus("Synchronized (<50ms)");
      }
    });

    // User presence updates
    socket.on("user-joined", ({ user, participants }) => {
      setParticipants(participants);
    });

    socket.on("user-left", ({ participants }) => {
      setParticipants(participants);
    });

    // Live chat message received
    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Periodic heartbeat for drift measurement
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat-query");
      }
    }, 3000);

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, [roomId, username]);

  // Handle local video playback events to broadcast to peers
  const handleLocalPlay = () => {
    if (isRemoteActionRef.current) return;
    const video = document.querySelector("video");
    if (socketRef.current && video) {
      socketRef.current.emit("sync-action", {
        action: "PLAY",
        currentTime: video.currentTime,
      });
    }
  };

  const handleLocalPause = () => {
    if (isRemoteActionRef.current) return;
    const video = document.querySelector("video");
    if (socketRef.current && video) {
      socketRef.current.emit("sync-action", {
        action: "PAUSE",
        currentTime: video.currentTime,
      });
    }
  };

  const handleLocalSeeked = () => {
    if (isRemoteActionRef.current) return;
    const video = document.querySelector("video");
    if (socketRef.current && video) {
      socketRef.current.emit("sync-action", {
        action: "SEEK",
        currentTime: video.currentTime,
      });
    }
  };

  // Wire video DOM event listeners for play/pause/seek
  useEffect(() => {
    const video = document.querySelector("video");
    if (!video) return;

    video.addEventListener("play", handleLocalPlay);
    video.addEventListener("pause", handleLocalPause);
    video.addEventListener("seeked", handleLocalSeeked);

    return () => {
      video.removeEventListener("play", handleLocalPlay);
      video.removeEventListener("pause", handleLocalPause);
      video.removeEventListener("seeked", handleLocalSeeked);
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || !socketRef.current) return;

    socketRef.current.emit("send-message", { message: inputMsg });
    setInputMsg("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left 2 Columns: Video & Room Details */}
      <div className="lg:col-span-2 space-y-4">
        <HlsPlayer
          src={videoSrc}
          poster={poster}
          storyboardVtt={storyboardVtt}
        />

        {/* Sync Status Badge */}
        <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-xs text-gray-400">Drift Synchronization Status</p>
              <p className="text-sm font-semibold text-emerald-400">{syncStatus}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Measured Drift</p>
            <p className="text-sm font-mono font-medium text-white">{driftMs} ms</p>
          </div>
        </div>

        {/* Participants Presence Bar */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Watching Together ({participants.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <span
                key={p.socketId}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-200 border border-gray-700"
              >
                {p.username}
                {p.isHost && (
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.2 rounded font-bold">
                    HOST
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Live Chat Overlay */}
      <div className="bg-[#121212] border border-gray-800 rounded-2xl flex flex-col h-[580px] overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/80">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-red-500">●</span> Watch Room Chat
          </h2>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-500 text-center mt-20">
              No messages yet. Say hi to everyone in the room!
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-xs">
                <span className="font-bold text-orange-400">{m.senderName}: </span>
                <span className="text-gray-200">{m.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800 bg-gray-900/50 flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default WatchPartyRoom;
