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
  const [isSynced, setIsSynced] = useState(true);

  useEffect(() => {
    const socket = io("http://localhost:8000/watch-party", {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsSynced(true);
      socket.emit("join-room", { roomId, username });
    });

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

    socket.on("heartbeat-ack", ({ serverTime, isPlaying }) => {
      const video = document.querySelector("video");
      if (!video || !isPlaying) return;

      const drift = video.currentTime - serverTime;
      const absDrift = Math.abs(drift);

      if (absDrift > 1.5) {
        video.currentTime = serverTime;
        video.playbackRate = 1.0;
      } else if (absDrift > 0.15) {
        video.playbackRate = drift < 0 ? 1.05 : 0.95;
      } else {
        video.playbackRate = 1.0;
      }
    });

    socket.on("user-joined", ({ user, participants }) => {
      setParticipants(participants);
    });

    socket.on("user-left", ({ participants }) => {
      setParticipants(participants);
    });

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Video & Room Participants */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
          <HlsPlayer
            src={videoSrc}
            poster={poster}
            storyboardVtt={storyboardVtt}
          />
        </div>

        {/* Viewers presence bar */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-white">
              In Room ({participants.length}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {participants.map((p) => (
                <span
                  key={p.socketId}
                  className="px-2.5 py-0.5 rounded-lg text-xs bg-slate-800 text-slate-300 font-medium"
                >
                  {p.username}
                </span>
              ))}
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-medium">Synced</span>
        </div>
      </div>

      {/* Right Column: Live Chat */}
      <div className="glass-panel rounded-2xl flex flex-col h-[520px] overflow-hidden border border-white/10 shadow-xl">
        <div className="px-4 py-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Room Chat</span>
          </h2>
          <span className="text-xs text-slate-400">{messages.length}</span>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1 text-slate-400">
              <span className="text-xl">💬</span>
              <p className="text-xs">Say hello to everyone in the room!</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-xs space-y-0.5 bg-slate-900/40 p-2 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-400">{m.senderName}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-200 text-xs">{m.message}</p>
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
            placeholder="Send a message..."
            className="flex-1 bg-slate-900 text-white placeholder-slate-500 text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default WatchPartyRoom;
