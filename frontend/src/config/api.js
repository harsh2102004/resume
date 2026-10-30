export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://pulsecast-qff8.onrender.com"
).replace(/\/$/, "");

// Socket.io client connects via HTTP/HTTPS URL and upgrades to WSS
const rawWsUrl = (
  import.meta.env.VITE_WS_URL || "https://pulsecast-qff8.onrender.com/watch-party"
);

export const WS_BASE_URL = rawWsUrl.startsWith("ws://")
  ? rawWsUrl.replace(/^ws:\/\//, "http://")
  : rawWsUrl.startsWith("wss://")
  ? rawWsUrl.replace(/^wss:\/\//, "https://")
  : rawWsUrl;
