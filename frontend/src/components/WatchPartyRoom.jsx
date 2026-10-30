import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import HlsPlayer from "./HlsPlayer";

export const WatchPartyRoom = ({
  roomId = "demo-room",
  username = "GuestUser",
  videoSrc = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  storyboardVtt = null,
  poster = null,
}) => {
  const socketRef = useRef(null);
  const isRemoteActionRef = useRef(false);

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
        setSyncStatus("Hard Resync Applied");
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left 2 Columns: Video & Sync Engine Metrics */}
      <div className="lg:col-span-2 space-y-5">
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
          <HlsPlayer
            src={videoSrc}
            poster={poster}
            storyboardVtt={storyboardVtt}
          />
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center justify-between glass-panel p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Sync State Machine</p>
              <p className="text-sm font-semibold text-emerald-400">{syncStatus}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Client Drift</p>
            <p className="text-sm font-mono font-bold text-white">{driftMs} ms</p>
          </div>
        </div>

        {/* Participants Presence Bar */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Connected Peers ({participants.length})
            </h3>
            <span className="text-[10px] font-mono text-emerald-400">WebSocket /watch-party</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {participants.map((p) => (
              <span
                key={p.socketId}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-slate-900/80 text-slate-200 border border-slate-700/80"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {p.username}
                {p.isHost && (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-bold font-mono">
                    HOST
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Live Chat Overlay */}
      <div className="glass-panel rounded-2xl flex flex-col h-[580px] overflow-hidden border border-white/10 shadow-2xl">
        <div className="px-4 py-3.5 border-b border-white/10 bg-slate-900/70 flex items-center justify-between">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Room Stream Chat
          </h2>
          <span className="text-[11px] font-mono text-slate-400">{messages.length} messages</span>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
              <span className="text-2xl">💬</span>
              <p className="text-xs">No chat messages yet.</p>
              <p className="text-[11px] text-slate-500">Play/pause/seek events are synchronized automatically across all participants.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-xs space-y-0.5 bg-slate-900/40 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-400">{m.senderName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed">{m.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-slate-950/60 flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Broadcast a message..."
            className="flex-1 bg-slate-900/90 text-white placeholder-slate-500 text-xs px-3.5 py-2.5 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            className="glow-btn bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default WatchPartyRoom;
