"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateApplicationSchema = exports.transitionSchema = exports.applicationSchema = exports.registerSchema = exports.loginSchema = exports.TRANSITIONS = exports.WorkStatuses = exports.Priorities = exports.Statuses = exports.Roles = void 0;
const zod_1 = require("zod");
exports.Roles = ["ADMIN", "MANAGER", "EXECUTIVE"];
exports.Statuses = ["NEW", "WAITING_FOR_INFO", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "REOPENED"];
exports.Priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
exports.WorkStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED"];
exports.TRANSITIONS = {
    NEW: ["WAITING_FOR_INFO", "IN_PROGRESS"], WAITING_FOR_INFO: ["IN_PROGRESS", "NEW"],
    IN_PROGRESS: ["UNDER_REVIEW", "WAITING_FOR_INFO"], UNDER_REVIEW: ["COMPLETED", "IN_PROGRESS"],
    COMPLETED: ["REOPENED"], REOPENED: ["IN_PROGRESS"]
};
exports.loginSchema = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(1) });
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: zod_1.z.string(),
    role: zod_1.z.enum(["ADMIN", "MANAGER", "EXECUTIVE"]),
    inviteCode: zod_1.z.string().min(1, "Invite code is required"),
}).refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
exports.applicationSchema = zod_1.z.object({ customerId: zod_1.z.string().uuid(), title: zod_1.z.string().min(2), description: zod_1.z.string().min(2), priority: zod_1.z.enum(exports.Priorities) });
exports.transitionSchema = zod_1.z.object({ status: zod_1.z.enum(exports.Statuses), version: zod_1.z.number().int().positive() });
exports.updateApplicationSchema = zod_1.z.object({ title: zod_1.z.string().min(2).optional(), description: zod_1.z.string().min(2).optional(), priority: zod_1.z.enum(exports.Priorities).optional(), version: zod_1.z.number().int().positive() });
