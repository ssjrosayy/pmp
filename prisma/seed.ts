import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ActivityAction,
  ApprovalStatus,
  CandidateStage,
  DocumentCategory,
  EmployeeStatus,
  ExpenseStatus,
  PaymentStatus,
  PermissionAction,
  Priority,
  ProcurementCategory,
  ProcurementStatus,
  ProjectStatus,
  ProjectType,
  RoleName,
  TaskStatus,
} from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const departments = [
  "Executive",
  "Operations",
  "Business Development",
  "Software Development",
  "Drone R&D",
  "Hardware",
  "Design",
  "HR/Admin",
  "Finance",
  "Wedsy",
  "Zovu",
];

const roleLabels: Record<RoleName, string> = {
  SUPER_ADMIN: "Super Admin / CEO",
  ADMIN: "Admin / Operations",
  DEPARTMENT_HEAD: "Department Head",
  PROJECT_MANAGER: "Project Manager",
  EMPLOYEE: "Employee",
  INTERN: "Intern",
  CLIENT_GUEST: "Client / Guest",
};

async function main() {
  const passwordHash = await bcrypt.hash("Axis@12345", 12);

  const roles = new Map<RoleName, { id: string }>();
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { label: roleLabels[name] },
      create: { name, label: roleLabels[name], description: `${roleLabels[name]} access profile` },
    });
    roles.set(name, role);
  }

  const resources = ["users", "departments", "projects", "tasks", "documents", "hr", "candidates", "procurement", "expenses", "meetings", "notifications", "auditLogs"];
  for (const resource of resources) {
    for (const action of Object.values(PermissionAction)) {
      await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action, description: `${action} ${resource}` },
      });
    }
  }

  for (const departmentName of departments) {
    await prisma.department.upsert({
      where: { name: departmentName },
      update: {},
      create: {
        name: departmentName,
        notes: `${departmentName} planning, KPIs, and operating notes.`,
        kpis: { delivery: "On track", weeklyReview: true },
      },
    });
  }

  const departmentRows = await prisma.department.findMany();
  const departmentByName = new Map(departmentRows.map((department) => [department.name, department]));

  const admin = await prisma.user.upsert({
    where: { email: "admin@axis.local" },
    update: {
      roleId: roles.get(RoleName.SUPER_ADMIN)!.id,
      canViewFinance: true,
      canViewSensitiveDocuments: true,
      salaryVisible: true,
    },
    create: {
      name: "Axis Admin",
      email: "admin@axis.local",
      passwordHash,
      phone: "+92 300 0000000",
      roleId: roles.get(RoleName.SUPER_ADMIN)!.id,
      departmentId: departmentByName.get("Executive")!.id,
      joiningDate: new Date("2026-01-01"),
      canViewFinance: true,
      canViewSensitiveDocuments: true,
      salaryVisible: true,
    },
  });

  const people = [
    ["Sara Khan", "sara@axis.local", RoleName.ADMIN, "Operations", true],
    ["Hamza Ali", "hamza@axis.local", RoleName.DEPARTMENT_HEAD, "Software Development", false],
    ["Ayesha Noor", "ayesha@axis.local", RoleName.PROJECT_MANAGER, "Drone R&D", false],
    ["Bilal Ahmed", "bilal@axis.local", RoleName.EMPLOYEE, "Hardware", false],
    ["Mina Shah", "mina@axis.local", RoleName.EMPLOYEE, "Design", false],
    ["Raza Intern", "raza@axis.local", RoleName.INTERN, "Software Development", false],
    ["Client Guest", "client@axis.local", RoleName.CLIENT_GUEST, "Business Development", false],
  ] as const;

  const users = [admin];
  for (const [name, email, role, department, finance] of people) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name,
        email,
        passwordHash,
        roleId: roles.get(role)!.id,
        departmentId: departmentByName.get(department)!.id,
        joiningDate: new Date("2026-02-01"),
        canViewFinance: finance,
        canViewSensitiveDocuments: role === RoleName.ADMIN,
      },
    });
    users.push(user);
  }

  const userByEmail = new Map(users.map((user) => [user.email, user]));

  await prisma.department.update({
    where: { id: departmentByName.get("Software Development")!.id },
    data: { headId: userByEmail.get("hamza@axis.local")!.id },
  });
  await prisma.department.update({
    where: { id: departmentByName.get("Operations")!.id },
    data: { headId: userByEmail.get("sara@axis.local")!.id },
  });

  for (const user of users.filter((u) => u.email !== "client@axis.local")) {
    await prisma.hRProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        employeeCode: `AX-${users.indexOf(user) + 100}`,
        status: user.email.includes("raza") ? EmployeeStatus.INTERN : EmployeeStatus.ACTIVE,
        joiningDate: user.joiningDate,
        probationEndDate: new Date("2026-08-01"),
        salaryAmount: user.email === "admin@axis.local" ? 750000 : 180000,
        contractStatus: "Signed",
        performanceNotes: "Initial onboarding complete.",
      },
    });
  }

  const projectSeeds = [
    ["Axis Office Setup", ProjectType.OFFICE_ADMIN, ProjectStatus.ACTIVE, Priority.HIGH, "Operations", "sara@axis.local", null, 2500000],
    ["Drone GCS", ProjectType.INTERNAL_PRODUCT, ProjectStatus.ACTIVE, Priority.CRITICAL, "Software Development", "hamza@axis.local", null, 5000000],
    ["Autonomous Drone R&D", ProjectType.R_AND_D, ProjectStatus.ACTIVE, Priority.CRITICAL, "Drone R&D", "ayesha@axis.local", null, 7000000],
    ["Wedsy Platform", ProjectType.INTERNAL_PRODUCT, ProjectStatus.REVIEW, Priority.HIGH, "Wedsy", "hamza@axis.local", null, 3000000],
    ["Zovu POS/Reservation System", ProjectType.INTERNAL_PRODUCT, ProjectStatus.PLANNING, Priority.HIGH, "Zovu", "hamza@axis.local", null, 3500000],
    ["Client Drone Presentation", ProjectType.CLIENT_PROJECT, ProjectStatus.ACTIVE, Priority.MEDIUM, "Business Development", "ayesha@axis.local", "Strategic Client", 800000],
    ["Hiring Pipeline", ProjectType.HR, ProjectStatus.ACTIVE, Priority.MEDIUM, "HR/Admin", "sara@axis.local", null, 250000],
    ["Investor Documentation", ProjectType.FINANCE, ProjectStatus.REVIEW, Priority.HIGH, "Finance", "admin@axis.local", null, 150000],
  ] as const;

  const projects = [];
  for (const [name, type, status, priority, department, ownerEmail, clientName, budget] of projectSeeds) {
    const project = await prisma.project.upsert({
      where: { id: `seed-${name.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}` },
      update: {},
      create: {
        id: `seed-${name.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}`,
        name,
        type,
        status,
        priority,
        startDate: new Date("2026-05-01"),
        dueDate: new Date("2026-08-30"),
        departmentId: departmentByName.get(department)!.id,
        ownerId: userByEmail.get(ownerEmail)!.id,
        clientName,
        budget,
        description: `${name} execution plan, milestones, files, board, and status tracking.`,
      },
    });
    projects.push(project);
  }

  for (const project of projects) {
    for (const member of [admin, userByEmail.get("sara@axis.local")!, userByEmail.get("hamza@axis.local")!]) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: member.id } },
        update: {},
        create: { projectId: project.id, userId: member.id, access: "member" },
      });
    }
  }
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: "seed-client-drone-presentation", userId: userByEmail.get("client@axis.local")!.id } },
    update: { access: "client" },
    create: { projectId: "seed-client-drone-presentation", userId: userByEmail.get("client@axis.local")!.id, access: "client" },
  });

  const taskSeeds = [
    ["Finalize office internet vendor", "seed-axis-office-setup", "sara@axis.local", "Operations", TaskStatus.IN_PROGRESS, Priority.HIGH],
    ["Implement GCS mission planner board", "seed-drone-gcs", "hamza@axis.local", "Software Development", TaskStatus.IN_PROGRESS, Priority.CRITICAL],
    ["Bench test autonomous fail-safe", "seed-autonomous-drone-r&d", "ayesha@axis.local", "Drone R&D", TaskStatus.WAITING, Priority.CRITICAL],
    ["Design Wedsy vendor dashboard", "seed-wedsy-platform", "mina@axis.local", "Design", TaskStatus.REVIEW, Priority.HIGH],
    ["Draft investor data room checklist", "seed-investor-documentation", "admin@axis.local", "Finance", TaskStatus.TO_DO, Priority.HIGH],
  ] as const;

  for (const [title, projectId, assigneeEmail, department, status, priority] of taskSeeds) {
    const task = await prisma.task.create({
      data: {
        title,
        description: `${title} with comments, checklist, ownership, and due date.`,
        projectId,
        assigneeId: userByEmail.get(assigneeEmail)!.id,
        reporterId: admin.id,
        departmentId: departmentByName.get(department)!.id,
        status,
        priority,
        dueDate: new Date("2026-06-15"),
        timeEstimateMinutes: 240,
        tags: ["axis", "ops"],
        approvalRequired: status === TaskStatus.REVIEW,
        checklist: { create: [{ label: "Confirm owner" }, { label: "Attach supporting files" }] },
        subtasks: { create: [{ title: "Prepare first update" }] },
      },
    });

    await prisma.notification.create({
      data: {
        userId: userByEmail.get(assigneeEmail)!.id,
        title: "Task assigned",
        body: title,
        type: "task_assigned",
        href: "/dashboard/tasks",
      },
    });

    await prisma.comment.create({
      data: {
        body: `Initial note for ${title}.`,
        authorId: admin.id,
        taskId: task.id,
        mentions: [userByEmail.get(assigneeEmail)!.id],
      },
    });
  }

  await prisma.document.createMany({
    data: [
      {
        title: "Axis NDA Template",
        category: DocumentCategory.NDAS,
        status: ApprovalStatus.APPROVED,
        content: "Standard non-disclosure agreement template.",
        uploaderId: admin.id,
        sensitive: false,
      },
      {
        title: "Investor Agreement Draft",
        category: DocumentCategory.INVESTOR_AGREEMENTS,
        status: ApprovalStatus.UNDER_REVIEW,
        content: "Restricted investor agreement draft.",
        uploaderId: admin.id,
        projectId: "seed-investor-documentation",
        sensitive: true,
      },
      {
        title: "Drone GCS Technical Notes",
        category: DocumentCategory.TECHNICAL_DOCS,
        status: ApprovalStatus.DRAFT,
        content: "Architecture notes for GCS modules.",
        uploaderId: userByEmail.get("hamza@axis.local")!.id,
        projectId: "seed-drone-gcs",
        sensitive: false,
      },
    ],
  });

  await prisma.candidate.createMany({
    data: [
      { name: "Nimra Dev", roleAppliedFor: "Full-stack Engineer", email: "nimra@example.com", phone: "+92 300 1111111", expectedSalary: 220000, stage: CandidateStage.INTERVIEW_SCHEDULED, rating: 4, assignedInterviewerId: userByEmail.get("hamza@axis.local")!.id },
      { name: "Usman Ops", roleAppliedFor: "Operations Associate", email: "usman@example.com", phone: "+92 300 2222222", expectedSalary: 150000, stage: CandidateStage.SHORTLISTED, rating: 3, assignedInterviewerId: userByEmail.get("sara@axis.local")!.id },
    ],
  });

  await prisma.procurementItem.createMany({
    data: [
      { itemName: "Conference table", category: ProcurementCategory.FURNITURE, vendor: "Workspace Co", estimatedCost: 180000, status: ProcurementStatus.QUOTED, assignedPersonId: userByEmail.get("sara@axis.local")!.id, paymentStatus: PaymentStatus.PENDING },
      { itemName: "Lab oscilloscopes", category: ProcurementCategory.LAB_EQUIPMENT, vendor: "TechLab", estimatedCost: 600000, status: ProcurementStatus.APPROVED, assignedPersonId: userByEmail.get("bilal@axis.local")!.id, paymentStatus: PaymentStatus.APPROVED },
      { itemName: "CCTV installation", category: ProcurementCategory.CCTV_SECURITY, vendor: "SecureNet", estimatedCost: 250000, status: ProcurementStatus.PURCHASED, assignedPersonId: userByEmail.get("sara@axis.local")!.id, paymentStatus: PaymentStatus.PAID },
    ],
  });

  await prisma.expense.createMany({
    data: [
      { title: "Office advance payment", amount: 500000, category: "Office Setup", projectId: "seed-axis-office-setup", paidById: admin.id, approvedById: admin.id, paymentMethod: "Bank transfer", status: ExpenseStatus.PAID },
      { title: "Drone prototype parts", amount: 320000, category: "R&D", projectId: "seed-autonomous-drone-r&d", paidById: userByEmail.get("ayesha@axis.local")!.id, approvedById: admin.id, paymentMethod: "Card", status: ExpenseStatus.APPROVED },
    ],
  });

  const meeting = await prisma.meeting.create({
    data: {
      title: "Weekly Axis leadership sync",
      scheduledAt: new Date("2026-06-03T10:00:00+05:00"),
      organizerId: admin.id,
      projectId: "seed-axis-office-setup",
      agenda: "Project health, blockers, procurement, hiring, and finance approvals.",
      notes: "Review all blocked tasks and pending approvals.",
      decisions: "Keep Drone GCS as top delivery priority.",
      participants: { create: [{ userId: admin.id }, { userId: userByEmail.get("sara@axis.local")!.id }, { userId: userByEmail.get("hamza@axis.local")!.id }] },
      actionItems: {
        create: [{ title: "Convert meeting decisions into project tasks", ownerId: userByEmail.get("sara@axis.local")!.id, dueDate: new Date("2026-06-05") }],
      },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: ActivityAction.CREATE, entityType: "System", summary: "Axis platform seed data installed." },
      { actorId: admin.id, action: ActivityAction.CREATE, entityType: "Meeting", entityId: meeting.id, summary: "Weekly Axis leadership sync created." },
      { actorId: admin.id, action: ActivityAction.ACCESS_CHANGE, entityType: "Role", summary: "Default role-based access model configured." },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
