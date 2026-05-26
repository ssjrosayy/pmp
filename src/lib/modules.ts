import { z } from "zod";
import { RoleName } from "@prisma/client";
import type { ModuleKey } from "@/lib/rbac";

export type FieldType =
  | "text"
  | "email"
  | "password"
  | "textarea"
  | "date"
  | "datetime"
  | "number"
  | "money"
  | "select"
  | "boolean"
  | "tags";

export type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  hiddenOnTable?: boolean;
  sensitive?: boolean;
  defaultValue?: string | boolean;
};

export type ModuleConfig = {
  key: ModuleKey;
  title: string;
  singular: string;
  description: string;
  delegate: string;
  icon: string;
  fields: FieldConfig[];
  tableFields: string[];
  searchFields: string[];
  defaultSort?: Record<string, "asc" | "desc">;
};

export const enumOptions = {
  roles: Object.values(RoleName),
  userStatus: ["ACTIVE", "INACTIVE", "INVITED"],
  projectType: ["INTERNAL_PRODUCT", "CLIENT_PROJECT", "R_AND_D", "OFFICE_ADMIN", "SALES", "HR", "FINANCE"],
  projectStatus: ["PLANNING", "ACTIVE", "BLOCKED", "REVIEW", "COMPLETED", "PAUSED"],
  priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  taskStatus: ["BACKLOG", "TO_DO", "IN_PROGRESS", "WAITING", "REVIEW", "DONE", "CANCELLED"],
  documentCategory: ["CONTRACTS", "OFFER_LETTERS", "INVESTOR_AGREEMENTS", "NDAS", "JDS", "COMPANY_POLICIES", "TECHNICAL_DOCS", "CLIENT_PROPOSALS", "MEETING_NOTES"],
  approvalStatus: ["DRAFT", "UNDER_REVIEW", "APPROVED", "SIGNED", "ARCHIVED"],
  employeeStatus: ["CANDIDATE", "OFFERED", "ACTIVE", "PROBATION", "CONTRACTOR", "INTERN", "TERMINATED", "RESIGNED"],
  candidateStage: ["APPLIED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "SELECTED", "OFFER_SENT", "HIRED", "REJECTED"],
  procurementCategory: ["FURNITURE", "AC_COOLING", "ELECTRONICS", "CCTV_SECURITY", "INTERNET", "BRANDING", "LAB_EQUIPMENT", "KITCHEN", "STATIONERY", "MISCELLANEOUS"],
  procurementStatus: ["NEEDED", "QUOTED", "APPROVED", "PURCHASED", "DELIVERED", "INSTALLED", "CANCELLED"],
  paymentStatus: ["PENDING", "APPROVED", "PAID", "REJECTED"],
  expenseStatus: ["PENDING", "APPROVED", "PAID", "REJECTED"],
};

export const modules: Record<ModuleKey, ModuleConfig> = {
  users: {
    key: "users",
    title: "User Administration",
    singular: "User",
    description: "Super-admin-only provisioning, password resets, deactivation, reactivation, non-super-admin account deletion, roles, departments, and access controls.",
    delegate: "user",
    icon: "Users",
    tableFields: ["name", "email", "role", "department", "status", "canViewFinance"],
    searchFields: ["name", "email", "phone"],
    defaultSort: { createdAt: "desc" },
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Temporary password", type: "password", hiddenOnTable: true },
      { name: "phone", label: "Phone", type: "text" },
      { name: "roleId", label: "Role", type: "select", required: true },
      { name: "departmentId", label: "Department", type: "select" },
      { name: "joiningDate", label: "Joining date", type: "date" },
      { name: "status", label: "Status", type: "select", options: enumOptions.userStatus, defaultValue: "ACTIVE" },
      { name: "salaryVisible", label: "Can view own salary", type: "boolean", sensitive: true },
      { name: "canViewFinance", label: "Finance access", type: "boolean", sensitive: true },
      { name: "canViewSensitiveDocuments", label: "Sensitive documents", type: "boolean", sensitive: true },
    ],
  },
  departments: {
    key: "departments",
    title: "Departments",
    singular: "Department",
    description: "Axis departments with heads, members, KPIs, notes, projects, and tasks.",
    delegate: "department",
    icon: "Building2",
    tableFields: ["name", "head", "notes"],
    searchFields: ["name", "notes"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "headId", label: "Department head", type: "select" },
      { name: "notes", label: "Internal notes", type: "textarea" },
    ],
  },
  projects: {
    key: "projects",
    title: "Projects",
    singular: "Project",
    description: "Client, product, R&D, office, HR, sales, and finance initiatives with ownership.",
    delegate: "project",
    icon: "BriefcaseBusiness",
    tableFields: ["name", "type", "status", "priority", "owner", "department", "dueDate"],
    searchFields: ["name", "description", "clientName"],
    defaultSort: { updatedAt: "desc" },
    fields: [
      { name: "name", label: "Project name", type: "text", required: true },
      { name: "type", label: "Project type", type: "select", options: enumOptions.projectType, required: true },
      { name: "status", label: "Status", type: "select", options: enumOptions.projectStatus },
      { name: "priority", label: "Priority", type: "select", options: enumOptions.priority },
      { name: "startDate", label: "Start date", type: "date" },
      { name: "dueDate", label: "Due date", type: "date" },
      { name: "ownerId", label: "Project owner", type: "select", required: true },
      { name: "departmentId", label: "Department", type: "select" },
      { name: "clientName", label: "Client name", type: "text" },
      { name: "budget", label: "Budget", type: "money" },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  tasks: {
    key: "tasks",
    title: "Tasks",
    singular: "Task",
    description: "Kanban, list, assigned work, approvals, estimates, blockers, and recurring tasks.",
    delegate: "task",
    icon: "ListChecks",
    tableFields: ["title", "status", "priority", "project", "assignee", "department", "dueDate"],
    searchFields: ["title", "description"],
    defaultSort: { updatedAt: "desc" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "projectId", label: "Project", type: "select" },
      { name: "assigneeId", label: "Assignee", type: "select" },
      { name: "departmentId", label: "Department", type: "select" },
      { name: "status", label: "Status", type: "select", options: enumOptions.taskStatus },
      { name: "priority", label: "Priority", type: "select", options: enumOptions.priority },
      { name: "dueDate", label: "Due date", type: "date" },
      { name: "timeEstimateMinutes", label: "Estimate minutes", type: "number" },
      { name: "timeSpentMinutes", label: "Time spent minutes", type: "number" },
      { name: "tags", label: "Tags", type: "tags" },
      { name: "approvalRequired", label: "Approval required", type: "boolean" },
      { name: "recurringRule", label: "Recurring rule", type: "text" },
    ],
  },
  documents: {
    key: "documents",
    title: "Documents",
    singular: "Document",
    description: "Contracts, investor docs, policies, technical docs, proposals, comments, and versions.",
    delegate: "document",
    icon: "FileText",
    tableFields: ["title", "category", "status", "project", "sensitive", "uploader"],
    searchFields: ["title", "content", "fileName"],
    defaultSort: { updatedAt: "desc" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: enumOptions.documentCategory, required: true },
      { name: "status", label: "Approval status", type: "select", options: enumOptions.approvalStatus },
      { name: "projectId", label: "Project", type: "select" },
      { name: "fileUrl", label: "File URL", type: "text" },
      { name: "fileName", label: "File name", type: "text" },
      { name: "content", label: "Text document", type: "textarea" },
      { name: "sensitive", label: "Sensitive", type: "boolean", sensitive: true },
    ],
  },
  hr: {
    key: "hr",
    title: "HR Records",
    singular: "HR Record",
    description: "Employee status, probation, contracts, restricted salaries, performance, and warnings.",
    delegate: "hRProfile",
    icon: "IdCard",
    tableFields: ["user", "employeeCode", "status", "joiningDate", "contractStatus"],
    searchFields: ["employeeCode", "contractStatus", "performanceNotes"],
    fields: [
      { name: "userId", label: "Employee", type: "select", required: true },
      { name: "employeeCode", label: "Employee code", type: "text" },
      { name: "status", label: "Status", type: "select", options: enumOptions.employeeStatus },
      { name: "joiningDate", label: "Joining date", type: "date" },
      { name: "probationEndDate", label: "Probation end date", type: "date" },
      { name: "salaryAmount", label: "Salary amount", type: "money", sensitive: true },
      { name: "contractStatus", label: "Contract status", type: "text" },
      { name: "attendanceNotes", label: "Attendance notes", type: "textarea" },
      { name: "performanceNotes", label: "Performance notes", type: "textarea" },
      { name: "warnings", label: "Warnings", type: "textarea" },
    ],
  },
  candidates: {
    key: "candidates",
    title: "Hiring Pipeline",
    singular: "Candidate",
    description: "Applicant tracking from applied to hired or rejected with interview ownership.",
    delegate: "candidate",
    icon: "UserRoundSearch",
    tableFields: ["name", "roleAppliedFor", "stage", "rating", "assignedInterviewer"],
    searchFields: ["name", "email", "phone", "roleAppliedFor", "interviewNotes"],
    fields: [
      { name: "name", label: "Candidate name", type: "text", required: true },
      { name: "roleAppliedFor", label: "Role applied for", type: "text", required: true },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "cvUrl", label: "CV URL", type: "text" },
      { name: "expectedSalary", label: "Expected salary", type: "money" },
      { name: "stage", label: "Stage", type: "select", options: enumOptions.candidateStage },
      { name: "interviewNotes", label: "Interview notes", type: "textarea" },
      { name: "rating", label: "Rating", type: "number" },
      { name: "assignedInterviewerId", label: "Interviewer", type: "select" },
    ],
  },
  procurement: {
    key: "procurement",
    title: "Procurement",
    singular: "Procurement Item",
    description: "Office setup, purchases, vendors, approvals, delivery, installation, and receipts.",
    delegate: "procurementItem",
    icon: "ShoppingCart",
    tableFields: ["itemName", "category", "status", "vendor", "estimatedCost", "paymentStatus", "assignedPerson"],
    searchFields: ["itemName", "vendor", "notes"],
    fields: [
      { name: "itemName", label: "Item name", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: enumOptions.procurementCategory, required: true },
      { name: "vendor", label: "Vendor", type: "text" },
      { name: "estimatedCost", label: "Estimated cost", type: "money" },
      { name: "actualCost", label: "Actual cost", type: "money" },
      { name: "status", label: "Status", type: "select", options: enumOptions.procurementStatus },
      { name: "assignedPersonId", label: "Assigned person", type: "select" },
      { name: "dueDate", label: "Due date", type: "date" },
      { name: "paymentStatus", label: "Payment status", type: "select", options: enumOptions.paymentStatus },
      { name: "receiptUrl", label: "Receipt URL", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  expenses: {
    key: "expenses",
    title: "Finance",
    singular: "Expense",
    description: "Restricted expense tracking, approvals, monthly spend, project and category summaries.",
    delegate: "expense",
    icon: "WalletCards",
    tableFields: ["title", "amount", "category", "status", "project", "paidBy", "date"],
    searchFields: ["title", "category", "paymentMethod"],
    fields: [
      { name: "title", label: "Expense title", type: "text", required: true },
      { name: "amount", label: "Amount", type: "money", required: true },
      { name: "category", label: "Category", type: "text", required: true },
      { name: "projectId", label: "Project", type: "select" },
      { name: "departmentId", label: "Department", type: "select" },
      { name: "paidById", label: "Paid by", type: "select" },
      { name: "approvedById", label: "Approved by", type: "select" },
      { name: "date", label: "Date", type: "date" },
      { name: "paymentMethod", label: "Payment method", type: "text" },
      { name: "receiptUrl", label: "Receipt URL", type: "text" },
      { name: "status", label: "Status", type: "select", options: enumOptions.expenseStatus },
    ],
  },
  meetings: {
    key: "meetings",
    title: "Meetings",
    singular: "Meeting",
    description: "Agendas, notes, decisions, follow-ups, participants, and action items.",
    delegate: "meeting",
    icon: "CalendarClock",
    tableFields: ["title", "scheduledAt", "project", "organizer", "followUpDate"],
    searchFields: ["title", "agenda", "notes", "decisions"],
    fields: [
      { name: "title", label: "Meeting title", type: "text", required: true },
      { name: "scheduledAt", label: "Date/time", type: "datetime", required: true },
      { name: "organizerId", label: "Organizer", type: "select" },
      { name: "projectId", label: "Related project", type: "select" },
      { name: "agenda", label: "Agenda", type: "textarea" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "decisions", label: "Decisions", type: "textarea" },
      { name: "followUpDate", label: "Follow-up date", type: "date" },
      { name: "attachmentUrl", label: "Attachment URL", type: "text" },
    ],
  },
  notifications: {
    key: "notifications",
    title: "Notifications",
    singular: "Notification",
    description: "In-app events for assignments, due dates, comments, approvals, sharing, and status changes.",
    delegate: "notification",
    icon: "Bell",
    tableFields: ["title", "type", "body", "createdAt", "readAt"],
    searchFields: ["title", "body", "type"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Body", type: "textarea" },
      { name: "type", label: "Type", type: "text" },
      { name: "href", label: "Link", type: "text" },
    ],
  },
  auditLogs: {
    key: "auditLogs",
    title: "Audit Logs",
    singular: "Audit Log",
    description: "Login, user, project, task, document, finance, and permission changes.",
    delegate: "auditLog",
    icon: "ShieldCheck",
    tableFields: ["action", "entityType", "summary", "actor", "createdAt"],
    searchFields: ["summary", "entityType"],
    defaultSort: { createdAt: "desc" },
    fields: [
      { name: "summary", label: "Summary", type: "text" },
      { name: "entityType", label: "Entity type", type: "text" },
      { name: "action", label: "Action", type: "text" },
    ],
  },
};

export const moduleKeys = Object.keys(modules) as ModuleKey[];

export const writeSchema = z.record(z.string(), z.unknown());

export function getModuleConfig(key: string): ModuleConfig | null {
  return key in modules ? modules[key as ModuleKey] : null;
}
