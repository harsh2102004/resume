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

  if (!inRoom) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-[#1a1a1a] rounded-2xl border border-gray-800 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <span className="text-4xl">🍿</span>
          <h1 className="text-2xl font-black text-white tracking-tight">Join a Watch Party</h1>
          <p className="text-xs text-gray-400">
            Watch streams together in real time with synchronized play/pause/seek and live room chat.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              required
              className="w-full bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Room Code
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. room-alpha"
              required
              className="w-full bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm py-3 rounded-xl transition-colors cursor-pointer"
          >
            Enter Room
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-gray-800 w-full" />
          <span className="bg-[#1a1a1a] px-3 text-xs text-gray-500 uppercase font-semibold">or</span>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm py-3 rounded-xl transition-colors border border-gray-700 cursor-pointer"
        >
          Create Instant Room
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            🍿 Watch Party: <span className="text-orange-400 font-mono">{roomId}</span>
          </h1>
          <p className="text-xs text-gray-400">Share this Room Code with friends to watch in sync!</p>
        </div>
        <button
          onClick={() => setInRoom(false)}
          className="text-xs text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 cursor-pointer"
        >
          Leave Room
        </button>
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
