/**
 * @file src/sockets/watchParty.socket.js
 * @description Socket.IO /watch-party namespace: manages rooms (max 20 users), host-only playback sync, heartbeat RTT queries, host handover, and rate-limited chat.
 */

import { Server } from "socket.io";
import { allowedOrigins } from "../utils/corsOrigins.js";

const activeRooms = new Map();
// Rate-limiting map for chat messages: socketId -> [timestamps]
const socketMessageTimes = new Map();

export const initializeWatchPartySocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                return callback(new Error(`CORS: origin '${origin}' is not allowed`));
            },
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    const watchPartyNamespace = io.of("/watch-party");

    watchPartyNamespace.on("connection", (socket) => {
        let currentRoomId = null;
        let currentUser = null;

        socket.on("join-room", (payload) => {
            if (!payload || typeof payload !== "object") return;

            let { roomId, username, videoId } = payload;

            // Validate roomId: short non-empty string (max 50 chars)
            if (typeof roomId !== "string") return;
            roomId = roomId.trim();
            if (!roomId || roomId.length > 50) return;

            // Validate username: short string (max 30 chars)
            if (typeof username === "string") {
                username = username.trim().slice(0, 30);
            }
            if (!username) {
                username = `Guest-${socket.id.substring(0, 4)}`;
            }

            let room = activeRooms.get(roomId);

            // Limit participants per room to 20
            if (room && !room.participants.has(socket.id) && room.participants.size >= 20) {
                socket.emit("room-error", { message: "Room is full (max 20 participants)" });
                return;
            }

            currentRoomId = roomId;
            currentUser = username;

            socket.join(roomId);

            const isFirstUser = !room || room.participants.size === 0;

            if (!room) {
                room = {
                    roomId,
                    videoId: typeof videoId === "string" && videoId.trim() ? videoId.trim().slice(0, 100) : null,
                    currentTime: 0,
                    isPlaying: false,
                    lastUpdated: Date.now(),
                    hostSocketId: socket.id,
                    participants: new Map(),
                };
                activeRooms.set(roomId, room);
            }

            room.participants.set(socket.id, {
                socketId: socket.id,
                username: currentUser,
                isHost: isFirstUser || room.hostSocketId === socket.id,
            });

            if (isFirstUser) {
                room.hostSocketId = socket.id;
            }

            let liveTime = room.currentTime;
            if (room.isPlaying) {
                const elapsedSeconds = (Date.now() - room.lastUpdated) / 1000;
                liveTime += elapsedSeconds;
            }

            socket.emit("room-state", {
                roomId: room.roomId,
                videoId: room.videoId,
                currentTime: liveTime,
                isPlaying: room.isPlaying,
                hostSocketId: room.hostSocketId,
                participants: Array.from(room.participants.values()),
                serverTimestamp: Date.now(),
            });

            socket.to(roomId).emit("user-joined", {
                user: room.participants.get(socket.id),
                participants: Array.from(room.participants.values()),
                hostSocketId: room.hostSocketId,
            });
        });

        socket.on("sync-action", (payload) => {
            if (!payload || typeof payload !== "object") return;
            if (!currentRoomId) return;

            const room = activeRooms.get(currentRoomId);
            if (!room) return;

            // 1. Host check: only the host can control playback
            if (socket.id !== room.hostSocketId) {
                socket.emit("sync-error", { message: "Only the room host can control playback" });
                return;
            }

            const { action, currentTime } = payload;

            // 2. Validate action: must be exactly one of PLAY, PAUSE, SEEK
            if (action !== "PLAY" && action !== "PAUSE" && action !== "SEEK") {
                return;
            }

            // 3. Validate currentTime: finite number >= 0
            if (typeof currentTime !== "number" || !Number.isFinite(currentTime) || currentTime < 0) {
                return;
            }

            room.currentTime = currentTime;
            room.isPlaying = action === "PLAY";
            room.lastUpdated = Date.now();

            socket.to(currentRoomId).emit("sync-action", {
                action,
                currentTime: room.currentTime,
                senderId: socket.id,
                senderName: currentUser,
                serverTimestamp: Date.now(),
            });
        });

        socket.on("heartbeat-query", (payload) => {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (!room) return;

            let liveTime = room.currentTime;
            if (room.isPlaying) {
                liveTime += (Date.now() - room.lastUpdated) / 1000;
            }

            const clientSendTime =
                payload && typeof payload.clientSendTime === "number" ? payload.clientSendTime : undefined;

            socket.emit("heartbeat-ack", {
                serverTime: liveTime,
                isPlaying: room.isPlaying,
                serverTimestamp: Date.now(),
                clientSendTime,
            });
        });

        socket.on("send-message", (payload) => {
            if (!payload || typeof payload !== "object") return;
            if (!currentRoomId) return;

            let { message } = payload;
            if (typeof message !== "string") return;
            message = message.trim();

            // Validate length (max 500 characters)
            if (!message || message.length > 500) return;

            // Rate limit: 5 messages per 5 seconds per socket
            const now = Date.now();
            const history = socketMessageTimes.get(socket.id) || [];
            const recent = history.filter((t) => now - t < 5000);
            if (recent.length >= 5) {
                socket.emit("chat-error", { message: "Chat rate limit exceeded. Please wait a moment." });
                return;
            }
            recent.push(now);
            socketMessageTimes.set(socket.id, recent);

            const chatPayload = {
                id: `${now}-${socket.id.substring(0, 4)}`,
                senderId: socket.id,
                senderName: currentUser,
                message: message.slice(0, 500),
                timestamp: new Date().toISOString(),
            };

            watchPartyNamespace.to(currentRoomId).emit("chat-message", chatPayload);
        });

        socket.on("disconnect", () => {
            socketMessageTimes.delete(socket.id);

            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (!room) return;

            room.participants.delete(socket.id);

            if (room.participants.size === 0) {
                activeRooms.delete(currentRoomId);
            } else {
                if (room.hostSocketId === socket.id) {
                    const nextHost = room.participants.values().next().value;
                    if (nextHost) {
                        nextHost.isHost = true;
                        room.hostSocketId = nextHost.socketId;
                        watchPartyNamespace.to(currentRoomId).emit("host-changed", {
                            newHost: nextHost,
                            hostSocketId: nextHost.socketId,
                        });
                    }
                }

                socket.to(currentRoomId).emit("user-left", {
                    userId: socket.id,
                    username: currentUser,
                    participants: Array.from(room.participants.values()),
                    hostSocketId: room.hostSocketId,
                });
            }
        });
    });

    return io;
};
