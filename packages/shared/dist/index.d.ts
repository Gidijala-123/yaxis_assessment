import { z } from "zod";
export declare const Roles: readonly ["ADMIN", "MANAGER", "EXECUTIVE"];
export type Role = (typeof Roles)[number];
export declare const Statuses: readonly ["NEW", "WAITING_FOR_INFO", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "REOPENED"];
export type ApplicationStatus = (typeof Statuses)[number];
export declare const Priorities: readonly ["LOW", "MEDIUM", "HIGH", "URGENT"];
export type Priority = (typeof Priorities)[number];
export declare const WorkStatuses: readonly ["PENDING", "IN_PROGRESS", "COMPLETED"];
export type WorkStatus = (typeof WorkStatuses)[number];
export declare const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
    role: z.ZodEnum<["ADMIN", "MANAGER", "EXECUTIVE"]>;
    inviteCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    confirmPassword: string;
    role: "ADMIN" | "MANAGER" | "EXECUTIVE";
    inviteCode: string;
}, {
    email: string;
    password: string;
    name: string;
    confirmPassword: string;
    role: "ADMIN" | "MANAGER" | "EXECUTIVE";
    inviteCode: string;
}>, {
    email: string;
    password: string;
    name: string;
    confirmPassword: string;
    role: "ADMIN" | "MANAGER" | "EXECUTIVE";
    inviteCode: string;
}, {
    email: string;
    password: string;
    name: string;
    confirmPassword: string;
    role: "ADMIN" | "MANAGER" | "EXECUTIVE";
    inviteCode: string;
}>;
export declare const applicationSchema: z.ZodObject<{
    customerId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    priority: z.ZodEnum<["LOW", "MEDIUM", "HIGH", "URGENT"]>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}, {
    customerId: string;
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}>;
export declare const transitionSchema: z.ZodObject<{
    status: z.ZodEnum<["NEW", "WAITING_FOR_INFO", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "REOPENED"]>;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "NEW" | "WAITING_FOR_INFO" | "IN_PROGRESS" | "UNDER_REVIEW" | "COMPLETED" | "REOPENED";
    version: number;
}, {
    status: "NEW" | "WAITING_FOR_INFO" | "IN_PROGRESS" | "UNDER_REVIEW" | "COMPLETED" | "REOPENED";
    version: number;
}>;
export declare const updateApplicationSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<["LOW", "MEDIUM", "HIGH", "URGENT"]>>;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    version: number;
    title?: string | undefined;
    description?: string | undefined;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
}, {
    version: number;
    title?: string | undefined;
    description?: string | undefined;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
}>;
export type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: Role;
    teamId: string | null;
};
