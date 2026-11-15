import crypto from "crypto";

if (process.env.NODE_ENV === "production" && !process.env.STREAM_SECRET) {
    throw new Error("STREAM_SECRET environment variable is required in production");
}

const getStreamSecret = () => {
    const secret = process.env.STREAM_SECRET || (process.env.NODE_ENV !== "production" ? process.env.TEST_STREAM_SECRET : null);
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("STREAM_SECRET environment variable is required in production");
        }
        throw new Error("STREAM_SECRET environment variable is missing");
    }
    return secret;
};

export const generateSignedStreamUrl = (videoId, userId = "public", expiresInSeconds = 3600) => {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = `${videoId}:${userId}:${expires}`;

    const signature = crypto
        .createHmac("sha256", getStreamSecret())
        .update(payload)
        .digest("hex");

    return {
        streamUrl: `/api/v1/videos/stream/${videoId}?expires=${expires}&signature=${signature}&user=${userId}`,
        expires,
        signature,
    };
};

export const verifyStreamSignature = (videoId, expires, signature, userId = "public") => {
    if (!expires || !signature) {
        return { valid: false, reason: "Missing security credentials" };
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expiresTimestamp = parseInt(expires, 10);

    if (isNaN(expiresTimestamp) || currentTimestamp > expiresTimestamp) {
        return { valid: false, reason: "Stream URL signature has expired" };
    }

    let streamSecret;
    try {
        streamSecret = getStreamSecret();
    } catch (err) {
        return { valid: false, reason: err.message };
    }

    const payload = `${videoId}:${userId}:${expiresTimestamp}`;
    const expectedSignature = crypto
        .createHmac("sha256", streamSecret)
        .update(payload)
        .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    let receivedBuffer;
    try {
        receivedBuffer = Buffer.from(signature, "hex");
    } catch {
        return { valid: false, reason: "Invalid signature format" };
    }

    if (expectedBuffer.length !== receivedBuffer.length) {
        return { valid: false, reason: "Invalid signature format" };
    }

    const matches = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!matches) {
        return { valid: false, reason: "Tampered or invalid signature" };
    }

    return { valid: true };
};
