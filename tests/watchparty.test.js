import test from "node:test";
import assert from "node:assert/strict";
import { io as ioClient } from "socket.io-client";
import { setupTestEnvironment } from "./helpers/setup.js";

let testEnv;

test.before(async () => {
    testEnv = await setupTestEnvironment();
});

test.after(async () => {
    await testEnv.teardown();
});

test("Watch Party: First user to join becomes room host", async () => {
    const socketUrl = `${testEnv.baseUrl}/watch-party`;
    const roomId = `room-host-${Date.now()}`;

    const client = ioClient(socketUrl, { transports: ["websocket"] });
    await new Promise((resolve) => client.on("connect", resolve));

    client.emit("join-room", { roomId, username: "HostUser" });
    const state = await new Promise((resolve) => client.on("room-state", resolve));

    assert.equal(state.hostSocketId, client.id);
    assert.equal(state.roomId, roomId);

    client.disconnect();
});

test("Watch Party: Host sync-action is broadcast to participants", async () => {
    const socketUrl = `${testEnv.baseUrl}/watch-party`;
    const roomId = `room-sync-${Date.now()}`;

    const host = ioClient(socketUrl, { transports: ["websocket"] });
    const guest = ioClient(socketUrl, { transports: ["websocket"] });

    await Promise.all([
        new Promise((resolve) => host.on("connect", resolve)),
        new Promise((resolve) => guest.on("connect", resolve)),
    ]);

    host.emit("join-room", { roomId, username: "SyncHost" });
    await new Promise((resolve) => host.on("room-state", resolve));

    guest.emit("join-room", { roomId, username: "SyncGuest" });
    await new Promise((resolve) => guest.on("room-state", resolve));

    const syncPromise = new Promise((resolve) => guest.on("sync-action", resolve));
    host.emit("sync-action", { action: "PLAY", currentTime: 55.0 });
    const sync = await syncPromise;

    assert.equal(sync.action, "PLAY");
    assert.equal(sync.currentTime, 55.0);

    host.disconnect();
    guest.disconnect();
});

test("Watch Party: Non-host sync-action is ignored and returns sync-error", async () => {
    const socketUrl = `${testEnv.baseUrl}/watch-party`;
    const roomId = `room-guest-${Date.now()}`;

    const host = ioClient(socketUrl, { transports: ["websocket"] });
    const guest = ioClient(socketUrl, { transports: ["websocket"] });

    await Promise.all([
        new Promise((resolve) => host.on("connect", resolve)),
        new Promise((resolve) => guest.on("connect", resolve)),
    ]);

    host.emit("join-room", { roomId, username: "PermHost" });
    await new Promise((resolve) => host.on("room-state", resolve));

    guest.emit("join-room", { roomId, username: "PermGuest" });
    await new Promise((resolve) => guest.on("room-state", resolve));

    let hostSawAction = false;
    host.on("sync-action", () => {
        hostSawAction = true;
    });

    const errorPromise = new Promise((resolve) => guest.on("sync-error", resolve));
    guest.emit("sync-action", { action: "PAUSE", currentTime: 10.0 });
    const error = await errorPromise;

    assert.ok(error.message.includes("host"));
    assert.equal(hostSawAction, false);

    host.disconnect();
    guest.disconnect();
});

test("Watch Party: Host disconnect hands over host role to remaining participant", async () => {
    const socketUrl = `${testEnv.baseUrl}/watch-party`;
    const roomId = `room-handover-${Date.now()}`;

    const host = ioClient(socketUrl, { transports: ["websocket"] });
    const guest = ioClient(socketUrl, { transports: ["websocket"] });

    await Promise.all([
        new Promise((resolve) => host.on("connect", resolve)),
        new Promise((resolve) => guest.on("connect", resolve)),
    ]);

    host.emit("join-room", { roomId, username: "OldHost" });
    await new Promise((resolve) => host.on("room-state", resolve));

    guest.emit("join-room", { roomId, username: "NextHost" });
    await new Promise((resolve) => guest.on("room-state", resolve));

    const handoverPromise = new Promise((resolve) => guest.on("host-changed", resolve));
    host.disconnect();
    const handover = await handoverPromise;

    assert.equal(handover.hostSocketId, guest.id);

    guest.disconnect();
});
