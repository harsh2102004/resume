import { Server } from "socket.io";

// In-memory room store: roomId -> RoomState
const activeRooms = new Map();

/**
 * Real-Time Synchronized Watch Party WebSocket Engine
 * Manages synchronized playback across peers, host election, and live chat.
 */
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
        console.log(`[WatchParty] Client connected: ${socket.id}`);

        let currentRoomId = null;
        let currentUser = null;

        // 1. Join or Create a Watch Party Room
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

            // Register participant
            room.participants.set(socket.id, {
                socketId: socket.id,
                username: currentUser,
                isHost: isFirstUser || room.hostSocketId === socket.id,
            });

            if (isFirstUser) {
                room.hostSocketId = socket.id;
            }

            // Calculate current interpolated playback time if video is playing
            let liveTime = room.currentTime;
            if (room.isPlaying) {
                const elapsedSeconds = (Date.now() - room.lastUpdated) / 1000;
                liveTime += elapsedSeconds;
            }

            // Send current state to newly joined user
            socket.emit("room-state", {
                roomId: room.roomId,
                videoId: room.videoId,
                currentTime: liveTime,
                isPlaying: room.isPlaying,
                hostSocketId: room.hostSocketId,
                participants: Array.from(room.participants.values()),
                serverTimestamp: Date.now(),
            });

            // Broadcast user join to others in the room
            socket.to(roomId).emit("user-joined", {
                user: room.participants.get(socket.id),
                participants: Array.from(room.participants.values()),
            });

            console.log(`[WatchParty] ${currentUser} (${socket.id}) joined room ${roomId}`);
        });

        // 2. Playback State Synchronization (PLAY, PAUSE, SEEK)
        socket.on("sync-action", ({ action, currentTime }) => {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (!room) return;

            // Update master room state
            room.currentTime = typeof currentTime === "number" ? currentTime : room.currentTime;
            room.isPlaying = action === "PLAY";
            room.lastUpdated = Date.now();

            // Broadcast action to all OTHER peers in the room
            socket.to(currentRoomId).emit("sync-action", {
                action,
                currentTime: room.currentTime,
                senderId: socket.id,
                senderName: currentUser,
                serverTimestamp: Date.now(),
            });

            console.log(`[WatchParty] Room ${currentRoomId} action: ${action} at ${currentTime?.toFixed(2)}s by ${currentUser}`);
        });

        // 3. Heartbeat drift check
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

        // 4. Live In-Room Chat Messaging
        socket.on("send-message", ({ message }) => {
            if (!currentRoomId || !message?.trim()) return;

            const chatPayload = {
                id: `${Date.now()}-${socket.id.substring(0, 4)}`,
                senderId: socket.id,
                senderName: currentUser,
                message: message.trim(),
                timestamp: new Date().toISOString(),
            };

            // Emit to EVERYONE in the room including sender
            watchPartyNamespace.to(currentRoomId).emit("chat-message", chatPayload);
        });

        // 5. Handle Disconnect & Host Re-election
        socket.on("disconnect", () => {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (!room) return;

            room.participants.delete(socket.id);

            if (room.participants.size === 0) {
                activeRooms.delete(currentRoomId);
                console.log(`[WatchParty] Room ${currentRoomId} cleared (all users left)`);
            } else {
                // If host left, elect new host
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

            console.log(`[WatchParty] ${currentUser} (${socket.id}) disconnected from ${currentRoomId}`);
        });
    });

    return io;
};
