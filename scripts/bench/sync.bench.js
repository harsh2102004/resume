import { performance } from "perf_hooks";
import { io as ioClient } from "socket.io-client";
import { setupTestEnvironment } from "../../tests/helpers/setup.js";

function getPercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function getAverage(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

class SimulatedPlayer {
    constructor(id) {
        this.id = id;
        this.currentTime = 0;
        this.isPlaying = false;
        this.lastUpdateTime = performance.now();
    }

    getCurrentTime() {
        if (!this.isPlaying) return this.currentTime;
        const elapsed = (performance.now() - this.lastUpdateTime) / 1000;
        return this.currentTime + elapsed;
    }

    play(time) {
        if (typeof time === "number") this.currentTime = time;
        this.isPlaying = true;
        this.lastUpdateTime = performance.now();
    }

    pause(time) {
        if (typeof time === "number") this.currentTime = time;
        this.isPlaying = false;
        this.lastUpdateTime = performance.now();
    }

    seek(time) {
        this.currentTime = time;
        this.lastUpdateTime = performance.now();
    }
}

async function runSyncBenchmark() {
    console.log("=== PulseCast Watch Party Clock Sync Benchmark ===");
    console.log("Starting server and WebSockets...");

    const testEnv = await setupTestEnvironment();
    const socketUrl = `${testEnv.baseUrl}/watch-party`;
    const roomId = `bench-room-${Date.now()}`;

    console.log("Connecting 1 host and 4 participant clients...");
    const hostSocket = ioClient(socketUrl, { transports: ["websocket"] });
    const hostPlayer = new SimulatedPlayer("host");

    const clientSockets = Array.from({ length: 4 }, (_, i) => ({
        id: `client-${i + 1}`,
        socket: ioClient(socketUrl, { transports: ["websocket"] }),
        player: new SimulatedPlayer(`client-${i + 1}`),
    }));

    // Wait for all connections
    await Promise.all([
        new Promise((resolve) => hostSocket.on("connect", resolve)),
        ...clientSockets.map((c) => new Promise((resolve) => c.socket.on("connect", resolve))),
    ]);

    // Host joins first
    hostSocket.emit("join-room", { roomId, username: "HostBench" });
    await new Promise((resolve) => hostSocket.on("room-state", resolve));

    // Clients join
    await Promise.all(
        clientSockets.map(
            (c) =>
                new Promise((resolve) => {
                    c.socket.emit("join-room", { roomId, username: c.id });
                    c.socket.on("room-state", resolve);
                })
        )
    );

    // Wire up client sync-action listener
    for (const c of clientSockets) {
        c.socket.on("sync-action", (data) => {
            if (data.action === "PLAY") {
                c.player.play(data.currentTime);
            } else if (data.action === "PAUSE") {
                c.player.pause(data.currentTime);
            } else if (data.action === "SEEK") {
                c.player.seek(data.currentTime);
            }
        });
    }

    console.log("All participants joined. Starting 60s benchmark (SEEK every 5 seconds)...\n");

    // Host sends initial PLAY
    hostPlayer.play(0);
    hostSocket.emit("sync-action", { action: "PLAY", currentTime: 0 });

    const totalCycles = 12; // 12 * 5s = 60s
    const driftMeasurements = [];

    for (let cycle = 1; cycle <= totalCycles; cycle++) {
        // Wait 4.7s of continuous playback
        await new Promise((resolve) => setTimeout(resolve, 4700));

        // Host performs a SEEK action
        const seekPosition = 10 + cycle * 12.5;
        hostPlayer.seek(seekPosition);
        hostSocket.emit("sync-action", { action: "SEEK", currentTime: seekPosition });

        // Allow 300ms settling time for socket delivery
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Sample drift against host clock
        const hostNow = hostPlayer.getCurrentTime();
        const cycleDrifts = [];

        for (const c of clientSockets) {
            const clientNow = c.player.getCurrentTime();
            const diffMs = Math.abs(clientNow - hostNow) * 1000;
            driftMeasurements.push(diffMs);
            cycleDrifts.push(diffMs);
        }

        const cycleAvg = getAverage(cycleDrifts).toFixed(2);
        console.log(`Cycle ${cycle.toString().padStart(2, " ")}/${totalCycles} (t = ${cycle * 5}s): Host time ${hostNow.toFixed(2)}s | Avg Client Drift: ${cycleAvg} ms`);
    }

    // Print summary statistics
    const avgDrift = getAverage(driftMeasurements);
    const p50Drift = getPercentile(driftMeasurements, 50);
    const p95Drift = getPercentile(driftMeasurements, 95);
    const maxDrift = Math.max(...driftMeasurements);

    console.log("\n--- Watch Party Synchronization Results ---");
    console.log(`Participants: 1 Host + 4 Clients (simulated clocks)`);
    console.log(`Test Duration: 60 seconds (12 seek events @ 5s intervals)`);
    console.log(`Total Samples: ${driftMeasurements.length} client observations`);
    console.log(`Average Drift: ${avgDrift.toFixed(2)} ms`);
    console.log(`p50 (Median):  ${p50Drift.toFixed(2)} ms`);
    console.log(`p95 Drift:     ${p95Drift.toFixed(2)} ms`);
    console.log(`Max Drift:     ${maxDrift.toFixed(2)} ms`);
    console.log("-------------------------------------------\n");

    // Cleanup
    hostSocket.disconnect();
    for (const c of clientSockets) {
        c.socket.disconnect();
    }
    await testEnv.teardown();
}

runSyncBenchmark().catch((err) => {
    console.error("Sync benchmark failed:", err);
    process.exit(1);
});

