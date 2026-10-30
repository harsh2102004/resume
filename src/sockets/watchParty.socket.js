import { Server } from "socket.io";

const activeRooms = new Map();

export const initializeWatchPartySocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    const watchPartyNamespace = io.of("/watch-party");

    watchPartyNamespace.on("connection", (socket) => {
        let currentRoomId = null;
        let currentUser = null;

        socket.on("join-room", ({ roomId, username, videoId }) => {
            if (!roomId) return;

            currentRoomId = roomId;
            currentUser = username || `Guest-${socket.id.substring(0, 4)}`;

            socket.join(roomId);

            let room = activeRooms.get(roomId);
            const isFirstUser = !room || room.participants.size === 0;

            if (!room) {
                room = {
                    roomId,
                    videoId: videoId || null,
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
            });
        });

        socket.on("sync-action", ({ action, currentTime }) => {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (!room) return;

            room.currentTime = typeof currentTime === "number" ? currentTime : room.currentTime;
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

        socket.on("heartbeat-query", () => {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (!room) return;

            let liveTime = room.currentTime;
            if (room.isPlaying) {
                liveTime += (Date.now() - room.lastUpdated) / 1000;
            }

            socket.emit("heartbeat-ack", {
                serverTime: liveTime,
                isPlaying: room.isPlaying,
                serverTimestamp: Date.now(),
            });
        });

        socket.on("send-message", ({ message }) => {
            if (!currentRoomId || !message?.trim()) return;

            const chatPayload = {
                id: `${Date.now()}-${socket.id.substring(0, 4)}`,
                senderId: socket.id,
                senderName: currentUser,
                message: message.trim(),
                timestamp: new Date().toISOString(),
            };

            watchPartyNamespace.to(currentRoomId).emit("chat-message", chatPayload);
        });

        socket.on("disconnect", () => {
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
                        });
                    }
                }

                socket.to(currentRoomId).emit("user-left", {
                    userId: socket.id,
                    username: currentUser,
                    participants: Array.from(room.participants.values()),
                });
            }
        });
    });

    return io;
};
