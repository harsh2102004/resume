import test from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment, createTestUser } from "./helpers/setup.js";

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

test("Uploads: OPTIONS discovery should declare TUS capabilities", async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/resumable-upload`, {
        method: "OPTIONS",
    });
    assert.equal(res.status, 204);
});

test("Uploads: Unauthenticated POST returns 401 Unauthorized", async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
        },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
});

test("Uploads: POST with fake / tampered token returns 401 Unauthorized", async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
            Authorization: "Bearer completely-fake-token-string",
        },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
});

test("Uploads: POST with valid token initializes upload session returning 201 with Location", async () => {
    const { accessToken } = await createTestUser();

    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/resumable-upload`, {
        method: "POST",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "2048",
            "Upload-Metadata": "filename dGVzdC5tcDQ=",
            Authorization: `Bearer ${accessToken}`,
        },
    });

    assert.equal(res.status, 201);
    const location = res.headers.get("location") || res.headers.get("Location");
    assert.ok(location, "Expected Location header in 201 TUS response");
});

test("Uploads: PATCH write request with fake token returns 401 Unauthorized", async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/v1/videos/resumable-upload/fake-upload-id`, {
        method: "PATCH",
        headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
            Authorization: "Bearer invalid-patch-token",
        },
        body: Buffer.from("test-chunk"),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
});
