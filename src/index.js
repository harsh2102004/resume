import "dotenv/config";
import http from "http";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { initializeWatchPartySocket } from "./sockets/watchParty.socket.js";

const PORT = process.env.PORT || 8000;
const server = http.createServer(app);

// Initialize Real-Time WebSocket Engine for Watch Party
initializeWatchPartySocket(server);

connectDB()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`⚙️ PulseCast Server is running at port : ${PORT}`);
            console.log(`🔌 Watch Party WebSockets listening on ws://localhost:${PORT}/watch-party`);
        });
    })
    .catch((err) => {
        console.log("MongoDB connection failed! Starting server in local media mode...", err?.message || err);
        // Start server anyway so media streaming and sockets work without MongoDB running
        server.listen(PORT, () => {
            console.log(`⚙️ PulseCast Server running in local fallback mode at port : ${PORT}`);
        });
    });