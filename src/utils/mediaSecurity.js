import crypto from "crypto";

const STREAM_SECRET = process.env.STREAM_SECRET || process.env.ACCESS_TOKEN_SECRET || "pulsecast_secure_stream_key_2027";

/**
 * Generate a cryptographically signed, time-expiring stream URL.
 * Prevents hotlinking, token scraping, and unauthorized bandwidth leeching.
 */
export const generateSignedStreamUrl = (videoId, userId = "public", expiresInSeconds = 3600) => {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = `${videoId}:${userId}:${expires}`;

    const signature = crypto
        .createHmac("sha256", STREAM_SECRET)
        .update(payload)
        .digest("hex");

    return {
        streamUrl: `/api/v1/videos/stream/${videoId}?expires=${expires}&signature=${signature}&user=${userId}`,
        expires,
        signature,
    };
};

/**
 * Verify HMAC-SHA256 signature and expiration timestamp.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export const verifyStreamSignature = (videoId, expires, signature, userId = "public") => {
    if (!expires || !signature) {
        return { valid: false, reason: "Missing security credentials (expires or signature)" };
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expiresTimestamp = parseInt(expires, 10);

    // Expiration check
    if (isNaN(expiresTimestamp) || currentTimestamp > expiresTimestamp) {
        return { valid: false, reason: "Stream URL signature has expired" };
    }

    const payload = `${videoId}:${userId}:${expiresTimestamp}`;
    const expectedSignature = crypto
        .createHmac("sha256", STREAM_SECRET)
        .update(payload)
        .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== receivedBuffer.length) {
        return { valid: false, reason: "Invalid signature format" };
    }

    const matches = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!matches) {
        return { valid: false, reason: "Tampered or invalid signature" };
    }

    return { valid: true };
};
