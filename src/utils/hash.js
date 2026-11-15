import bcrypt from "bcrypt";
import crypto from "crypto";

export const hashPassword = async (password, rounds = 10) => {
    return await bcrypt.hash(password, rounds);
};

export const comparePassword = async (password, storedHash) => {
    if (!storedHash) return false;

    // Keep support for legacy/already-stored scrypt hashes
    if (storedHash.startsWith("scrypt$")) {
        const [, salt, key] = storedHash.split("$");
        const derivedKey = crypto.scryptSync(password, salt, 64);
        const storedKeyBuffer = Buffer.from(key, "hex");
        if (derivedKey.length !== storedKeyBuffer.length) return false;
        return crypto.timingSafeEqual(storedKeyBuffer, derivedKey);
    }

    return await bcrypt.compare(password, storedHash);
};
