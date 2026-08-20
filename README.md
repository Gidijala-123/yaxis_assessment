# Flowdesk

Customer Application & Workflow Management System built as a scoped full-stack assessment. Flowdesk gives operations teams one place to see customer applications, assign ownership, move work through an explicit workflow, record an audit trail, and synchronize completed applications with a mock CRM.

The implementation favors a small number of complete, reviewable backend rules over a large amount of unfinished UI. The most important behavior is enforced by the API: authentication, role scoping, workflow transitions, optimistic concurrency, transactional activity logging, and asynchronous CRM synchronization.

## Contents

- [What Was Built](#what-was-built)
- [Technology Choices](#technology-choices)
- [Repository Layout](#repository-layout)
- [Running The Project](#running-the-project)
- [Demo Accounts](#demo-accounts)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Authentication And Authorization](#authentication-and-authorization)
- [Application Workflow](#application-workflow)
- [External CRM Sync](#external-crm-sync)
- [API Overview](#api-overview)
- [Frontend Overview](#frontend-overview)
- [Testing And Verification](#testing-and-verification)
- [Known Limitations](#known-limitations)
- [Production Evolution](#production-evolution)
- [AI And Tools Used](#ai-and-tools-used)

## What Was Built

### Working product areas

- JWT login with an httpOnly cookie and session restoration through `/api/auth/me`.
- Three roles: `ADMIN`, `MANAGER`, and `EXECUTIVE`.
- Role-aware dashboard statistics and application queue.
- Server-side application scoping by administrator, team, or assignee.
- Application search, status filtering, priority filtering, and detail view.
- Customer directory, customer search, and customer profile with scoped applications.
- Application status transition control using a shared state machine.
- Application metadata editing with optimistic concurrency checks.
- Work-item creation and sequential status updates.
- Append-only activity history for major application events.
- CRM sync status, retries, attempt count, failure visibility, and exponential backoff.
- Swagger UI at `/api/docs`.
- Seed data for a useful first-run workspace.
- Loading skeletons, request timeout handling, retry states, empty states, responsive layout, and animated detail panels.

### Deliberately scoped areas

The API supports customer creation, application creation, assignment/reassignment, work-item assignment, and sync retry. The current UI prioritizes the review-critical queue and detail workflow; some of those API operations do not yet have complete dedicated forms or selectors in the first screen. This is called out explicitly rather than presenting unfinished controls as complete functionality.

## Technology Choices

| Area | Technology | Reason |
| --- | --- | --- |
| Web | Next.js App Router, TypeScript | Gives the UI a modern React structure and production build pipeline. |
| UI | Tailwind CSS plus focused component CSS | Keeps layout fast to iterate while allowing a deliberate visual system. |
| Server state | TanStack React Query | Handles caching, refetching, invalidation, loading, and error states. |
| Forms and validation | React Hook Form/Zod-compatible shared contracts | Provides a path for consistent client/server validation. |
| API | Node.js, Express, TypeScript | Small, explicit REST API with familiar middleware boundaries. |
| Database | PostgreSQL | Relational ownership, workflow history, indexes, and transactions fit the domain better than a document store. |
| ORM | Prisma | Type-safe queries, schema generation, relations, and predictable local setup. |
| Authentication | JWT in an httpOnly cookie | Keeps the API independently deployable without adding a hosted auth dependency. |
| Background work | Transactional outbox plus in-process poller | Demonstrates reliable async behavior without adding Redis or queue infrastructure to a time-boxed assessment. |
| Testing | Jest and Supertest dependencies | Supports focused backend unit and integration coverage. |
| Deployment | Docker Compose | Starts PostgreSQL, API, and web as one local system. |

The trade-offs are intentional. PostgreSQL requires schema management but gives stronger relational guarantees. JWT cookies require production work around revocation and refresh-token rotation. The in-process poller is simple but does not provide the durability or horizontal coordination of a real queue.

## Repository Layout

```text
/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Database schema and relations
│   │   │   └── seed.ts              # Demo users, teams, customers, applications
│   │   └── src/
│   │       ├── server.ts             # Express app, routes, middleware, worker
│   │       └── workflow.test.ts      # Focused workflow/idempotency tests
│   └── web/
│       └── app/
│           ├── page.tsx              # Login and operations workspace
│           ├── globals.css           # Tailwind entry and global styles
│           └── components.css        # Product visual system and responsive styles
├── packages/
│   └── shared/
│       └── src/index.ts               # Roles, statuses, transitions, Zod schemas
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

## Running The Project

### Prerequisites

For the local workflow, install:

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 14 or newer, or a Supabase PostgreSQL database

Docker Desktop is optional. The application does not require Supabase-specific client libraries; Supabase is used only as a hosted PostgreSQL database through Prisma.

### Option A: Run with Supabase PostgreSQL

1. Create a Supabase project.
2. Open **Project Settings > Database** and copy a PostgreSQL connection URI. The Session Pooler URI is usually the easiest option for local development.
3. Create `apps/api/.env` from `apps/api/.env.example`:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

4. Set the values in `apps/api/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/postgres"
JWT_SECRET=replace-with-a-long-local-secret
PORT=4000
WEB_ORIGIN=http://localhost:3000
```

5. Create the frontend environment file:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

6. From the repository root, install dependencies, create the schema, and seed demo data:

```powershell
npm install
npm run db:push
npm run db:seed
```

7. Start the API and web applications together:

```powershell
npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000). The seeded rows will be visible in Supabase Table Editor.

If the database password contains characters such as `@`, `#`, `%`, or `/`, URL-encode the password inside `DATABASE_URL`. Never commit `apps/api/.env`; it is excluded by `.gitignore`.

### Option B: Run with Docker Compose

Make sure Docker Desktop is running, then run from the repository root:

```powershell
docker compose up --build
```

The services are:

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- Health check: [http://localhost:4000/api/health](http://localhost:4000/api/health)
- Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

The API container runs `prisma db push`, seeds demo data, and starts the worker. Stop the stack with:

```powershell
docker compose down
```

Add `-v` only when you intentionally want to delete the local PostgreSQL volume and all Docker seed data.

### Available npm commands

Run these from the repository root:

```powershell
npm install                 # Install all workspace dependencies
npm run dev                 # Start API and web in parallel
npm run build               # Build shared package, API, and web
npm test                    # Run backend Jest tests
npm run db:push             # Apply Prisma schema to DATABASE_URL
npm run db:seed             # Reset and create demo data
```

Workspace-specific commands are also available:

```powershell
npm run dev -w apps/api
npm run dev -w apps/web
npm run build -w packages/shared
npm run build -w apps/api
npm run build -w apps/web
npm test -w apps/api
```

## Demo Accounts

All seeded accounts use the password `demo1234`.

| Role | Email | Expected visibility |
| --- | --- | --- |
| Admin | `admin@workflow.local` | All teams and applications |
| Manager | `manager1@workflow.local` | Central Operations team |
| Manager | `manager2@workflow.local` | North Operations team |
| Executive | `exec1@workflow.local` through `exec4@workflow.local` | Applications assigned to that executive |

## Architecture

```mermaid
flowchart LR
  Browser[Next.js web] -->|HTTP + credentials include| API[Express REST API]
  API --> Auth[JWT cookie middleware]
  API --> Scope[Shared scope filter]
  API --> Prisma[Prisma ORM]
  Prisma --> DB[(PostgreSQL / Supabase)]
  Prisma --> Outbox[SyncJob outbox rows]
  Worker[In-process poller] --> Outbox
  Worker --> CRM[Mock CRM service]
```

The browser owns presentation and interaction state. TanStack Query owns server state. The API owns authentication, authorization, validation, workflow decisions, transactions, and side effects. Prisma is the only database access layer.

The `scope(user)` helper is the central authorization boundary for application reads. It produces:

```text
ADMIN      -> no application filter
MANAGER    -> application.teamId = user.teamId
EXECUTIVE  -> application.assignedToId = user.id
```

Mutations first load the resource through the same scope. The frontend may hide an action for usability, but the API never trusts that UI decision.

## Data Model

```mermaid
erDiagram
  USER ||--o| TEAM : manages
  TEAM ||--o{ USER : contains
  USER ||--o{ CUSTOMER : creates
  USER ||--o{ APPLICATION : creates
  USER ||--o{ APPLICATION : assigned_to
  TEAM ||--o{ APPLICATION : owns
  CUSTOMER ||--o{ APPLICATION : has
  APPLICATION ||--o{ WORK_ITEM : contains
  APPLICATION ||--o{ ACTIVITY_LOG : records
  APPLICATION ||--o{ SYNC_JOB : queues
  USER ||--o{ ACTIVITY_LOG : performs
```

Important modeling decisions:

- UUID primary keys are used throughout.
- Mutable entities have `createdAt`, `updatedAt`, and where needed a `version` column.
- `Application.teamId` is denormalized from ownership/assignment to make team queries efficient.
- `ActivityLog` is append-only and records actor, action, timestamp, and JSON metadata.
- `SyncJob.idempotencyKey` is unique to prevent duplicate outbox records for the same completion event.
- Application indexes exist for `status`, `assignedToId`, `customerId`, and `teamId`.

## Authentication And Authorization

### Authentication flow

1. The web login form posts email/password to `POST /api/auth/login`.
2. The API looks up the user and compares the password with `bcryptjs`.
3. The API signs a JWT containing user ID, role, and team ID.
4. The JWT is returned as an httpOnly, SameSite=Lax cookie.
5. Protected routes use `requireAuth` to verify the cookie.
6. The web calls `/api/auth/me` on load so refresh and navigation restore the session.

The cookie is marked `secure` in production. There is no public self-registration; users are seeded or would be provisioned by an administrator.

### Role rules

- `ADMIN`: full application, customer, team, and user visibility.
- `MANAGER`: read/write application, customer, and work-item data within the manager's team. A manager can assign an application only to an executive in that same team.
- `EXECUTIVE`: read/write only assigned applications. An executive cannot reassign work, see unassigned applications, see another executive's applications, or reopen a completed application.

A resource outside the caller's scope is generally returned as `404` after filtering. This avoids revealing whether another team's record exists. Coarse role checks return `403` where the role itself is not allowed to use an endpoint.

## Application Workflow

The application statuses are:

```text
NEW -> WAITING_FOR_INFO -> IN_PROGRESS -> UNDER_REVIEW -> COMPLETED
                                  |              |
                                  +--------------+
COMPLETED -> REOPENED -> IN_PROGRESS
```

The authoritative transition map is in `packages/shared/src/index.ts`:

```text
NEW              -> WAITING_FOR_INFO, IN_PROGRESS
WAITING_FOR_INFO -> IN_PROGRESS, NEW
IN_PROGRESS      -> UNDER_REVIEW, WAITING_FOR_INFO
UNDER_REVIEW     -> COMPLETED, IN_PROGRESS
COMPLETED        -> REOPENED
REOPENED         -> IN_PROGRESS
```

Every successful status update:

1. Reads the application through the caller's scope.
2. Checks the requested target against the transition map.
3. Rejects executive reopen attempts.
4. Updates status only when the submitted `version` still matches.
5. Increments `version`.
6. Writes a `STATUS_CHANGED` activity entry.
7. If completing, writes a pending `SyncJob` in the same transaction.

A stale version returns `409 Conflict` with a refresh message. The completed application remains completed even if its CRM sync later fails.

Work items have their own sequential state machine:

```text
PENDING -> IN_PROGRESS -> COMPLETED
```

Completing all work items does not automatically complete the application. Application completion remains an explicit workflow action.

## External CRM Sync

Completion creates an outbox row containing:

- Application ID
- Payload snapshot
- Deterministic idempotency key
- Status `PENDING`
- Attempt count
- Last error
- Next eligible attempt time

A five-second in-process poller picks up eligible `PENDING` and `RETRYING` jobs. The mock CRM simulates latency and transient failure. The receiving side uses an in-memory map keyed by idempotency key, so repeated delivery produces the same external result during the process lifetime.

Failure behavior:

- Attempts are incremented and `lastError` is stored.
- Retry status becomes `RETRYING`.
- Backoff is `min(2^attempts * 5 seconds, 5 minutes)`.
- After five attempts, the job becomes `FAILED` and stops automatic retrying.
- Admins and managers can manually retry a failed job.
- Successful jobs become `SUCCEEDED` and write `SYNC_SUCCEEDED` activity.

The trade-off is that the in-process worker is not durable across API restarts and is not safe to run independently on multiple API replicas without claiming/locking. A production implementation would move this work to BullMQ/Redis or SQS/EventBridge, add a dead-letter queue, use durable job visibility/locking, and run workers separately from the HTTP API.

## API Overview

All responses use the shape `{ data, error }`.

### Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Dashboard and applications

```text
GET   /api/dashboard
GET   /api/applications?search=&status=&priority=
GET   /api/applications/:id
POST  /api/applications
PATCH /api/applications/:id
POST  /api/applications/:id/status
PATCH /api/applications/:id/assignment
```

### Customers

```text
GET  /api/customers?search=
GET  /api/customers/:id
POST /api/customers
```

### Work items and sync

```text
POST  /api/applications/:id/work-items
PATCH /api/applications/:id/work-items/:workItemId
POST  /api/applications/:id/sync/retry
```

### Operational endpoints

```text
GET /api/health
GET /api/docs
```

Swagger is intentionally small but provides a starting point for exploring the API. The route implementation and shared schemas are the source of truth.

## Frontend Overview

The web application is a desktop-first internal operations tool with responsive behavior for smaller screens.

The main workspace includes:

- A navigation rail for Applications and Customers.
- Role-aware account information and sign out.
- Summary cards for visible, completed, and urgent applications.
- Search, status filters, and priority filters.
- Queue rows with customer, assignee, work-item progress, status, and priority.
- Customer directory and customer detail drawer.
- Application detail drawer with metadata, valid next states, work items, CRM sync, and activity history.
- Skeleton loading states and retryable error states.
- A 15-second request timeout so a failed API request cannot leave the user in permanent loading state.

The visual system uses restrained ink, paper, mint, blue, gold, and coral accents. Status and priority intentionally have different visual treatments so the queue can be scanned quickly.

## Testing And Verification

### Automated checks

Run:

```powershell
npm test
npm run build
```

Current automated tests cover:

- The explicit workflow map accepts valid transitions.
- Invalid direct transitions are not represented as valid options.
- The sync idempotency key is deterministic for the same application/completion event.

The production build compiles the shared package, API, and Next.js app. TypeScript errors were checked in the touched API, frontend, and shared files.

### Manual review checklist

1. Log in as Admin and confirm all seeded applications are visible.
2. Log in as Manager 1 and confirm only Central Operations applications are visible.
3. Log in as Manager 2 and confirm only North Operations applications are visible.
4. Log in as an Executive and confirm only that executive's assigned applications are visible.
5. Open an application and attempt each displayed next status.
6. Confirm an invalid status submitted directly to the API returns `400`.
7. Complete an application and inspect the pending sync job/activity.
8. Update the same application from two tabs and confirm the stale tab receives `409`.
9. Search by application title, customer name, email, and company.
10. Open a customer profile and confirm its applications are still scope-filtered.
11. Advance a work item from pending to in progress to completed.
12. Refresh the browser and confirm the session and queue restore.

### Deliberate test gaps

Full Supertest database integration coverage, React Testing Library coverage, Playwright role journeys, and two-tab browser concurrency coverage are not included in the current time-boxed implementation. These are the first tests I would add before production release because they validate cross-layer contracts rather than isolated functions.

## Known Limitations

- The in-process sync worker is not durable across process restarts.
- The mock CRM's idempotency map is process-local; a real external system must provide durable idempotency.
- Pagination is not yet exposed in the queue UI; the API currently limits the list to 50 records.
- Full user/team administration is not exposed in the UI.
- Assignment selectors and a complete dedicated application/customer creation flow are the next UI additions. The corresponding API routes exist and enforce permissions.
- JWT revocation, refresh-token rotation, password recovery, email verification, CSRF hardening, rate limiting, and audit export need production implementation.
- Swagger documentation is a functional entry point but not exhaustive route-by-route OpenAPI coverage.

These limitations are stated explicitly because a smaller complete system is more useful in review than pretending unfinished areas are production-ready.

## Production Evolution

Before production deployment, I would add:

- Structured logging with request IDs, user IDs, application IDs, and sync job IDs.
- OpenTelemetry traces and metrics for API latency, transition failures, and sync retry rates.
- Managed secrets instead of checked-in or developer-local credentials.
- Prisma migrations in CI/CD rather than `db push` for deployed environments.
- PostgreSQL connection pooling and backup/restore verification.
- A durable queue with worker locking, retries, dead-letter handling, and horizontal scaling.
- Rate limits on login and mutation endpoints.
- Refresh-token rotation and explicit token revocation.
- Playwright role journeys and database-backed Supertest integration tests.
- CI running `npm test`, `npm run build`, schema validation, and dependency/security checks.

## AI And Tools Used

AI assistance was used to accelerate scaffolding, Prisma schema drafting, seed data, API route composition, frontend composition, styling, Docker configuration, debugging, and documentation. The implementation was reviewed through local Prisma generation, TypeScript compilation, Jest execution, and iterative fixes for the dashboard request timeout, Prisma relation/schema errors, Windows Prisma file locking, and UI build errors.

The repository contains no committed environment secrets. `apps/api/.env` and other `.env` files are ignored; only `.env.example` files are included. Any credentials used during local Supabase testing should be rotated if they have been exposed outside the local environment.
