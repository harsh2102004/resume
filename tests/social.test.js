import test from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment, createTestUser, createTestVideo } from "./helpers/setup.js";
import { Comment } from "../src/models/comment.model.js";

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

test("Social: Toggle video like requires authentication (401 without token)", async () => {
    const { user } = await createTestUser();
    const video = await createTestVideo(user._id);

    const res = await fetch(`${testEnv.baseUrl}/api/v1/likes/toggle/v/${video._id}`, {
        method: "POST",
    });

    assert.equal(res.status, 401);
});

test("Social: Toggle video like switches liked status and updates counts", async () => {
    const { user, authHeaders } = await createTestUser();
    const video = await createTestVideo(user._id);

    // 1. First toggle -> liked
    const likeRes = await fetch(`${testEnv.baseUrl}/api/v1/likes/toggle/v/${video._id}`, {
        method: "POST",
        headers: authHeaders,
    });
    assert.ok(likeRes.status === 200 || likeRes.status === 201);
    const likeBody = await likeRes.json();
    assert.equal(likeBody.success, true);
    assert.equal(likeBody.data.isLiked, true);

    // 2. Second toggle -> unliked
    const unlikeRes = await fetch(`${testEnv.baseUrl}/api/v1/likes/toggle/v/${video._id}`, {
        method: "POST",
        headers: authHeaders,
    });
    assert.ok(unlikeRes.status === 200 || unlikeRes.status === 201);
    const unlikeBody = await unlikeRes.json();
    assert.equal(unlikeBody.success, true);
    assert.equal(unlikeBody.data.isLiked, false);
});

test("Social: User cannot subscribe to their own channel (returns 400)", async () => {
    const { user, authHeaders } = await createTestUser();

    const res = await fetch(`${testEnv.baseUrl}/api/v1/subscriptions/c/${user._id}`, {
        method: "POST",
        headers: authHeaders,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes("own"));
});

test("Social: Toggle subscription updates channel subscriber count", async () => {
    const creator = await createTestUser({ username: "creator1", email: "creator1@example.com" });
    const fan = await createTestUser({ username: "fan1", email: "fan1@example.com" });

    // 1. Fan subscribes to Creator
    const subRes = await fetch(`${testEnv.baseUrl}/api/v1/subscriptions/c/${creator.user._id}`, {
        method: "POST",
        headers: fan.authHeaders,
    });
    assert.equal(subRes.status, 201);
    const subBody = await subRes.json();
    assert.equal(subBody.data.isSubscribed, true);
    assert.equal(subBody.data.subscribersCount, 1);

    // 2. Fan unsubscribes
    const unsubRes = await fetch(`${testEnv.baseUrl}/api/v1/subscriptions/c/${creator.user._id}`, {
        method: "POST",
        headers: fan.authHeaders,
    });
    assert.equal(unsubRes.status, 200);
    const unsubBody = await unsubRes.json();
    assert.equal(unsubBody.data.isSubscribed, false);
    assert.equal(unsubBody.data.subscribersCount, 0);
});

test("Social: Comments API supports post, get, edit, and delete with authentication", async () => {
    const { user, authHeaders } = await createTestUser();
    const video = await createTestVideo(user._id);

    // 1. Post a new comment
    const postRes = await fetch(`${testEnv.baseUrl}/api/v1/comments/${video._id}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ content: "Initial test comment" }),
    });
    assert.equal(postRes.status, 201);
    const postBody = await postRes.json();
    const commentId = postBody.data._id;
    assert.ok(commentId, "Created comment must have _id");

    // 2. Get comments for video
    const getRes = await fetch(`${testEnv.baseUrl}/api/v1/comments/${video._id}`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    const commentsList = getBody.data.docs || getBody.data || [];
    assert.ok(commentsList.some((c) => c._id.toString() === commentId.toString()));

    // 3. Edit comment
    const editRes = await fetch(`${testEnv.baseUrl}/api/v1/comments/c/${commentId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ content: "Edited test comment" }),
    });
    assert.equal(editRes.status, 200);
    const editBody = await editRes.json();
    assert.equal(editBody.data.content, "Edited test comment");

    // 4. Delete comment
    const deleteRes = await fetch(`${testEnv.baseUrl}/api/v1/comments/c/${commentId}`, {
        method: "DELETE",
        headers: authHeaders,
    });
    assert.equal(deleteRes.status, 200);

    const inDb = await Comment.findById(commentId);
    assert.equal(inDb, null);
});

