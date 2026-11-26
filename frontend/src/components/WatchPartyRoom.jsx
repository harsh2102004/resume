/**
 * @file frontend/src/components/WatchPartyRoom.jsx
 * @description Socket.IO Watch Party client with host-only controls, 4-ping RTT clock calibration, playback-rate drift correction, and live chat.
 */

import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import HlsPlayer from "./HlsPlayer";
import { WS_BASE_URL } from "../config/api";

export const WatchPartyRoom = ({
  roomId = "demo-room",
  username = "GuestUser",
  videoSrc = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  storyboardVtt = null,
  poster = null,
}) => {
  const socketRef = useRef(null);
  const isRemoteActionRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const isHostRef = useRef(false);

  const [participants, setParticipants] = useState([]);
  const [hostSocketId, setHostSocketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [roomError, setRoomError] = useState("");
  const [calibrated, setCalibrated] = useState(false);

  const currentSocketId = socketRef.current?.id;
  const isHost = Boolean(currentSocketId && hostSocketId === currentSocketId);
  isHostRef.current = isHost;

  const hostParticipant = participants.find((p) => p.socketId === hostSocketId || p.isHost);
  const hostName = hostParticipant?.username || "Host";

  useEffect(() => {
    const socket = io(WS_BASE_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    // Clock calibration samples: array of { rtt, offset }
    const calibrationSamples = [];

    const sendCalibrationPing = () => {
      if (socket.connected) {
        socket.emit("heartbeat-query", { clientSendTime: Date.now() });
      }
    };

    socket.on("connect", () => {
      socket.emit("join-room", { roomId, username });

      // Run 4 rapid clock-offset calibration round trips on connect
      let pingsSent = 0;
      const calibrationTimer = setInterval(() => {
        if (pingsSent < 4 && socket.connected) {
          sendCalibrationPing();
          pingsSent++;
        } else {
          clearInterval(calibrationTimer);
        }
      }, 200);
    });

    socket.on("room-error", ({ message }) => {
      setRoomError(message || "Could not join room");
    });

    socket.on("sync-error", ({ message }) => {
      setStatusMessage(message || "Sync error");
      setTimeout(() => setStatusMessage(""), 3500);
    });

    socket.on("chat-error", ({ message }) => {
      setStatusMessage(message || "Chat error");
      setTimeout(() => setStatusMessage(""), 3500);
    });

    socket.on("room-state", (state) => {
      setParticipants(state.participants || []);
      if (state.hostSocketId) {
        setHostSocketId(state.hostSocketId);
      }
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

    socket.on("host-changed", ({ newHost, hostSocketId: newHostId }) => {
      const nextId = newHostId || newHost?.socketId;
      if (nextId) {
        setHostSocketId(nextId);
      }
      setParticipants((prev) =>
        prev.map((p) => ({
          ...p,
          isHost: p.socketId === nextId,
        }))
      );
      setStatusMessage(`Host changed to ${newHost?.username || "next participant"}`);
      setTimeout(() => setStatusMessage(""), 3500);
    });

    socket.on("sync-action", ({ action, currentTime, serverTimestamp }) => {
      const video = document.querySelector("video");
      if (!video) return;

      isRemoteActionRef.current = true;

      // Compensate for latency using the calibrated client-server clock offset:
      // estimatedServerNow = clientNow + clockOffset
      const estimatedServerNow = Date.now() + clockOffsetRef.current;
      const latencySeconds = Math.max(0, (estimatedServerNow - serverTimestamp) / 1000);

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

    socket.on("heartbeat-ack", ({ serverTime, isPlaying, serverTimestamp, clientSendTime }) => {
      const clientReceiveTime = Date.now();

      // Compute RTT and clock offset:
      // offset = serverTimestamp - (clientSendTime + rtt / 2)
      if (typeof clientSendTime === "number" && typeof serverTimestamp === "number") {
        const rtt = Math.max(1, clientReceiveTime - clientSendTime);
        const sampleOffset = serverTimestamp - (clientSendTime + rtt / 2);

        calibrationSamples.push({ rtt, offset: sampleOffset });

        // Keep the sample with the lowest RTT for minimum jitter
        const bestSample = calibrationSamples.reduce(
          (best, curr) => (curr.rtt < best.rtt ? curr : best),
          calibrationSamples[0]
        );
        clockOffsetRef.current = bestSample.offset;
        setCalibrated(true);
      }

      // Drift adjustment for guests following playback
      const video = document.querySelector("video");
      if (!video || !isPlaying) return;

      const elapsedSinceServer = Math.max(
        0,
        (Date.now() + clockOffsetRef.current - serverTimestamp) / 1000
      );
      const expectedTime = serverTime + elapsedSinceServer;
      const drift = video.currentTime - expectedTime;
      const absDrift = Math.abs(drift);

      if (absDrift > 1.5) {
        video.currentTime = expectedTime;
        video.playbackRate = 1.0;
      } else if (absDrift > 0.15) {
        video.playbackRate = drift < 0 ? 1.05 : 0.95;
      } else {
        video.playbackRate = 1.0;
      }
    });

    socket.on("user-joined", ({ participants: plist, hostSocketId: hId }) => {
      if (plist) setParticipants(plist);
      if (hId) setHostSocketId(hId);
    });

    socket.on("user-left", ({ participants: plist, hostSocketId: hId }) => {
      if (plist) setParticipants(plist);
      if (hId) setHostSocketId(hId);
    });

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Ongoing periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat-query", { clientSendTime: Date.now() });
      }
    }, 3000);

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, [roomId, username]);

  // Video event listeners for local host interactions
  const handleLocalPlay = () => {
    if (!isHostRef.current || isRemoteActionRef.current) return;
    const video = document.querySelector("video");
    if (socketRef.current && video) {
      socketRef.current.emit("sync-action", {
        action: "PLAY",
        currentTime: video.currentTime,
      });
    }
  };

  const handleLocalPause = () => {
    if (!isHostRef.current || isRemoteActionRef.current) return;
    const video = document.querySelector("video");
    if (socketRef.current && video) {
      socketRef.current.emit("sync-action", {
        action: "PAUSE",
        currentTime: video.currentTime,
      });
    }
  };

  const handleLocalSeeked = () => {
    if (!isHostRef.current || isRemoteActionRef.current) return;
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

    socketRef.current.emit("send-message", { message: inputMsg.trim().slice(0, 500) });
    setInputMsg("");
  };

  if (roomError) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-red-500/30 text-center max-w-md mx-auto space-y-3">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-xl">
          ⚠️
        </div>
        <h3 className="text-base font-bold text-white">Room Notice</h3>
        <p className="text-xs text-red-300">{roomError}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Video & Room Participants */}
      <div className="lg:col-span-2 space-y-4">
        {/* Notice/Status Banner */}
        {statusMessage && (
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between animate-fade-in">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage("")}
              className="text-indigo-400 hover:text-white font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Cinema Player Container with Host/Guest Status */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
          {/* Host / Follower Visual Status Indicator */}
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2 pointer-events-none">
            {isHost ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/90 backdrop-blur-md border border-indigo-500/40 text-indigo-300 text-xs font-bold shadow-lg">
                <span>👑</span>
                <span>You are Host (Controlling Playback)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-lg">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Following Host: {hostName} (Controls Locked)</span>
              </span>
            )}
          </div>

          {/* Player: Non-hosts see controls locked / disabled */}
          <div className={!isHost ? "pointer-events-none select-none" : ""}>
            <HlsPlayer
              src={videoSrc}
              poster={poster}
              storyboardVtt={storyboardVtt}
            />
          </div>

          {/* Guest interactive blocker with helpful hint if clicked */}
          {!isHost && (
            <div
              className="absolute inset-0 z-20 cursor-not-allowed"
              title={`Playback is synced to the host (${hostName}). Only the host can play, pause, or seek.`}
              onClick={() => {
                setStatusMessage(`Playback is controlled by the room host (${hostName}).`);
                setTimeout(() => setStatusMessage(""), 3000);
              }}
            />
          )}
        </div>

        {/* Viewers presence bar */}
        <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-white">
              In Room ({participants.length}/20):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {participants.map((p) => {
                const isItemHost = p.socketId === hostSocketId || p.isHost;
                const isMe = p.socketId === currentSocketId;
                return (
                  <span
                    key={p.socketId}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1 ${
                      isItemHost
                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {isItemHost && <span>👑</span>}
                    <span>{p.username}</span>
                    {isMe && <span className="text-[10px] text-slate-400">(You)</span>}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {calibrated && (
              <span className="text-[11px] text-slate-400">
                Offset: {Math.round(clockOffsetRef.current)}ms
              </span>
            )}
            <span className="text-xs text-emerald-400 font-medium">Synced</span>
          </div>
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
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-slate-200 text-xs break-words">{m.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-slate-950/60 flex gap-2">
          <input
            type="text"
            maxLength={500}
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Send a message (max 500 chars)..."
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
