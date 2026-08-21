import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors"; import cookieParser from "cookie-parser"; import bcrypt from "bcryptjs"; import jwt from "jsonwebtoken";
import { PrismaClient, Role, ApplicationStatus, Priority, SyncStatus, ActivityAction, WorkStatus, Prisma } from "@prisma/client";
import swaggerUi from "swagger-ui-express";
import { loginSchema, registerSchema, applicationSchema, transitionSchema, updateApplicationSchema, TRANSITIONS, AuthUser } from "@customer-workflow/shared";
import { startKeepAlive } from "./keepalive";
const prisma = new PrismaClient(); const app = express(); const secret = process.env.JWT_SECRET || "dev-secret";
const allowedOrigins = (process.env.WEB_ORIGIN || "http://localhost:3000").split(",").map(o => o.trim());
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.some(o => o === origin || origin.startsWith(o))) { callback(null, true); } else { callback(new Error("Not allowed by CORS")); } }, credentials: true })); app.use(express.json()); app.use(cookieParser());
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup({ openapi: "3.0.0", info: { title: "Flowdesk API", version: "1.0.0" }, paths: { "/api/health": { get: { responses: { "200": { description: "Healthy" } } } } } }));
type AuthedRequest = Request & { user?: AuthUser };
const error = (status: number, message: string) => Object.assign(new Error(message), { status });
const requireAuth = (req: AuthedRequest, _res: Response, next: NextFunction) => { try { req.user = jwt.verify(req.cookies.token || "", secret) as AuthUser; next(); } catch { next(error(401, "Authentication required")); } };
const requireRole = (...roles: Role[]) => (req: AuthedRequest, _res: Response, next: NextFunction) => roles.includes(req.user!.role) ? next() : next(error(403, "You do not have permission for this action"));
const scope = (user: AuthUser): Prisma.ApplicationWhereInput => user.role === Role.ADMIN ? {} : user.role === Role.MANAGER ? { teamId: user.teamId || "" } : { assignedToId: user.id };
const includeApplication = { customer: true, assignedTo: { select: { id: true, name: true, email: true } }, team: true, workItems: true, activities: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" as const } }, syncJobs: { orderBy: { createdAt: "desc" as const }, take: 1 } };
app.get("/api/health", (_req, res) => res.json({ data: { ok: true }, error: null }));
app.post("/api/auth/login", async (req, res, next) => { try { const input = loginSchema.parse(req.body); const user = await prisma.user.findUnique({ where: { email: input.email } }); if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw error(401, "Invalid email or password"); const token = jwt.sign({ id: user.id, userId: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId }, secret, { expiresIn: "8h" }); res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }); res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId }, error: null }); } catch (e) { next(e); } });
app.post("/api/auth/logout", (_req, res) => { res.clearCookie("token"); res.json({ data: null, error: null }); });
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    // Validate invite code — ADMIN_INVITE allows admin creation, TEAM_INVITE for others
    const validCodes: Record<string, Role[]> = {
      "YAXIS-ADMIN-2024": [Role.ADMIN],
      "YAXIS-MANAGER-2024": [Role.MANAGER],
      "YAXIS-EXEC-2024": [Role.EXECUTIVE],
    };
    const allowedRoles = validCodes[input.inviteCode];
    if (!allowedRoles) throw error(400, "Invalid invite code");
    if (!allowedRoles.includes(input.role as Role)) throw error(400, `Invite code does not permit the '${input.role}' role`);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw error(409, "An account with this email already exists");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash, role: input.role as Role },
    });
    const token = jwt.sign(
      { id: user.id, userId: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId },
      secret,
      { expiresIn: "8h" }
    );
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 });
    res.status(201).json({ data: { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId }, error: null });
  } catch (e) { next(e); }
});
app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => res.json({ data: req.user, error: null }));
app.get("/api/dashboard", requireAuth, async (req: AuthedRequest, res, next) => { try { const where = scope(req.user!); const [total, completed, urgent, recent] = await Promise.all([prisma.application.count({ where }), prisma.application.count({ where: { ...where, status: "COMPLETED" } }), prisma.application.count({ where: { ...where, priority: "URGENT" } }), prisma.application.findMany({ where, include: includeApplication, orderBy: { updatedAt: "desc" }, take: 8 })]); res.json({ data: { stats: { total, completed, urgent }, recent }, error: null }); } catch (e) { next(e); } });
app.get("/api/applications", requireAuth, async (req: AuthedRequest, res, next) => { try { const { status, priority, search } = req.query; const where: Prisma.ApplicationWhereInput = { ...scope(req.user!), ...(status ? { status: status as ApplicationStatus } : {}), ...(priority ? { priority: priority as Priority } : {}), ...(search ? { OR: [{ title: { contains: String(search), mode: "insensitive" } }, { customer: { name: { contains: String(search), mode: "insensitive" } } }] } : {}) }; const items = await prisma.application.findMany({ where, include: includeApplication, orderBy: { updatedAt: "desc" }, take: 50 }); res.json({ data: items, error: null }); } catch (e) { next(e); } });
app.get("/api/applications/:id", requireAuth, async (req: AuthedRequest, res, next) => { try { const item = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) }, include: includeApplication }); if (!item) throw error(404, "Application not found"); res.json({ data: item, error: null }); } catch (e) { next(e); } });
app.delete("/api/applications/:id", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req: AuthedRequest, res, next) => { try { const item = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) } }); if (!item) throw error(404, "Application not found"); await prisma.application.delete({ where: { id: item.id } }); res.json({ data: { deleted: true }, error: null }); } catch (e) { next(e); } });
app.post("/api/applications", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req: AuthedRequest, res, next) => { try { const input = applicationSchema.parse(req.body); let teamId = req.user!.role === Role.MANAGER ? req.user!.teamId! : String(req.body.teamId || req.user!.teamId || ""); if (!teamId) { const firstTeam = await prisma.team.findFirst(); if (!firstTeam) throw error(400, "No team exists. Please create a team first."); teamId = firstTeam.id; } const item = await prisma.application.create({ data: { ...input, teamId, createdById: req.user!.id }, include: includeApplication }); await prisma.activityLog.create({ data: { applicationId: item.id, actorId: req.user!.id, action: ActivityAction.APPLICATION_CREATED, metadata: {} } }); res.status(201).json({ data: item, error: null }); } catch (e) { next(e); } });
app.patch("/api/applications/:id", requireAuth, async (req: AuthedRequest, res, next) => { try { const input = updateApplicationSchema.parse(req.body); const current = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) } }); if (!current) throw error(404, "Application not found"); const result = await prisma.application.updateMany({ where: { id: current.id, version: input.version }, data: { title: input.title, description: input.description, priority: input.priority, version: { increment: 1 } } }); if (!result.count) throw error(409, "This application was updated by someone else - please refresh."); res.json({ data: await prisma.application.findUnique({ where: { id: current.id }, include: includeApplication }), error: null }); } catch (e) { next(e); } });
app.post("/api/applications/:id/status", requireAuth, async (req: AuthedRequest, res, next) => { try { const input = transitionSchema.parse(req.body); const current = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) } }); if (!current) throw error(404, "Application not found"); if (!TRANSITIONS[current.status as keyof typeof TRANSITIONS].includes(input.status)) throw error(400, `Invalid transition from ${current.status} to ${input.status}`); if (input.status === "REOPENED" && req.user!.role === Role.EXECUTIVE) throw error(403, "Executives cannot reopen completed applications"); const completedAt = new Date(); await prisma.$transaction(async (tx: Prisma.TransactionClient) => { const updated = await tx.application.updateMany({ where: { id: current.id, version: input.version }, data: { status: input.status, version: { increment: 1 }, updatedAt: completedAt } }); if (!updated.count) throw error(409, "This application was updated by someone else - please refresh."); await tx.activityLog.create({ data: { applicationId: current.id, actorId: req.user!.id, action: ActivityAction.STATUS_CHANGED, metadata: { from: current.status, to: input.status } } }); if (input.status === "COMPLETED") { const key = `${current.id}:${completedAt.toISOString()}`; await tx.syncJob.create({ data: { applicationId: current.id, idempotencyKey: key, payload: { applicationId: current.id, title: current.title, completedAt: completedAt.toISOString() } } }); await tx.activityLog.create({ data: { applicationId: current.id, actorId: req.user!.id, action: ActivityAction.SYNC_TRIGGERED, metadata: { idempotencyKey: key } } }); } }); res.json({ data: { status: input.status }, error: null }); } catch (e) { next(e); } });
app.get("/api/analytics", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const where = scope(req.user!);

    // Run all aggregations in parallel
    const [allApps, customers, workItems] = await Promise.all([
      prisma.application.findMany({
        where,
        select: {
          status: true, priority: true, createdAt: true, updatedAt: true, customerId: true,
          workItems: { select: { status: true } },
          syncJobs: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      prisma.customer.findMany({
        where: { applications: { some: where } },
        select: { id: true, name: true, _count: { select: { applications: true } } },
        orderBy: { applications: { _count: "desc" } },
        take: 8,
      }),
      prisma.workItem.findMany({
        where: { application: where },
        select: { status: true },
      }),
    ]);

    // 1. Status distribution (pie chart)
    const statusMap: Record<string, number> = {};
    for (const a of allApps) statusMap[a.status] = (statusMap[a.status] || 0) + 1;
    const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name: name.replaceAll("_", " "), value }));

    // 2. Priority distribution (pie chart)
    const priorityMap: Record<string, number> = {};
    for (const a of allApps) priorityMap[a.priority] = (priorityMap[a.priority] || 0) + 1;
    const byPriority = Object.entries(priorityMap).map(([name, value]) => ({ name, value }));

    // 3. Applications created per month — last 6 months (bar chart)
    const monthlyMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      monthlyMap[key] = 0;
    }
    for (const a of allApps) {
      const d = new Date(a.createdAt);
      const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      if (key in monthlyMap) monthlyMap[key]++;
    }
    const byMonth = Object.entries(monthlyMap).map(([month, count]) => ({ month, count }));

    // 4. Top customers by application count (horizontal bar)
    const topCustomers = customers.map((c) => ({ name: c.name, count: c._count.applications }));

    // 5. Work item completion rate (donut / summary)
    const wiTotal = workItems.length;
    const wiCompleted = workItems.filter((w) => w.status === "COMPLETED").length;
    const wiInProgress = workItems.filter((w) => w.status === "IN_PROGRESS").length;
    const wiPending = workItems.filter((w) => w.status === "PENDING").length;
    const workItemStats = {
      total: wiTotal, completed: wiCompleted, inProgress: wiInProgress, pending: wiPending,
      completionRate: wiTotal > 0 ? Math.round((wiCompleted / wiTotal) * 100) : 0
    };

    // 6. Sync job health (small pie)
    const syncMap: Record<string, number> = {};
    for (const a of allApps) {
      const s = a.syncJobs[0]?.status || "NOT_STARTED";
      syncMap[s] = (syncMap[s] || 0) + 1;
    }
    const syncHealth = Object.entries(syncMap).map(([name, value]) => ({ name: name.replaceAll("_", " "), value }));

    res.json({
      data: {
        byStatus, byPriority, byMonth, topCustomers, workItemStats, syncHealth,
        totals: { applications: allApps.length, customers: customers.length }
      }, error: null
    });
  } catch (e) { next(e); }
});

app.get("/api/customers", requireAuth, async (req: AuthedRequest, res, next) => { try { const customers = await prisma.customer.findMany({ where: { ...(req.query.search ? { OR: [{ name: { contains: String(req.query.search), mode: "insensitive" } }, { email: { contains: String(req.query.search), mode: "insensitive" } }, { company: { contains: String(req.query.search), mode: "insensitive" } }] } : {}), applications: { some: scope(req.user!) } }, include: { _count: { select: { applications: true } } }, orderBy: { name: "asc" } }); res.json({ data: customers, error: null }); } catch (e) { next(e); } });
app.get("/api/customers/:id", requireAuth, async (req: AuthedRequest, res, next) => { try { const customer = await prisma.customer.findFirst({ where: { id: String(req.params.id), applications: { some: scope(req.user!) } }, include: { applications: { where: scope(req.user!), include: includeApplication, orderBy: { updatedAt: "desc" } } } }); if (!customer) throw error(404, "Customer not found"); res.json({ data: customer, error: null }); } catch (e) { next(e); } });
app.post("/api/customers", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req: AuthedRequest, res, next) => { try { const customer = await prisma.customer.create({ data: { name: String(req.body.name), email: String(req.body.email), phone: String(req.body.phone || ""), company: req.body.company ? String(req.body.company) : null, createdById: req.user!.id } }); res.status(201).json({ data: customer, error: null }); } catch (e) { next(e); } });
app.patch("/api/applications/:id/assignment", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req: AuthedRequest, res, next) => { try { const current = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) } }); if (!current) throw error(404, "Application not found"); const assigneeId = req.body.assignedToId ? String(req.body.assignedToId) : null; const assignee = assigneeId ? await prisma.user.findUnique({ where: { id: assigneeId } }) : null; if (assigneeId && (!assignee || assignee.role !== Role.EXECUTIVE || (req.user!.role === Role.MANAGER && assignee.teamId !== req.user!.teamId))) throw error(403, "The assignee is outside the permitted team"); const result = await prisma.application.updateMany({ where: { id: current.id, version: Number(req.body.version) }, data: { assignedToId: assigneeId, teamId: assignee?.teamId || current.teamId, version: { increment: 1 } } }); if (!result.count) throw error(409, "This application was updated by someone else - please refresh."); await prisma.activityLog.create({ data: { applicationId: current.id, actorId: req.user!.id, action: current.assignedToId ? ActivityAction.REASSIGNED : ActivityAction.ASSIGNED, metadata: { from: current.assignedToId, to: assigneeId } } }); res.json({ data: { assignedToId: assigneeId }, error: null }); } catch (e) { next(e); } });
app.post("/api/applications/:id/work-items", requireAuth, async (req: AuthedRequest, res, next) => { try { const application = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) } }); if (!application) throw error(404, "Application not found"); const item = await prisma.workItem.create({ data: { applicationId: application.id, title: String(req.body.title), description: String(req.body.description || ""), assignedToId: req.body.assignedToId || null } }); await prisma.activityLog.create({ data: { applicationId: application.id, actorId: req.user!.id, action: ActivityAction.WORK_ITEM_CREATED, metadata: { workItemId: item.id } } }); res.status(201).json({ data: item, error: null }); } catch (e) { next(e); } });
app.patch("/api/applications/:id/work-items/:workItemId", requireAuth, async (req: AuthedRequest, res, next) => { try { const application = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) } }); if (!application) throw error(404, "Application not found"); const item = await prisma.workItem.findFirst({ where: { id: String(req.params.workItemId), applicationId: application.id } }); if (!item) throw error(404, "Work item not found"); if (req.body.assignedToId && req.user!.role === Role.EXECUTIVE) throw error(403, "Executives cannot reassign work items"); const nextStatus = req.body.status as WorkStatus; const allowed: Record<WorkStatus, WorkStatus[]> = { PENDING: ["IN_PROGRESS"], IN_PROGRESS: ["COMPLETED"], COMPLETED: [] }; if (nextStatus && !allowed[item.status].includes(nextStatus)) throw error(400, `Invalid work item transition from ${item.status} to ${nextStatus}`); const updated = await prisma.workItem.update({ where: { id: item.id }, data: { ...(nextStatus ? { status: nextStatus } : {}), ...(req.body.assignedToId ? { assignedToId: String(req.body.assignedToId) } : {}) } }); if (nextStatus === WorkStatus.COMPLETED) await prisma.activityLog.create({ data: { applicationId: application.id, actorId: req.user!.id, action: ActivityAction.WORK_ITEM_COMPLETED, metadata: { workItemId: item.id } } }); res.json({ data: updated, error: null }); } catch (e) { next(e); } });
app.post("/api/applications/:id/sync/retry", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req: AuthedRequest, res, next) => { try { const item = await prisma.application.findFirst({ where: { id: String(req.params.id), ...scope(req.user!) } }); if (!item) throw error(404, "Application not found"); const job = await prisma.syncJob.findFirst({ where: { applicationId: item.id }, orderBy: { createdAt: "desc" } }); if (!job) throw error(404, "Sync job not found"); await prisma.syncJob.update({ where: { id: job.id }, data: { status: SyncStatus.PENDING, lastError: null, nextAttemptAt: new Date() } }); res.json({ data: { queued: true }, error: null }); } catch (e) { next(e); } });
const processed = new Map<string, { externalId: string }>();
async function processSyncJobs() { const jobs = await prisma.syncJob.findMany({ where: { status: { in: [SyncStatus.PENDING, SyncStatus.RETRYING] } }, take: 10 }); for (const job of jobs) { if (job.nextAttemptAt && job.nextAttemptAt > new Date()) continue; try { if (processed.has(job.idempotencyKey)) { await prisma.syncJob.update({ where: { id: job.id }, data: { status: SyncStatus.SUCCEEDED, attempts: { increment: 1 }, lastAttemptAt: new Date() } }); continue; } await prisma.syncJob.update({ where: { id: job.id }, data: { attempts: { increment: 1 }, lastAttemptAt: new Date() } }); await new Promise((resolve) => setTimeout(resolve, 150)); if (Math.random() < 0.2) throw new Error("Mock CRM transient failure"); processed.set(job.idempotencyKey, { externalId: `crm-${job.id}` }); await prisma.syncJob.update({ where: { id: job.id }, data: { status: SyncStatus.SUCCEEDED, nextAttemptAt: null } }); await prisma.activityLog.create({ data: { applicationId: job.applicationId, actorId: (await prisma.application.findUniqueOrThrow({ where: { id: job.applicationId } })).createdById, action: ActivityAction.SYNC_SUCCEEDED, metadata: { externalId: `crm-${job.id}` } } }); } catch (e) { const attempts = job.attempts + 1; const delayMs = Math.min(2 ** attempts * 5000, 300000); await prisma.syncJob.update({ where: { id: job.id }, data: { status: attempts >= 5 ? SyncStatus.FAILED : SyncStatus.RETRYING, lastError: String(e), nextAttemptAt: attempts >= 5 ? null : new Date(Date.now() + delayMs) } }); } } }
setInterval(() => processSyncJobs().catch(console.error), 5000);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => { const status = err.status || (err.name === "ZodError" ? 400 : 500); res.status(status).json({ data: null, error: { message: status === 500 ? "Internal server error" : err.message } }); });
app.listen(Number(process.env.PORT || 4000), () => {
  console.log(`API listening on ${process.env.PORT || 4000}`);
  startKeepAlive();
});
export { app };
