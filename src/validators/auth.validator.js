/**
 * @file src/validators/auth.validator.js
 * @description Zod validation schemas for user registration, login, and password change.
 */

import { z } from "zod";

export const registerSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must be at most 30 characters")
        .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z
    .object({
        email: z.string().email("Invalid email address").optional(),
        username: z.string().min(1, "Username is required").optional(),
        password: z.string().min(1, "Password is required"),
    })
    .refine((data) => data.email || data.username, {
        message: "Either email or username is required",
        path: ["email"],
    });

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

