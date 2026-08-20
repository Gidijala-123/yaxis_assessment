import { z } from "zod";

export const Roles = ["ADMIN", "MANAGER", "EXECUTIVE"] as const;
export type Role = (typeof Roles)[number];
export const Statuses = ["NEW", "WAITING_FOR_INFO", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "REOPENED"] as const;
export type ApplicationStatus = (typeof Statuses)[number];
export const Priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof Priorities)[number];
export const WorkStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;
export type WorkStatus = (typeof WorkStatuses)[number];
export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  NEW: ["WAITING_FOR_INFO", "IN_PROGRESS"], WAITING_FOR_INFO: ["IN_PROGRESS", "NEW"],
  IN_PROGRESS: ["UNDER_REVIEW", "WAITING_FOR_INFO"], UNDER_REVIEW: ["COMPLETED", "IN_PROGRESS"],
  COMPLETED: ["REOPENED"], REOPENED: ["IN_PROGRESS"]
};
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const applicationSchema = z.object({ customerId: z.string().uuid(), title: z.string().min(2), description: z.string().min(2), priority: z.enum(Priorities) });
export const transitionSchema = z.object({ status: z.enum(Statuses), version: z.number().int().positive() });
export const updateApplicationSchema = z.object({ title: z.string().min(2).optional(), description: z.string().min(2).optional(), priority: z.enum(Priorities).optional(), version: z.number().int().positive() });
export type AuthUser = { id: string; name: string; email: string; role: Role; teamId: string | null };
