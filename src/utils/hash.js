import crypto from "crypto";

let nativeBcrypt = null;
try {
    const mod = await import("bcrypt");
    nativeBcrypt = mod.default || mod;
} catch (e) {
    // Native C++ bcrypt not compiled on host environment; utilizing native scrypt fallback
}

/**
 * Resilient password hashing utility with automatic native crypto fallback
 */
export const hashPassword = async (password, rounds = 10) => {
    if (nativeBcrypt?.hash) {
        try {
            return await nativeBcrypt.hash(password, rounds);
        } catch (err) {
            // Fall through to native crypto
        }
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return `scrypt$${salt}$${derivedKey.toString("hex")}`;
};

export const comparePassword = async (password, storedHash) => {
    if (!storedHash) return false;

    if (storedHash.startsWith("scrypt$")) {
        const [, salt, key] = storedHash.split("$");
        const derivedKey = crypto.scryptSync(password, salt, 64);
        const storedKeyBuffer = Buffer.from(key, "hex");
        if (derivedKey.length !== storedKeyBuffer.length) return false;
        return crypto.timingSafeEqual(storedKeyBuffer, derivedKey);
    }

    if (nativeBcrypt?.compare) {
        try {
            return await nativeBcrypt.compare(password, storedHash);
        } catch (err) {
            return false;
        }
    }

    return false;
};
