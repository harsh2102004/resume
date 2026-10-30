# PulseCast — Production-Grade Distributed Media Streaming & Watch Party Platform

<div align="center">

![PulseCast Banner](https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80)

[![PulseCast CI/CD Pipeline](https://github.com/harsh2102004/resume/actions/workflows/ci.yml/badge.svg)](https://github.com/harsh2102004/resume/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/Node.js-v18%20|%20v20%20|%20v22-green.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deployed on Render](https://img.shields.io/badge/Backend-Render-46E3B7.svg)](https://pulsecast-qff8.onrender.com)
[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel-000000.svg)](https://resume-zeta-one-86.vercel.app)

**A high-performance media platform featuring TUS resumable uploads, Cloudinary CDN delivery, FFmpeg HLS adaptive bitrate transcoding, WebVTT storyboard scrubbing sprites, native HTTP 206 chunked streaming, and synchronized real-time Watch Party rooms.**

[Live Web Application](https://resume-zeta-one-86.vercel.app) • [API Service](https://pulsecast-qff8.onrender.com/api/v1/healthcheck) • [Documentation](#-core-engine-features)

</div>

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Live Deployments](#-live-deployments)
- [Core Engine Features](#-core-engine-features)
  - [1. Resumable Ingestion (TUS Protocol)](#1-resumable-video-ingestion-tus-protocol)
  - [2. Cloudinary Global CDN Media Pipeline](#2-cloudinary-global-cdn-media-pipeline)
  - [3. Adaptive Bitrate Transcoding (FFmpeg HLS)](#3-adaptive-bitrate-transcoding-ffmpeg-hls)
  - [4. Storyboard Scrubbing Sprites (WebVTT)](#4-storyboard-scrubbing-sprites-webvtt)
  - [5. Native HTTP 206 Partial Content Streaming](#5-native-http-206-partial-content-streaming)
  - [6. Synchronized Real-Time Watch Party (WebSockets)](#6-synchronized-real-time-watch-party-websockets)
  - [7. Media Tokenization & Stream Security](#7-media-tokenization--stream-security)
  - [8. Channel Profiles & Social Engagement](#8-channel-profiles--social-engagement)
- [Technology Stack](#-technology-stack)
- [REST API Reference](#-rest-api-reference)
- [WebSocket Protocol Specification](#-websocket-protocol-specification)
- [Database Schema & Data Models](#-database-schema--data-models)
- [Local Development & Setup Guide](#-local-development--setup-guide)
- [Automated Testing & CI/CD Pipeline](#-automated-testing--cicd-pipeline)
- [Project Directory Structure](#-project-directory-structure)
- [Contributing & License](#-license)

---

## 🏗️ System Architecture

```
                                  [ Client Layer ]
              ┌───────────────────────────────────────────────────────┐
              │  React 19 + Vite + Tailwind CSS + Hls.js + Socket.io  │
              └───────────────────┬───────────────┬───────────────────┘
                                  │               │
       (1) Resumable Ingestion    │               │  (4) Synchronized Watch Party
       (Chunked PATCH / TUS)      │               │  (WebSockets /watch-party)
                                  ▼               ▼
                     ┌────────────────────────────────┐
                     │     Node.js / Express Core     │
                     │  (Authentication, Rate Limits) │
                     └────────────┬───────────────┬───┘
                                  │               │
            ┌─────────────────────┴───────┐       └─────────────────────┐
            ▼                             ▼                             ▼
  [ Local Staging / Disk ]     [ Cloudinary CDN Engine ]     [ Socket.io Room Sync ]
            │                  (Chunked Large Uploads)       (Host Election, ±50ms Drift)
            ▼                             │
  [ Asynchronous Workers ]                │
   ├── FFmpeg HLS Worker                  │
   │   (360p, 720p, master.m3u8)          │
   └── WebVTT Storyboard Worker           │
       (5x5 sprite sheets, cues)          │
            │                             │
            └──────────────┬──────────────┘
                           ▼
                  [ MongoDB Atlas ]
        (Users, Videos, Subscriptions, Likes,
         Comments, Playlists, Aggregations)
```

---

## 🌐 Live Deployments

| Component | Platform | URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web Client** | Vercel | [https://resume-zeta-one-86.vercel.app](https://resume-zeta-one-86.vercel.app) | `Active (Production)` |
| **Backend REST & WS Engine** | Render | [https://pulsecast-qff8.onrender.com](https://pulsecast-qff8.onrender.com) | `Active (Production)` |
| **Database Cluster** | MongoDB Atlas | Cloud-hosted Replica Set | `Connected` |
| **Media Library & CDN** | Cloudinary | Dedicated Media Bucket (`pulsecast/videos`) | `Operational` |

---

## ⚡ Core Engine Features

### 1. Resumable Video Ingestion (TUS Protocol)
* **Standard-Compliant Handshake:** Implements the open-standard **TUS resumable upload protocol** (`POST`, `PATCH`, `HEAD`, `OPTIONS`) powered by `@tus/server` and `@tus/file-store`.
* **Network-Resilient Chunking:** Breaks massive media files into deterministic byte chunks (2MB default). If a user experiences an interrupted Wi-Fi or mobile network drop, the client issues a `HEAD` request to query the server's exact `Upload-Offset` and resumes immediately without restarting from zero.
* **Client-Side Pause & Resume Controls:** Full interactive UI with progress percentage, uploaded vs. total byte counters, transfer speed indicators, and pause/resume buttons.
* **Protected Upload Gate:** Authenticated upload sessions verified via JWT bearer tokens.

### 2. Cloudinary Global CDN Media Pipeline
* **Chunked Large Uploads:** Uses `cloudinary.uploader.upload_large` with 6MB chunking to upload high-definition video files directly to Cloudinary's media library in the `pulsecast/videos` directory.
* **Permanent CDN Availability:** Media files are automatically assigned high-availability HTTPS CDN links, ensuring video availability even across container restarts and zero-downtime server redeployments.
* **Dynamic Poster Frame Generation:** Automatically derives crystal-clear HD video preview thumbnails from video keyframes (`.jpg` extension mapping) with no secondary rendering cost.
* **Graceful Local-to-Cloud Fallback:** If cloud credentials or networks are unavailable, the engine gracefully falls back to local disk persistence and HTTP 206 chunked streaming.

### 3. Adaptive Bitrate Transcoding (FFmpeg HLS)
* **Multi-Bitrate Generation:** An asynchronous background worker encodes uploaded video into Apple **HLS (HTTP Live Streaming)** bundles:
  * `360p` (640x360 @ 800 kbps, 96 kbps audio)
  * `720p` (1280x720 @ 2800 kbps, 128 kbps audio)
* **HLS Manifest Creation:** Automatically compiles segmented `.ts` chunks with a top-level `master.m3u8` manifest file.
* **Cross-Platform Static Binaries:** Packaged with `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe` for execution across Windows, Linux (Ubuntu/Debian), and macOS environments.
* **Dynamic Watermarking:** Applies branded overlay filters during transcode passes via FFmpeg filter graphs (`movie=... overlay=...`).

### 4. Storyboard Scrubbing Sprites (WebVTT)
* **Thumbnail Sprite Grid Generation:** Periodically captures video frames every 5 seconds and stitches them into high-performance `5x5` sprite sheets (`sprite_%03d.jpg`).
* **WebVTT Cue Compilation:** Generates structured WebVTT cue files specifying spatial coordinates (`#xywh=x,y,w,h`) for timeline hover previews.
* **Interactive Player Scrubbing:** As the viewer hovers their mouse along the timeline scrub bar, the player displays a snapshot of the exact scene under the cursor.

### 5. Native HTTP 206 Partial Content Streaming
* **Range Header Parser:** Natively parses HTTP `Range: bytes=start-end` request headers.
* **Chunked Stream Slices:** Serves 1MB sequential video slices directly from Node.js `fs.createReadStream` with `Content-Range` and `Accept-Ranges: bytes` headers.
* **Instantaneous Seeking:** Viewers can click anywhere on the playback timeline without waiting for preceding video data to download.
* **Out-of-Bounds Protection:** Emits standard `416 Range Not Satisfiable` responses when requested bytes exceed the file size.

### 6. Synchronized Real-Time Watch Party (WebSockets)
* **Room-Based Architecture:** Users can spin up instant watch party rooms (`/watch-party/:roomId`) with unique shareable invite links.
* **Dynamic Host Re-Election:** Rooms elect an active host whose playback controls (`PLAY`, `PAUSE`, `SEEK`) sync to all room members in real time. If the host leaves, the system automatically reassigns host rights to the next active peer.
* **±50ms Drift Compensation:** Client-side algorithm that dynamically tweaks `videoElement.playbackRate` (`1.05x` or `0.95x`) to bring slightly desynchronized clients smoothly back into alignment without audio stutter, and triggers micro-seeks for major latency spikes.
* **Live Room Chat & Presence:** Integrated real-time room chat, user presence badges, and automatic join/leave notification toasts.

### 7. Media Tokenization & Stream Security
* **HMAC-SHA256 Signed URLs:** Generates signed streaming tokens with configurable expiration timestamps (`?expires=...&signature=...`).
* **Constant-Time Verification:** Employs `crypto.timingSafeEqual` during cryptographic verification to defend against side-channel timing attacks.
* **Access Control:** Enforces strict viewing permissions, protecting premium or unlisted media assets.

### 8. Channel Profiles & Social Engagement
* **Channel Profiles:** Customizable channel avatars, cover banners, subscriber counts, total channel video views, and like statistics.
* **Interactive Engagements:** Instant like/unlike for videos, comments, and community tweets with optimistic UI updates and state persistence.
* **Threaded Comment Section:** Full CRUD comment system supporting user mentions, timestamps, and nested interactions.
* **Playlist Management:** Create, update, reorder, and curate custom video playlists.
* **Creator Analytics Dashboard:** Real-time stats on total channel views, subscriber trajectories, video counts, and individual video performance metrics.

---

## 🛠️ Technology Stack

| Domain | Technology / Library | Purpose |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v18, v20, v22) | High-concurrency asynchronous runtime |
| **Web Framework** | Express.js 4.x | REST API routing and middleware composition |
| **Media Ingestion** | `@tus/server`, `@tus/file-store` | Open-standard TUS resumable chunked file transfers |
| **Media Processing** | `fluent-ffmpeg`, `@ffmpeg-installer` | Video transcoding, HLS segmentation, sprite generation |
| **Cloud Storage & CDN**| Cloudinary SDK v2 | Chunked large media uploads, global CDN delivery, poster frames |
| **Real-Time Sockets** | Socket.io 4.x | Bi-directional WebSocket communication for Watch Party rooms |
| **Database & ORM** | MongoDB Atlas, Mongoose 8.x | Document storage, multi-stage aggregation pipelines, pagination |
| **Security & Auth** | JSON Web Tokens (`jsonwebtoken`), `bcrypt` | Stateless access/refresh token rotation, password hashing |
| **Frontend Framework** | React 19, Vite 8.x | Component architecture, fast HMR bundling |
| **Styling & Design** | Tailwind CSS v4, Lucide Icons | Responsive dark-mode glassmorphic interface |
| **Video Playback** | Hls.js, HTML5 Media API | Adaptive stream playback, custom controls, WebVTT rendering |
| **Testing Engine** | Node.js native test runner (`node:test`) | Unit, security, and integration test execution |
| **CI/CD Pipeline** | GitHub Actions | Automated build, test, and lint validation across matrix |
| **Hosting & PaaS** | Vercel (Client), Render (API) | Global edge hosting with automated git deployments |

---

## 📡 REST API Reference

All REST endpoints are rooted under `/api/v1`.

### 🔑 Authentication & Users (`/api/v1/users`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Register new user account with avatar and cover image | No |
| `POST` | `/login` | Authenticate user and receive access & refresh tokens | No |
| `POST` | `/logout` | Invalidate current user session | Yes |
| `POST` | `/refresh-token` | Renew expired access token using refresh token | No |
| `POST` | `/change-password` | Update account password | Yes |
| `GET` | `/current-user` | Retrieve authenticated user profile | Yes |
| `PATCH` | `/update-account` | Update full name and email | Yes |
| `PATCH` | `/avatar` | Upload new user avatar | Yes |
| `PATCH` | `/cover-image` | Upload new user channel banner | Yes |
| `GET` | `/c/:username` | Retrieve channel profile and subscriber metrics | Optional |
| `GET` | `/history` | Fetch user watch history | Yes |

### 🎥 Videos & Streaming (`/api/v1/videos`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `ALL` | `/resumable-upload*`| TUS protocol resumable video upload gateway | Yes (on POST) |
| `GET` | `/` | Query published videos (search, sorting, pagination) | No |
| `POST` | `/` | Publish new video via multipart upload | Yes |
| `GET` | `/:videoId` | Get video details, owner profile, and metrics | No |
| `PATCH` | `/:videoId` | Update video title, description, and thumbnail | Yes |
| `DELETE` | `/:videoId` | Permanently remove video | Yes |
| `PATCH` | `/toggle/publish/:videoId` | Toggle video public/unlisted visibility | Yes |
| `GET` | `/stream/:videoId` | HTTP 206 chunked range video stream | Optional / Signed |
| `GET` | `/stream-url/:videoId` | Generate time-expiring HMAC signed stream URL | Yes |

### 💬 Social & Community (`/api/v1`)
| Group | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Likes** | `POST` | `/likes/toggle/v/:videoId` | Toggle like on a video |
| | `POST` | `/likes/toggle/c/:commentId` | Toggle like on a comment |
| | `POST` | `/likes/toggle/t/:tweetId` | Toggle like on a tweet |
| | `GET` | `/likes/videos` | Fetch list of videos liked by user |
| **Comments** | `GET` | `/comments/:videoId` | Get paginated comments for a video |
| | `POST` | `/comments/:videoId` | Add comment to a video |
| | `PATCH` | `/comments/c/:commentId` | Edit comment content |
| | `DELETE` | `/comments/c/:commentId` | Remove comment |
| **Subscriptions** | `POST` | `/subscriptions/c/:channelId` | Subscribe / unsubscribe from a channel |
| | `GET` | `/subscriptions/c/:channelId` | Get list of subscribers for a channel |
| | `GET` | `/subscriptions/u/:subscriberId`| Get list of channels user is subscribed to |
| **Playlists** | `POST` | `/playlist` | Create new playlist |
| | `GET` | `/playlist/:playlistId` | Get playlist details and videos |
| | `PATCH` | `/playlist/:playlistId` | Update playlist title and description |
| | `DELETE` | `/playlist/:playlistId` | Delete playlist |
| | `PATCH` | `/playlist/add/:videoId/:playlistId` | Add video to playlist |
| | `PATCH` | `/playlist/remove/:videoId/:playlistId` | Remove video from playlist |
| | `GET` | `/playlist/user/:userId` | Get all playlists owned by user |
| **Dashboard** | `GET` | `/dashboard/stats` | Channel analytics (views, subscribers, likes) |
| | `GET` | `/dashboard/videos` | All videos uploaded by the channel |
| **Health** | `GET` | `/healthcheck` | Service liveness validation (`200 OK`) |

---

## 🔌 WebSocket Protocol Specification

The real-time Watch Party service runs on the `/watch-party` namespace.

```javascript
import { io } from "socket.io-client";

const socket = io("wss://pulsecast-qff8.onrender.com/watch-party", {
  transports: ["websocket"]
});
```

### Event Schema

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join-room` | Client ➔ Server | `{ roomId, user: { _id, username } }` | Joins a watch party room |
| `leave-room` | Client ➔ Server | `{ roomId }` | Leaves current watch room |
| `sync-state` | Client ➔ Server | `{ roomId, state: { currentTime, isPlaying } }` | Host broadcasts playback timestamp |
| `player-state-update` | Server ➔ Client | `{ currentTime, isPlaying, hostId, updatedAt }` | Peers synchronize playback state |
| `host-change` | Server ➔ Client | `{ hostId, hostUsername }` | Notifies room of elected host |
| `chat-message` | Bi-directional | `{ roomId, message, sender, timestamp }` | Live room chat messaging |
| `user-joined` | Server ➔ Client | `{ user, activeUsers }` | New peer joined presence list |
| `user-left` | Server ➔ Client | `{ user, activeUsers }` | Peer disconnected presence update |

---

## 🗄️ Database Schema & Data Models

PulseCast uses optimized Mongoose schemas with compound indexes and aggregate pagination:

* **User Schema:** `username`, `email`, `fullName`, `avatar`, `coverImage`, `password` (hashed via bcrypt), `refreshToken`, `watchHistory` (array of `Video` references).
* **Video Schema:** `videoFile` (CDN or stream URL), `localPath`, `thumbnail`, `title`, `description`, `duration`, `views`, `fileSize`, `mimeType`, `hlsPath`, `transcodingStatus` (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), `qualities`, `storyboardVtt`, `isPublished`, `owner`.
* **Subscription Schema:** `subscriber` (`User` ref), `channel` (`User` ref).
* **Like Schema:** `video` (`Video` ref), `comment` (`Comment` ref), `tweet` (`Tweet` ref), `likedBy` (`User` ref).
* **Comment Schema:** `content`, `video` (`Video` ref), `owner` (`User` ref).
* **Playlist Schema:** `name`, `description`, `videos` (array of `Video` refs), `owner` (`User` ref).
* **Tweet Schema:** `content`, `owner` (`User` ref).

---

## 💻 Local Development & Setup Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas URI
- **Cloudinary Account**: Free tier cloud credentials (Cloud Name, API Key, API Secret)

### 2. Clone Repository
```bash
git clone https://github.com/harsh2102004/resume.git pulsecast
cd pulsecast
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Server
PORT=8000
CORS_ORIGIN=*

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net
DB_NAME=pulsecast

# JWT Authentication
ACCESS_TOKEN_SECRET=your_super_secret_access_token_key_here_32_chars
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_super_secret_refresh_token_key_here_32_chars
REFRESH_TOKEN_EXPIRY=10d

# Cloudinary CDN
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Media Security
STREAM_SECRET=your_hmac_sha256_stream_secret_key
ENFORCE_SIGNED_STREAMS=false
```

Create `frontend/.env` for the client:
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/watch-party
```

### 4. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 5. Launch Servers
Open two terminal windows:

**Terminal 1 (Backend Engine):**
```bash
npm run dev
# Server running at http://localhost:8000
```

**Terminal 2 (Frontend Client):**
```bash
cd frontend
npm run dev
# Client running at http://localhost:5173
```

---

## 🧪 Automated Testing & CI/CD Pipeline

PulseCast includes an automated end-to-end integration test suite utilizing Node.js's native test runner (`node:test`) and assertion engine (`node:assert`):

```bash
npm test
```

### Test Suite Execution
```text
✔ GET /api/v1/healthcheck should return 200 OK (109ms)
✔ TUS Protocol: OPTIONS discovery should declare TUS capabilities (8ms)
✔ TUS Protocol: POST should reject unauthenticated uploads with 401 (8ms)
✔ TUS Protocol: POST should create a resumable upload session when authenticated (28ms)
✔ Media Security: Signed stream URL generation & verification (1ms)
✔ Media Security: Tampered signature returns HTTP 403 Forbidden (9ms)
✔ HTTP 206 Streaming: Should return 400 for invalid video ObjectId format (7ms)

ℹ tests 7 | pass 7 | fail 0 | cancelled 0
```

### GitHub Actions CI/CD (`.github/workflows/ci.yml`)
On every push and pull request to `main`, GitHub Actions triggers a build pipeline that:
1. Provisions Ubuntu environments with multiple Node.js matrix versions (v18, v20, v22).
2. Spawns an in-memory MongoDB service container (`mongo:7.0`).
3. Executes automated linting and syntax validation.
4. Runs the native test suite and verifies 100% test pass rate.
5. Deploys passing builds automatically to Render (Backend) and Vercel (Frontend).

---

## 📂 Project Directory Structure

```text
pulsecast/
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated GitHub Actions CI/CD Pipeline
├── frontend/                    # React 19 Client Application
│   ├── src/
│   │   ├── components/          # Reusable UI (Navbar, Player, Comments, Room)
│   │   ├── config/              # API & WebSocket connection endpoints
│   │   ├── context/             # AuthContext state management
│   │   ├── data/                # Sample video assets & recommendations
│   │   ├── pages/               # Home, Watch, Upload, Profile, Login, Register
│   │   ├── utils/               # TusUploader client & helpers
│   │   ├── App.jsx              # Application router
│   │   └── main.jsx             # Entry point
│   ├── package.json
│   ├── vercel.json              # Client SPA routing rewrite rules
│   └── vite.config.js
├── public/                      # Static assets & temporary uploads
├── src/                         # Backend Application Source
│   ├── controllers/             # Express controllers (user, video, stream, etc.)
│   ├── db/                      # MongoDB connection bootstrap
│   ├── middlewares/             # Auth, multer, error handling middlewares
│   ├── models/                  # Mongoose data schemas
│   ├── routes/                  # Express route definitions
│   ├── services/                # TUS resumable server service
│   ├── sockets/                 # Socket.io watch party rooms
│   ├── utils/                   # Cloudinary uploaders, ApiError, ApiResponse
│   ├── workers/                 # FFmpeg transcoding & storyboard workers
│   ├── app.js                   # Express application setup
│   ├── constants.js             # Global constants & database names
│   └── index.js                 # Server entry point & socket listener
├── tests/                       # Native Node.js test suite
│   ├── healthcheck.test.js
│   ├── media.security.test.js
│   └── tus.test.js
├── vercel.json                  # Root SPA fallback
├── package.json
└── README.md
```

---

## 📄 License

This project is open-source and licensed under the terms of the **[MIT License](LICENSE)**.

---

<div align="center">

**Developed by [Harsh Pratap Singh](https://github.com/harsh2102004)**

*Built with Node.js, Express, FFmpeg, Cloudinary, WebSockets, and React 19.*

</div>