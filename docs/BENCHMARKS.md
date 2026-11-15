# PulseCast Engine Performance Benchmarks

This document records the measured performance characteristics of the PulseCast backend media engine across three primary operations:
1. Multi-bitrate HLS Video Transcoding (`scripts/bench/transcode.bench.js`)
2. Native HTTP 206 Partial Content Streaming (`scripts/bench/stream.bench.js`)
3. Real-Time Watch Party WebSockets Clock Synchronization (`scripts/bench/sync.bench.js`)

All metrics were gathered using the native benchmark scripts in `scripts/bench/`.

---

## 🖥️ Benchmark Environment

| Specification | Details |
| :--- | :--- |
| **Operating System** | Windows 11 Home (`Windows_NT 10.0.26200 x64`) |
| **Processor (CPU)** | 11th Gen Intel(R) Core(TM) i3-1115G4 @ 3.00GHz (2 cores / 4 threads) |
| **System Memory (RAM)** | 7.65 GB DDR4 |
| **Node.js Runtime** | `v24.11.0` |
| **Database** | In-memory MongoDB (`mongodb-memory-server v10.1.4`) |
| **FFmpeg Version** | Static build via `@ffmpeg-installer/ffmpeg v1.1.0` (libx264 / aac) |

---

## 📊 Benchmark Results

### 1. Video Transcoding Benchmark (`npm run bench:transcode`)

* **Test Input**: 60-second synthetic 720p @ 30fps clip generated with FFmpeg (`testsrc` + `sine`, 1.28 MB).
* **Pipeline Executed**: Real `transcodeVideoJob` worker pipeline generating WebVTT storyboard sprites, 360p HLS stream, 720p HLS stream, master playlist, and status updates.

| Transcode Phase | Wall-Clock Time | Processing Speed | Output Spec |
| :--- | :--- | :--- | :--- |
| **360p HLS Profile** | 19.38s | 3.10x realtime | 640x360 @ 600 kbps video, 64 kbps audio |
| **720p HLS Profile** | 22.15s | 2.71x realtime | 1280x720 @ 2500 kbps video, 128 kbps audio |
| **Full Transcode Pipeline** (inc. Storyboards & Manifest) | **65.68s** | **0.91x realtime** | Master HLS playlist + Storyboard sprites |

---

### 2. HTTP 206 Streaming Benchmark (`npm run bench:stream`)

* **Test Input**: 50 MB local MP4 media asset (`storage/bench-50mb.mp4`).
* **Workload**: Range requests requesting 1 MB chunks at varying file offsets.

| Benchmark Scenario | Metric | Average | p50 (Median) | p95 |
| :--- | :--- | :--- | :--- | :--- |
| **100 Sequential Requests** (1 MB each) | **TTFB** | 12.16 ms | 6.66 ms | 26.05 ms |
| | **Throughput** | 70.95 MB/s | 78.01 MB/s | 109.02 MB/s |
| **20 Concurrent Requests** (1 MB each) | **TTFB** | 66.37 ms | 62.17 ms | 103.54 ms |
| | **Throughput** | 5.25 MB/s | 5.26 MB/s | 5.55 MB/s |

---

### 3. Watch Party Clock Sync Benchmark (`npm run bench:sync`)

* **Architecture**: 1 Host + 4 Participant Client Sockets connected to `/watch-party` over WebSockets.
* **Workload**: 60-second continuous playback simulation with 1 initial `PLAY` and 12 periodic `SEEK` actions issued every 5 seconds.
* **Measurement**: Absolute delta $| \text{Client Clock} - \text{Host Clock} |$ measured across all 4 clients 300ms after each seek event (48 observations total).

| Metric | Measured Value |
| :--- | :--- |
| **Average Client Drift** | **2.31 ms** |
| **p50 (Median Drift)** | **1.70 ms** |
| **p95 Drift** | **8.80 ms** |
| **Maximum Drift Observed** | **9.08 ms** |

---

## 🔍 Honest Limitations & Caveats

1. **Local Loopback Network**: Benchmarks executed over `127.0.0.1` (loopback). Measured network latency is sub-millisecond; real WAN conditions will introduce geographic round-trip delays, packet loss, and jitter.
2. **Headless Simulated Players**: Sockets were benchmarked using Node.js `socket.io-client` with a synthetic math clock, not real browser media rendering pipelines (`HTMLVideoElement` / Web Audio API) which may experience hardware decode buffering.
3. **Software Encoding Only**: FFmpeg transcoding used CPU-based `libx264` (`-preset veryfast`). Hardware-accelerated encoders (NVIDIA NVENC, Intel QuickSync, Apple VideoToolbox) were not benchmarked.
4. **Single-Node In-Memory Storage**: Tests did not include Cloudinary remote upload latency or Atlas replica set latency.

