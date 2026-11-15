import test from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment, createTestUser, createTestVideo } from "./helpers/setup.js";
import { Video } from "../src/models/video.model.js";

let testEnv;

test.before(async () => {
    testEnv = await setupTestEnvironment();
});

test.after(async () => {
    await testEnv.teardown();
});

test.beforeEach(async () => {
    await testEnv.clearDb();
});

test("Videos: Update video by owner succeeds with 200", async () => {
    const { user, authHeaders } = await createTestUser();
    const video = await createTestVideo(user._id, { title: "Original Title", description: "Original Description" });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/${video._id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ title: "Updated Title", description: "Updated Description" }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, "Updated Title");

    const inDb = await Video.findById(video._id);
    assert.equal(inDb.title, "Updated Title");
});

test("Videos: Update video by non-owner returns 403 Forbidden", async () => {
    const owner = await createTestUser({ username: "owneruser", email: "owner@example.com" });
    const nonOwner = await createTestUser({ username: "otheruser", email: "other@example.com" });
    const video = await createTestVideo(owner.user._id, { title: "Protected Video" });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/${video._id}`, {
        method: "PATCH",
        headers: nonOwner.authHeaders,
        body: JSON.stringify({ title: "Hacked Title" }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);

    const inDb = await Video.findById(video._id);
    assert.equal(inDb.title, "Protected Video");
});

test("Videos: Delete video by non-owner returns 403 Forbidden", async () => {
    const owner = await createTestUser({ username: "videoowner", email: "videoowner@example.com" });
    const intruder = await createTestUser({ username: "intruder", email: "intruder@example.com" });
    const video = await createTestVideo(owner.user._id);

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/${video._id}`, {
        method: "DELETE",
        headers: intruder.authHeaders,
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);

    const inDb = await Video.findById(video._id);
    assert.ok(inDb, "Video must not be deleted by non-owner");
});

test("Videos: Delete video by owner succeeds with 200 and removes it", async () => {
    const { user, authHeaders } = await createTestUser();
    const video = await createTestVideo(user._id);

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/${video._id}`, {
        method: "DELETE",
        headers: authHeaders,
    });

    assert.equal(res.status, 200);
    const inDb = await Video.findById(video._id);
    assert.equal(inDb, null);
});

test("Videos: Unpublished video is hidden from public getAllVideos results", async () => {
    const { user } = await createTestUser();
    await createTestVideo(user._id, { title: "Public Video 1", isPublished: true });
    await createTestVideo(user._id, { title: "Secret Unpublished Video", isPublished: false });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const videoDocs = body.data.docs || [];
    assert.equal(videoDocs.length, 1);
    assert.equal(videoDocs[0].title, "Public Video 1");
    assert.ok(!videoDocs.some((v) => v.title.includes("Secret")));
});

test("Videos: GET /api/v1/videos/:videoId returns video details with view increment", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id, { views: 5 });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/${video._id}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, video.title);
    assert.equal(body.data.views, 6);
});

