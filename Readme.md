# PulseCast — Distributed Media Streaming Engine & Watch Party Platform

PulseCast is a production-grade distributed media streaming engine and real-time synchronized watch party platform built with Node.js, Express, BullMQ, FFmpeg, MongoDB, and React.

The system handles the entire video lifecycle: chunked resumable video uploads via the open-standard TUS protocol, asynchronous multi-bitrate HLS transcoding (360p, 720p) and WebVTT storyboard generation offloaded to a Redis/BullMQ background queue, native HTTP 206 partial content streaming with byte-range clamping, time-expiring HMAC-SHA256 signed playback URLs, and low-latency synchronized watch party rooms with host-authoritative controls and sliding-window rate-limited chat.

---

## 🌐 Live Deployments & Demo

* **Web Client**: [https://resume-zeta-one-86.vercel.app](https://resume-zeta-one-86.vercel.app)
* **Backend API Healthcheck**: [https://pulsecast-qff8.onrender.com/api/v1/healthcheck](https://pulsecast-qff8.onrender.com/api/v1/healthcheck)
* **Demo Video / GIF**:
<!-- DEMO VIDEO / GIF PLACEHOLDER: Replace this line with your 60-90 second demo video or GIF link (e.g. [![PulseCast Demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/0.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID) or ![Demo GIF](path/to/demo.gif)) -->

---

## ✨ Features

* **Resumable video ingestion**: Standard-compliant TUS protocol (`@tus/server`) uploads with client-side pause/resume controls and automatic byte-offset resumption.
* **Asynchronous queue-based processing**: Transcoding workloads are decoupled from the HTTP API process using BullMQ and Redis (`video-processing` queue).
* **Adaptive multi-bitrate HLS transcoding**: Asynchronous generation of 360p and 720p HLS streams, segmented `.ts` chunks, and a `master.m3u8` manifest using FFmpeg.
* **Timeline scrubbing previews**: Extraction of 5x5 keyframe sprite sheets and WebVTT cue files (`#xywh`) for video player hover scrubbing.
* **Hybrid media storage**: Persistent local disk storage with automatic Cloudinary CDN asset synchronization when credentials are configured.
* **Native HTTP 206 range streaming**: RFC-compliant byte-range handling (`bytes=start-end`, `bytes=start-`, `bytes=-N`) with bounds clamping and out-of-bounds `416` protection.
* **HMAC-SHA256 signed stream security**: Time-expiring signed playback tokens with constant-time verification (`crypto.timingSafeEqual`) and owner-only unpublished stream protection.
* **Host-authoritative watch parties**: Real-time synchronized playback rooms on Socket.IO (`/watch-party`) where only the active room host can dispatch `PLAY`, `PAUSE`, and `SEEK` actions.
* **Automatic host re-election**: Seamless handover of room host privileges to the next connected participant when the active host disconnects.
* **Dynamic drift compensation**: Heartbeat query/ack round-trip latency measurements with dynamic playback rate micro-adjustments (`0.95x`–`1.05x`) and auto-seeks.
* **Live in-room chat**: Synchronized room messaging with 500-character payload limits and sliding-window rate limiting (5 messages per 5 seconds).
* **User authentication & session rotation**: Bcrypt password hashing, signed JWT access tokens in cookies/headers, and refresh token database rotation.
* **Social engagement & interaction**: Video likes, comment CRUD, channel subscriptions with self-subscription prevention, and creator dashboard analytics.
* **Defensive API hardening**: Strict CORS origin whitelisting, Helmet security headers, Zod request body validation, and route-specific rate limiting via `express-rate-limit`.

---

## 🏗️ Architecture

```text
                             [ Web Client (React 19 + Hls.js + Socket.IO) ]
                                  │                               │
                  HTTP REST / TUS │                               │ WebSockets (/watch-party)
                                  ▼                               ▼
                 ┌────────────────────────────────┐     ┌───────────────────────────────────┐
                 │     Express.js API Server      │     │     Socket.IO Real-Time Engine    │
                 │  (Helmet, CORS, Rate Limiters, │     │  (Host-Authoritative Sync, Chat,  │
                 │   Zod Validators, JWT Auth)    │     │   Drift Measurement, Heartbeats)  │
                 └────────┬──────────────┬────────┘     └───────────────────────────────────┘
                          │              │
               (TUS Finish: Enqueue)     │ (Queries & Writes)
                          │              ▼
                          │     ┌──────────────────┐
                          │     │  MongoDB Database│
                          │     │  (Users, Videos, │
                          │     │  Likes, Comments,│
                          │     │  Subscriptions)  │
                          │     └──────────────────┘
                          ▼
               ┌──────────────────────┐
               │  Redis Cache / Queue │
               │ (BullMQ: video-proc) │
               └──────────┬───────────┘
                          │
                          ▼ (Pulls Job: Concurrency 2)
               ┌──────────────────────────────────────┐
               │        BullMQ Worker Process         │
               │   (src/workers/index.js + FFmpeg)    │
               ├──────────────────────────────────────┤
               │  1. Generate WebVTT Storyboard (5x5) │
               │  2. Transcode 360p & 720p HLS Chunks │
               │  3. Assemble master.m3u8 Manifest    │
               └──────────┬───────────────────────────┘
                          │
                          ▼
        ┌───────────────────────────────────┐
        │       Media Storage Target        │
        ├─────────────────┬─────────────────┤
        │  Cloudinary CDN │   Local Disk    │
        │  (if configured)│ (storage/uploads│
        │                 │  public/uploads)│
        └─────────────────┴─────────────────┘
```

---

## 🛠️ Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v20, v22, v24) | High-concurrency asynchronous runtime |
| **Web Framework** | Express.js 4.18.2 | REST API routing and middleware pipeline |
| **Media Ingestion** | `@tus/server` 2.4.6, `@tus/file-store` 2.1.1 | Standard-compliant TUS chunked resumable file transfers |
| **Job Queue** | BullMQ 6.7.6, IORedis 6.0.0 | Redis-backed background video processing queue |
| **Media Processing** | `fluent-ffmpeg` 2.1.3, `@ffmpeg-installer/ffmpeg` 1.1.0 | Multi-bitrate HLS segmentation, sprite sheets, WebVTT |
| **Cloud CDN Storage**| Cloudinary SDK 1.41.0 | Remote media hosting fallback & CDN asset delivery |
| **Real-Time Sockets** | Socket.IO 4.8.4 | Low-latency WebSockets for Watch Party rooms |
| **Database & ODM** | MongoDB, Mongoose 8.0.0 | Data modeling, pagination, compound indexing |
| **Authentication & Crypto** | `jsonwebtoken` 9.0.2, `bcrypt` 5.1.1, Node `crypto` | Access/refresh tokens, password hashing, HMAC stream signing |
| **Security & Validation** | `helmet` 8.3.0, `express-rate-limit` 8.7.4, `zod` 4.6.7 | HTTP header defense, IP rate limiting, schema validation |
| **Frontend Framework** | React 19.2.8, Vite 8.2.0 | Reactive component architecture, SPA routing |
| **Frontend Routing** | React Router 7.18.2 | Client-side page navigation and auth redirection |
| **Video Playback** | Hls.js 1.7.4, HTML5 Video API | Adaptive HLS stream decoding, scrubbing preview overlays |
| **Styling** | Tailwind CSS 4.3.3 | Dark-mode glassmorphic responsive UI |
| **Testing Engine** | Node.js Native Test Runner (`node:test`, `node:assert/strict`) | Unit, integration, security, and socket test suites |
| **In-Memory Database** | `mongodb-memory-server` 11.3.0 | Zero-dependency isolated test database bootstrap |
| **Code Coverage** | `c8` 12.0.0 | Test coverage reporting |
| **Containerization** | Docker, Docker Compose (`node:20-alpine`, `mongo:7`, `redis:7-alpine`) | Production container packaging and local orchestration |

---

## 💻 Setup & Installation

### Prerequisites
* **Node.js**: v20.0.0 or higher
* **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster
* **Redis**: Local or cloud Redis instance (v6+ or v7-alpine)
* **Cloudinary** *(Optional)*: Cloud credentials for remote CDN storage (falls back to local disk if omitted)

### 1. Environment Configuration

Create a `.env` file in the project root based on `.env.sample`:

```env
# Server & Runtime
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017
DB_NAME=pulsecast

# Redis & Background Queue
REDIS_URL=redis://localhost:6379

# JWT Authentication
ACCESS_TOKEN_SECRET=your_super_secret_access_token_key_here_32_chars
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_super_secret_refresh_token_key_here_32_chars
REFRESH_TOKEN_EXPIRY=10d

# Media Security & Stream Signing
STREAM_SECRET=your_secure_hmac_sha256_stream_secret_key_here
TEST_STREAM_SECRET=test_dev_stream_secret_key_only
ENFORCE_SIGNED_STREAMS=false

# Media Storage & Transcoding
UPLOAD_DIR=storage/uploads/resumable
WATERMARK_FONT=

# Cloudinary CDN (Optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Create `frontend/.env` for the client:
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/watch-party
```

### 2. Local Run (Three-Process Model)

```bash
# 1. Install root backend dependencies
npm install

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Terminal 1: Start the Express API server
npm run dev

# 4. Terminal 2: Start the BullMQ background video worker
npm run worker

# 5. Terminal 3: Start the Vite frontend client
cd frontend && npm run dev
```

The web client runs at `http://localhost:5173` and the API at `http://localhost:8000`.

### 3. Docker Run

Build and orchestrate the API server, worker, MongoDB, and Redis with healthcheck dependencies:

```bash
# Production mode (isolated container code)
docker compose up --build

# Development mode (with live code bind mounts)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

---

## 📡 REST API Reference

All REST endpoints are rooted under `/api/v1`.

### 🔑 Authentication & Users (`/api/v1/users`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Register user account (multipart avatar/cover, validated) | No (Rate-limited) |
| `POST` | `/login` | Authenticate with username/email and password | No (Rate-limited) |
| `POST` | `/logout` | Invalidate current session and clear refresh token | Yes (JWT) |
| `POST` | `/refresh-token` | Renew access token via refresh token | No (Rate-limited) |
| `POST` | `/change-password` | Update account password (validated) | Yes (JWT) |
| `GET` | `/current-user` | Retrieve authenticated user profile | Yes (JWT) |
| `PATCH` | `/update-account` | Update account full name and email | Yes (JWT) |
| `PATCH` | `/avatar` | Upload new user avatar image | Yes (JWT) |
| `PATCH` | `/cover-image` | Upload new user channel banner | Yes (JWT) |
| `GET` | `/c/:username` | Retrieve channel profile and subscriber metrics | Yes (JWT) |
| `GET` | `/history` | Fetch user watch history | Yes (JWT) |

### 🎥 Videos & Streaming (`/api/v1/videos`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `ALL` | `/resumable-upload*` | TUS protocol resumable video upload gateway | Yes on POST/PATCH |
| `GET` | `/` | Query published videos (search, sorting, pagination) | No |
| `POST` | `/` | Publish new video via multipart upload | Yes (JWT) |
| `GET` | `/:videoId` | Get video details; increments views | Optional JWT |
| `PATCH` | `/:videoId` | Update video title, description, thumbnail (validated) | Yes (Owner only) |
| `DELETE` | `/:videoId` | Permanently remove video and media files | Yes (Owner only) |
| `PATCH` | `/toggle/publish/:videoId` | Toggle video public/unlisted visibility | Yes (Owner only) |
| `GET` | `/stream/:videoId` | HTTP 206 chunked range video stream | Optional / Signed |
| `GET` | `/sign-stream/:videoId` | Generate time-expiring HMAC signed stream URL | Yes (JWT) |

### 💬 Social & Community (`/api/v1`)
| Group | Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **Comments** | `GET` | `/comments/:videoId` | Get paginated comments for a video | Optional JWT |
| | `POST` | `/comments/:videoId` | Add comment to a video (validated) | Yes (JWT) |
| | `PATCH` | `/comments/c/:commentId` | Edit comment content (validated) | Yes (Owner only) |
| | `DELETE` | `/comments/c/:commentId` | Remove comment | Yes (Owner only) |
| **Likes** | `POST` | `/likes/toggle/v/:videoId` | Toggle like on a video | Yes (JWT) |
| | `POST` | `/likes/toggle/c/:commentId` | Toggle like on a comment | Yes (JWT) |
| | `POST` | `/likes/toggle/t/:tweetId` | Toggle like on a tweet | Yes (JWT) |
| | `GET` | `/likes/videos` | Fetch list of videos liked by user | Yes (JWT) |
| **Subscriptions** | `GET` | `/subscriptions/c/:channelId` | Get subscriber list for a channel | No |
| | `POST` | `/subscriptions/c/:channelId` | Toggle subscription (self-sub blocked) | Yes (JWT) |
| | `GET` | `/subscriptions/u/:subscriberId` | Get channels a user subscribed to | No |
| **Playlists** | `POST` | `/playlist` | Create new playlist (validated) | Yes (JWT) |
| | `GET` | `/playlist/:playlistId` | Get playlist details and videos | Yes (JWT) |
| | `PATCH` | `/playlist/:playlistId` | Update playlist metadata (validated) | Yes (JWT) |
| | `DELETE` | `/playlist/:playlistId` | Delete playlist | Yes (JWT) |
| | `PATCH` | `/playlist/add/:videoId/:playlistId` | Add video to playlist | Yes (JWT) |
| | `PATCH` | `/playlist/remove/:videoId/:playlistId` | Remove video from playlist | Yes (JWT) |
| | `GET` | `/playlist/user/:userId` | Get all playlists owned by user | Yes (JWT) |
| **Tweets** | `POST` | `/tweets` | Create community tweet (validated) | Yes (JWT) |
| | `GET` | `/tweets/user/:userId` | Get all tweets by a user | Yes (JWT) |
| | `PATCH` | `/tweets/:tweetId` | Update tweet (validated) | Yes (JWT) |
| | `DELETE` | `/tweets/:tweetId` | Delete tweet | Yes (JWT) |
| **Dashboard** | `GET` | `/dashboard/stats` | Channel analytics (views, subscribers, likes) | Yes (JWT) |
| | `GET` | `/dashboard/videos` | All videos uploaded by channel owner | Yes (JWT) |
| **Health** | `GET` | `/healthcheck` | Service liveness probe (`200 OK`) | No |

---

## 🔌 WebSocket Events (`/watch-party`)

Watch Party rooms connect over Socket.IO under the `/watch-party` namespace.

### Client-to-Server Events

* `join-room`: `{ roomId: string, username?: string, videoId?: string }`
  * Validates `roomId` (trimmed, max 50 chars) and `username` (trimmed, max 30 chars).
  * Caps maximum participants to 20 per room; emits `room-error` if full.
* `sync-action`: `{ action: "PLAY" | "PAUSE" | "SEEK", currentTime: number }`
  * Host-only permission gate: if `socket.id !== room.hostSocketId`, emits `sync-error`.
  * Validates action to exact enum and verifies `currentTime` is a finite non-negative number.
* `heartbeat-query`: `{ clientSendTime?: number }`
  * Queries current server video playback time and echoes client timestamp to compute RTT.
* `send-message`: `{ message: string }`
  * Validates message string (max 500 chars).
  * Enforces sliding-window rate limit (max 5 messages per 5 seconds per socket); emits `chat-error` if exceeded.

### Server-to-Client Events

* `room-state`: `{ roomId, videoId, currentTime, isPlaying, hostSocketId, participants, serverTimestamp }`
  * Dispatched to connecting client with live calculated playback timestamp.
* `user-joined`: `{ user, participants, hostSocketId }`
  * Broadcast to room peers when a new user joins.
* `sync-action`: `{ action, currentTime, senderId, senderName, serverTimestamp }`
  * Broadcast to all room peers when the host executes a play, pause, or seek.
* `heartbeat-ack`: `{ serverTime, isPlaying, serverTimestamp, clientSendTime }`
  * Emitted back to client for drift calculation and clock alignment.
* `chat-message`: `{ id, senderId, senderName, message, timestamp }`
  * Broadcast to all room participants on successful message delivery.
* `user-left`: `{ userId, username, participants, hostSocketId }`
  * Broadcast to remaining peers when a user disconnects.
* `host-changed`: `{ newHost, hostSocketId }`
  * Broadcast when the host disconnects and rights are handed to the next active peer.
* `room-error` / `sync-error` / `chat-error`: `{ message: string }`
  * Dispatched directly to offending socket on validation failure or limit breach.

---

## 🧪 Testing & CI Pipeline

PulseCast includes an automated test suite executed with Node.js's native test runner (`node:test`) and assertion engine (`node:assert/strict`) backed by `mongodb-memory-server` for zero external database dependencies.

```bash
# Run test suite
npm test

# Run test suite with c8 coverage report
npm run test:coverage
```

### Test Coverage Results

```text
✔ Auth: 8 tests passing (register valid/duplicate/invalid, login valid/invalid, refresh-token, logout, 401 unauth)
✔ Social: 5 tests passing (toggle like auth/counts, self-sub prevention, sub counts, comments CRUD)
✔ Streaming: 13 tests passing (Range cases, suffix ranges, clamp bounds, 416 errors, signed URLs, tamper checks)
✔ Uploads: 5 tests passing (TUS OPTIONS discovery, unauth 401, tampered token 401, valid 201 session, PATCH 401)
✔ Videos: 6 tests passing (ownership permissions, update/delete 403, visibility filtering, view increments)
✔ Watch Party: 4 tests passing (host election, sync broadcast, non-host rejection, host disconnect handover)

ℹ tests 41 | pass 41 | fail 0 | cancelled 0 | skipped 0
```

* **Code Coverage (c8)**:
  * Statements: **58.55%**
  * Branches: **54.92%**
  * Functions: **58.33%**
  * Lines: **58.55%**

### GitHub Actions CI/CD (`.github/workflows/ci.yml`)

Every push and pull request to `main` triggers an automated matrix pipeline:
1. Matrix test across Node.js versions `20.x` and `22.x` on `ubuntu-latest`.
2. Clean backend dependency installation via `npm ci`.
3. ESLint static analysis on backend source (`npm run lint`).
4. Automated execution of all 41 tests with coverage reporting (`npm run test:coverage`).
5. Frontend dependency installation, oxlint analysis, and Vite production bundle build (`npm run build`).
6. Production Docker image container build verification (`docker build -t pulsecast-backend:ci .`).

---

## 📊 Performance Benchmarks

All metrics below are recorded from reproducible benchmark runs documented in **[docs/BENCHMARKS.md](docs/BENCHMARKS.md)** (measured on an Intel Core i3-1115G4 @ 3.00GHz, 8GB RAM, Windows 11, Node v24.11.0).

### 1. Multi-Bitrate HLS Transcoding (`npm run bench:transcode`)
* **Input**: 60-second synthetic 720p @ 30fps clip (1.28 MB input).
* **360p HLS Profile** (640x360 @ 600 kbps): **19.38s** wall-clock (3.10x realtime).
* **720p HLS Profile** (1280x720 @ 2500 kbps): **22.15s** wall-clock (2.71x realtime).
* **Full Pipeline** (including 5x5 storyboard sprites & master manifest): **65.68s** (0.91x realtime).

### 2. HTTP 206 Streaming Range Requests (`npm run bench:stream`)
* **Input**: 50 MB local MP4 video file, 1 MB range slices.
* **100 Sequential Requests**:
  * TTFB: **12.16 ms** average (p50: **6.66 ms**, p95: **26.05 ms**).
  * Throughput: **70.95 MB/s** average (p50: **78.01 MB/s**, p95: **109.02 MB/s**).
* **20 Concurrent Requests**:
  * TTFB: **66.37 ms** average (p50: **62.17 ms**, p95: **103.54 ms**).
  * Throughput: **5.25 MB/s** average (p50: **5.26 MB/s**, p95: **5.55 MB/s**).

### 3. Watch Party WebSockets Clock Synchronization (`npm run bench:sync`)
* **Workload**: 1 Host + 4 simulated client sockets over 60 seconds with 1 initial PLAY and 12 periodic SEEK actions every 5 seconds.
* **Client Clock Drift**:
  * Average: **2.31 ms**
  * p50 (Median): **1.70 ms**
  * p95: **8.80 ms**
  * Maximum Observed: **9.08 ms**

---

## 🔒 Security Architecture

### What Is Implemented
* **Constant-Time HMAC-SHA256 Token Verification**: Stream signatures use `crypto.timingSafeEqual` to defend against timing side-channel attacks.
* **Signed URL Token Expiry & Clamping**: Stream expiration timestamps are parsed as integers, rejected on NaN/negative, and strictly clamped between 60 and 86,400 seconds.
* **Production Startup Safeguards**: The API throws an error at boot in production if `STREAM_SECRET` or `CORS_ORIGIN` are missing or default to open wildcards.
* **Strict CORS Whitelisting**: Dynamic origin validation with `credentials: true` applied consistently to both Express and Socket.IO servers.
* **TUS Upload Protection**: Unauthenticated TUS upload initialization is rejected with 401; user ownership is attached on the server from the verified JWT, stripping client metadata overrides.
* **Owner-Only Media Guards**: Non-owners attempting to update, delete, or stream unpublished media are rejected with 403 Forbidden.
* **Two-Tier Rate Limiting**: General API limiter (300 req / 15 min) and strict auth limiter (10 req / 15 min for login, register, refresh-token). Stream range endpoints are explicitly excluded to preserve seek responsiveness.
* **HTTP Security Headers**: `helmet` is configured with `crossOriginResourcePolicy: { policy: "cross-origin" }` and exposed TUS headers.
* **Schema Validation**: Request bodies for authentication, comments, videos, playlists, and tweets are validated with `zod`.
* **Socket Validation & Chat Throttling**: 500-character chat limits and a 5-message per 5-second sliding window limit per socket.

### What Is Not Implemented
* **No Token Blacklist Store**: Refresh tokens are invalidated on logout in the database, but there is no centralized Redis revocation blacklist for instantaneous mid-session JWT invalidation.
* **No Bot / CAPTCHA Verification**: Registration and login endpoints rely purely on IP rate limits without CAPTCHA or proof-of-work challenges.
* **No End-to-End Chat Encryption**: Watch party chat messages are transmitted as plaintext JSON over WSS.
* **No Antivirus / Malware Scanning**: Uploaded video files are checked for MIME type but are not scanned through an antivirus engine prior to transcoding.
* **Static Segment Token Validation**: Individual `.ts` chunks served under static `/uploads/hls` do not enforce HMAC signatures; signature checks are enforced on the manifest and master stream endpoints.

---

## ⚖️ Design Decisions & Trade-Offs

1. **TUS Resumable Protocol vs. Standard Multipart Uploads**:
   Standard multipart HTTP uploads fail entirely on transient network disconnects, forcing multi-gigabyte uploads to start over from byte 0. TUS breaks uploads into deterministic chunks with `Upload-Offset` tracking, allowing interrupted mobile and broadband uploads to resume seamlessly.
2. **Apple HLS vs. Raw Progressive MP4**:
   Progressive MP4 delivery serves a single static bitrate, causing buffer starvation on slower cellular networks. HLS packages media into adaptive multi-bitrate profiles (360p, 720p) with `.ts` segments, allowing client video players to adjust quality dynamically based on measured bandwidth.
3. **BullMQ Background Queue vs. In-Process FFmpeg**:
   Video transcoding is extremely CPU-bound. Running FFmpeg synchronously inside an Express request handler locks Node.js's event loop and risks server crashes under concurrent uploads. Offloading jobs to BullMQ backed by Redis provides worker concurrency control, exponential backoff retries, and failure tracking without blocking the API.
4. **Host-Authoritative Synchronization vs. Peer-to-Peer Sync**:
   Allowing all watch party participants to broadcast playback updates creates state race conditions and seek wars. A host-authoritative model establishes a single source of truth for the room clock, while automated host handover guarantees continuity if the host drops.
5. **WebVTT Keyframe Sprite Sheets vs. Individual Thumbnail Files**:
   Fetching individual image files during player timeline scrubbing would flood the server with hundreds of small HTTP requests. Stitching frames into 5x5 sprite sheets with WebVTT `#xywh` coordinate cues batches 25 preview thumbnails per network request.
6. **HTTP Range Clamping vs. Strict 416 Rejection**:
   Many browsers and media decoders send speculative Range headers where the requested end byte exceeds the file size. Throwing `416 Range Not Satisfiable` interrupts player buffering; clamping the end byte to `fileSize - 1` and returning `206 Partial Content` ensures uninterrupted seeking.

---

## ⚠️ Known Limitations

1. **Single-Node Socket.IO In-Memory Rooms**:
   Room state and socket mappings are currently stored in memory (`Map`). Scaling the API horizontally across multiple servers requires configuring `@socket.io/redis-adapter` so room state is shared across instances.
2. **No Production Concurrency Load Testing**:
   While unit, integration, and micro-benchmarks pass, the platform has not undergone distributed load testing simulating thousands of simultaneous viewers or concurrent transcoding queues.
3. **CPU-Bound Software Transcoding**:
   The transcoding worker relies on software-based `libx264` (`-preset veryfast`). Transcoding times scale directly with CPU capabilities; hardware-accelerated encoders (NVIDIA NVENC, Intel QuickSync, Apple VideoToolbox) are not currently utilized.
4. **Static HLS Segment Access**:
   While master stream endpoints enforce HMAC signatures, individual `.ts` HLS chunks are statically routed under `/uploads/hls` and do not re-verify HMAC signatures per chunk.
5. **Loopback Benchmark Caveats**:
   The synchronization benchmark in `docs/BENCHMARKS.md` was conducted over local loopback (`127.0.0.1`) with simulated player clocks; real-world mobile networks with WAN jitter, packet loss, and browser audio decode buffer latency will observe higher drift.

---

## 📄 License & Author

This project is licensed under the terms of the **[MIT License](LICENSE)**.

* **Author**: Harsh Pratap Singh
* **GitHub**: [@harsh2102004](https://github.com/harsh2102004)
* **Repository**: [https://github.com/harsh2102004/resume](https://github.com/harsh2102004/resume)
