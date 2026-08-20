import { PrismaClient, Role, ApplicationStatus, Priority, WorkStatus, ActivityAction } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  await prisma.activityLog.deleteMany(); await prisma.syncJob.deleteMany(); await prisma.workItem.deleteMany(); await prisma.application.deleteMany(); await prisma.customer.deleteMany(); await prisma.team.deleteMany(); await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const admin = await prisma.user.create({ data: { name: "Avery Admin", email: "admin@workflow.local", passwordHash, role: Role.ADMIN } });
  for (const [index, managerName] of ["Morgan Lee", "Riley Chen"].entries()) {
    const manager = await prisma.user.create({ data: { name: managerName, email: `manager${index + 1}@workflow.local`, passwordHash, role: Role.MANAGER } });
    const team = await prisma.team.create({ data: { name: `${index ? "North" : "Central"} Operations`, managerId: manager.id } });
    await prisma.user.update({ where: { id: manager.id }, data: { teamId: team.id } });
    for (let executiveIndex = 0; executiveIndex < 2; executiveIndex++) await prisma.user.create({ data: { name: `${index ? "North" : "Central"} Executive ${executiveIndex + 1}`, email: `exec${index * 2 + executiveIndex + 1}@workflow.local`, passwordHash, role: Role.EXECUTIVE, teamId: team.id } });
  }
  const teams = await prisma.team.findMany({ include: { members: true } });
  const statuses: ApplicationStatus[] = ["NEW", "WAITING_FOR_INFO", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "REOPENED"];
  const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  for (let i = 0; i < 15; i++) {
    const customer = await prisma.customer.create({ data: { name: `Customer ${i + 1}`, email: `customer${i + 1}@example.com`, phone: `555-010${String(i).padStart(2, "0")}`, company: i % 3 ? `Company ${i + 1}` : null, createdById: admin.id } });
    for (let j = 0; j < (i < 10 ? 2 : 1); j++) { const team = teams[(i + j) % teams.length]; const execs = team.members.filter((member) => member.role === Role.EXECUTIVE); const app = await prisma.application.create({ data: { customerId: customer.id, title: `${customer.name} application ${j + 1}`, description: "Review customer request and prepare the next operational step.", status: statuses[(i + j) % statuses.length], priority: priorities[(i + j) % priorities.length], assignedToId: execs.length ? execs[(i + j) % execs.length].id : null, teamId: team.id, createdById: admin.id } }); await prisma.activityLog.create({ data: { applicationId: app.id, actorId: admin.id, action: ActivityAction.APPLICATION_CREATED, metadata: {} } }); if (j === 0) await prisma.workItem.create({ data: { applicationId: app.id, title: "Validate submitted information", description: "Check the customer-provided details.", status: i % 2 ? WorkStatus.IN_PROGRESS : WorkStatus.PENDING, assignedToId: app.assignedToId } }); }
  }
}
main().finally(() => prisma.$disconnect());
