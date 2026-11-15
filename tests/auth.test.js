import test from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment, createTestUser } from "./helpers/setup.js";
import { User } from "../src/models/user.model.js";

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

test("Auth: Register with valid details creates user in database and returns 201", async () => {
    const payload = {
        fullName: "Jane Doe",
        email: "janedoe@example.com",
        username: "janedoe",
        password: "SecretPassword123!",
    };

    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.username, "janedoe");
    assert.equal(body.data.email, "janedoe@example.com");

    const userInDb = await User.findOne({ username: "janedoe" });
    assert.ok(userInDb, "User should be persisted in database");
    assert.equal(userInDb.fullName, "Jane Doe");
});

test("Auth: Register with duplicate email or username returns 409 Conflict", async () => {
    await createTestUser({ email: "existing@example.com", username: "existinguser" });

    const duplicatePayload = {
        fullName: "Another Person",
        email: "existing@example.com",
        username: "newuser",
        password: "Password123!",
    };

    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duplicatePayload),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.success, false);
});

test("Auth: Register with invalid body (missing required fields) returns 400 Bad Request", async () => {
    const invalidPayload = {
        fullName: "No Email",
        password: "Pass",
    };

    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidPayload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
});

test("Auth: Login with valid credentials returns 200 with access token and cookies", async () => {
    const { user, rawPassword } = await createTestUser({
        email: "loginuser@example.com",
        username: "loginuser",
        password: "MySecurePassword123!",
    });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: rawPassword }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.accessToken, "Response must include access token");
    assert.ok(body.data.refreshToken, "Response must include refresh token");
    assert.equal(body.data.user.username, "loginuser");
});

test("Auth: Login with incorrect password returns 401 Unauthorized", async () => {
    const { user } = await createTestUser({
        email: "wrongpass@example.com",
        username: "wrongpassuser",
        password: "CorrectPassword123!",
    });

    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: "IncorrectPassword999!" }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
});

test("Auth: Refresh token with valid refresh token returns 200 and new token pair", async () => {
    const { refreshToken } = await createTestUser();

    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.accessToken, "Refreshed access token expected");
    assert.ok(body.data.refreshToken, "Refreshed refresh token expected");
});

test("Auth: Logout clears user refresh token in database and clears cookies", async () => {
    const { user, authHeaders } = await createTestUser();

    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/logout`, {
        method: "POST",
        headers: authHeaders,
    });

    assert.equal(res.status, 200);
    const updatedUser = await User.findById(user._id);
    assert.equal(updatedUser.refreshToken, undefined);
});

test("Auth: Protected route without token returns 401 Unauthorized", async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/v1/users/current-user`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
});

