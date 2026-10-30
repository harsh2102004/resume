# PulseCast Media Engine

A distributed media streaming and real-time synchronization engine built with Node.js, Express, FFmpeg, and WebSockets.

PulseCast features native HTTP 206 chunked range streaming, an open-standard **TUS protocol** resumable upload pipeline, an asynchronous **FFmpeg HLS transcoding worker** producing multi-bitrate streams, **WebVTT storyboard scrubbing sprites**, and a real-time **Watch Party** engine with client-side drift compensation.

---

## 🏗️ Architecture

```
[ Browser / Mobile Client ]
       │
       ├── (1) Resumable Upload (TUS Protocol: POST / PATCH / HEAD)
       │       └───► Express TUS Ingestion Layer ───► Local Media Staging
       │                                                      │
       │                                                      ▼
       │                                        [ Async FFmpeg Worker ]
       │                                              │
       │             ┌────────────────────────────────┴───────────────────────────────┐
       │             ▼                                                                ▼
       │    Multi-Bitrate HLS Chunks                                      5x5 Scrubbing Sprite Sheets
       │    (360p, 720p, 1080p + master.m3u8)                            (sprite_%03d.jpg + storyboard.vtt)
       │             │                                                                │
       │             └────────────────────────────────┬───────────────────────────────┘
       │                                              ▼
       ├── (2) Adaptive Bitrate Streaming (HLS.js / HTTP 206 Byte-Range)
       │       └───► GET /api/v1/videos/stream/:videoId?signature=...
       │
       └── (3) Synchronized Watch Party (WebSockets /ws/watch-party)
               └───► Host/Peer Sync (PLAY, PAUSE, SEEK) with ±50ms Drift Compensation
```

---

## ⚡ Features

### 1. HTTP 206 Partial Content Streaming
* Parses `Range: bytes=start-end` headers to stream 1MB chunk slices via Node.js `fs.createReadStream`.
* Enables instantaneous video seeking without pre-fetching entire video files.
* Returns `416 Range Not Satisfiable` for out-of-bounds byte ranges.

### 2. Resumable Uploads (TUS Protocol)
* Ingests files using chunked `PATCH` transfers. If a network interruption occurs, clients query the server offset (`HEAD`) and resume from that byte.
* Bypasses memory buffers by writing chunks directly to disk.

### 3. Asynchronous FFmpeg HLS Transcoding Pipeline
* Converts ingested video into **HLS (HTTP Live Streaming)** streams with a `master.m3u8` manifest and segmented `.ts` chunks (360p, 720p).
* Bundles static `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe` binaries for cross-platform execution.
* Applies dynamic text/logo watermarking via FFmpeg filter graphs during transcode passes.

### 4. Storyboard Scrubbing Sprites
* Extracts video frames at 5-second intervals and tiles them into 5x5 image grids (`tile=5x5`).
* Compiles **WebVTT** cue files (`#xywh=x,y,w,h`) for timeline hover scrubbing preview thumbnails.

### 5. Real-Time Watch Party Engine
* Multi-user synchronized playback (`PLAY`, `PAUSE`, `SEEK`) using Socket.io with active host re-election.
* Client-side drift compensation algorithm adjusting playback rate (`playbackRate = 1.05` / `0.95`) for soft drift and hard seeks for major desync.
* Active presence list and live room chat.

### 6. Media Security & Tokenization
* Time-expiring HMAC-SHA256 signed stream URLs (`expires`, `signature`).
* Constant-time signature verification via `crypto.timingSafeEqual` to prevent timing attacks.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Runtime** | Node.js (ES Modules), Express.js |
| **Media Processing** | FFmpeg, Fluent-FFmpeg, TUS Protocol (`@tus/server`, `@tus/file-store`) |
| **Real-Time** | Socket.io (WebSockets) |
| **Security & Auth** | HMAC-SHA256, timingSafeEqual, Scrypt / Bcrypt, JWT Access/Refresh tokens |
| **Database** | MongoDB & Mongoose (Aggregation pipelines & pagination) |
| **Frontend Client** | React 19, Vite, Tailwind CSS v4, Hls.js, Socket.io-client |
| **Testing & CI/CD** | Node.js native test runner (`node:test`, `node:assert`), GitHub Actions |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18, v20, v22, or v24)
- MongoDB (local or Atlas)

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/pulsecast
CORS_ORIGIN=http://localhost:5173
ACCESS_TOKEN_SECRET=your_jwt_access_secret_key
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_jwt_refresh_secret_key
REFRESH_TOKEN_EXPIRY=10d
STREAM_SECRET=pulsecast_stream_hmac_secret
```

### 3. Installation & Run
```bash
# Install backend dependencies
npm install

# Run automated tests
npm test

# Start backend server
npm run dev
```

In a separate terminal, launch the frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing

PulseCast includes an automated integration test suite utilizing Node.js's native test runner (`node:test`):

```bash
npm test
```

### Test Coverage:
- `GET /api/v1/healthcheck` — Service health validation.
- `OPTIONS /api/v1/videos/resumable-upload` — TUS capability handshake.
- `POST /api/v1/videos/resumable-upload` — Chunked upload session creation.
- `Media Security` — HMAC-SHA256 signature generation and validation.
- `HTTP 403 Security Rejection` — Verifies rejection of tampered and expired stream tokens.
- `HTTP 206 Streaming` — Boundary safety checks on malformed and out-of-bounds requests.

---

## 👨‍💻 Author
**Harsh Pratap Singh**
- GitHub: [@harsh2102004](https://github.com/harsh2102004)