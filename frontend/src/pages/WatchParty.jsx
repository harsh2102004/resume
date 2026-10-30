import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import WatchPartyRoom from "../components/WatchPartyRoom";

export const WatchParty = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoomId = searchParams.get("roomId") || "";
  const initialVideoId = searchParams.get("videoId") || "demo-hls-video";

  const [roomId, setRoomId] = useState(initialRoomId);
  const [username, setUsername] = useState("Harsh (Host)");
  const [inRoom, setInRoom] = useState(!!initialRoomId);
  const [copied, setCopied] = useState(false);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    setSearchParams({ roomId, videoId: initialVideoId });
    setInRoom(true);
  };

  const handleCreateNew = () => {
    const newRoom = `room-${Math.random().toString(36).substring(2, 8)}`;
    setRoomId(newRoom);
    setSearchParams({ roomId: newRoom, videoId: initialVideoId });
    setInRoom(true);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inRoom) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 glass-panel rounded-3xl border border-white/10 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/10">
            🍿
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Synchronized Watch Room</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Multi-peer synchronized playback engine with sub-50ms WebSocket drift compensation and real-time room chat.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Your Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              required
              className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Room Identifier
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. room-alpha-99"
              required
              className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            className="glow-btn w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            Enter Synchronized Room
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-slate-900 px-3 text-[11px] text-slate-400 uppercase font-mono font-semibold">or</span>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm py-3 rounded-xl transition-colors border border-white/10 cursor-pointer"
        >
          Create Instant Room
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Room Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 glass-panel rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl">
            🍿
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">
                Live Watch Party
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-semibold">
                {roomId}
              </span>
            </div>
            <p className="text-xs text-slate-400">Share this Room Code with peers to synchronize playback.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{copied ? "Copied!" : "Copy Code"}</span>
          </button>

          <button
            onClick={() => setInRoom(false)}
            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium border border-red-500/20 transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>

      <WatchPartyRoom
        roomId={roomId}
        username={username}
        videoSrc="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
      />
    </div>
  );
};

export default WatchParty;
