/**
 * Parse the CORS_ORIGIN environment variable into an array of allowed origins.
 * - In production, the variable must be set and must not be "*".
 * - In development/test a missing value defaults to ["http://localhost:5173"].
 */

const raw = process.env.CORS_ORIGIN || "";

let allowedOrigins;

if (raw && raw.trim() !== "*") {
    allowedOrigins = raw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
} else if (process.env.NODE_ENV === "production") {
    throw new Error(
        "[CORS] CORS_ORIGIN must be set to a comma-separated list of allowed origins in production. " +
            "Refusing to start with a wildcard or empty origin."
    );
} else {
    // development / test fallback
    allowedOrigins = ["http://localhost:5173", "http://localhost:3000"];
}

export { allowedOrigins };

