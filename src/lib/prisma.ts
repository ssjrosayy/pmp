import { randomUUID } from "node:crypto";
import { MongoClient, type Db, type Document, type Filter } from "mongodb";

type Row = Record<string, unknown>;
// The adapter exposes dynamic module records matching the generic admin table configuration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResultRow = Record<string, any> & { id: string };
type StoredDocument = Document & { _id: string };
type QueryArgs = {
  where?: Row;
  include?: Row;
  select?: Row;
  orderBy?: Record<string, "asc" | "desc">;
  take?: number;
  skip?: number;
  data?: Row | Row[];
  by?: string[];
  _sum?: Row;
  _count?: unknown;
  update?: Row;
  create?: Row;
};

const collections = {
  role: "Role",
  permission: "Permission",
  rolePermission: "RolePermission",
  user: "User",
  department: "Department",
  project: "Project",
  projectMember: "ProjectMember",
  milestone: "Milestone",
  task: "Task",
  taskDependency: "TaskDependency",
  subtask: "Subtask",
  checklistItem: "ChecklistItem",
  comment: "Comment",
  document: "Document",
  documentVersion: "DocumentVersion",
  documentPermission: "DocumentPermission",
  hRProfile: "HRProfile",
  candidate: "Candidate",
  procurementItem: "ProcurementItem",
  expense: "Expense",
  meeting: "Meeting",
  meetingParticipant: "MeetingParticipant",
  meetingActionItem: "MeetingActionItem",
  notification: "Notification",
  auditLog: "AuditLog",
} as const;

type DelegateName = keyof typeof collections;
type CollectionName = (typeof collections)[DelegateName];

type Relation = {
  collection: CollectionName;
  sourceField?: string;
  foreignField?: string;
  many?: boolean;
};

const relations: Partial<Record<CollectionName, Record<string, Relation>>> = {
  User: {
    role: { collection: "Role", sourceField: "roleId" },
    department: { collection: "Department", sourceField: "departmentId" },
    leadingDepartments: { collection: "Department", foreignField: "headId", many: true },
    ownedProjects: { collection: "Project", foreignField: "ownerId", many: true },
    projectMemberships: { collection: "ProjectMember", foreignField: "userId", many: true },
    assignedTasks: { collection: "Task", foreignField: "assigneeId", many: true },
    reportedTasks: { collection: "Task", foreignField: "reporterId", many: true },
    comments: { collection: "Comment", foreignField: "authorId", many: true },
    documentsUploaded: { collection: "Document", foreignField: "uploaderId", many: true },
    documentPermissions: { collection: "DocumentPermission", foreignField: "userId", many: true },
    hrProfile: { collection: "HRProfile", foreignField: "userId" },
    candidatesAssigned: { collection: "Candidate", foreignField: "assignedInterviewerId", many: true },
    expensesPaid: { collection: "Expense", foreignField: "paidById", many: true },
    expensesApproved: { collection: "Expense", foreignField: "approvedById", many: true },
    procurementAssigned: { collection: "ProcurementItem", foreignField: "assignedPersonId", many: true },
    meetingsOrganized: { collection: "Meeting", foreignField: "organizerId", many: true },
    meetingParticipants: { collection: "MeetingParticipant", foreignField: "userId", many: true },
    notifications: { collection: "Notification", foreignField: "userId", many: true },
    auditLogs: { collection: "AuditLog", foreignField: "actorId", many: true },
  },
  Department: {
    head: { collection: "User", sourceField: "headId" },
    members: { collection: "User", foreignField: "departmentId", many: true },
    projects: { collection: "Project", foreignField: "departmentId", many: true },
    tasks: { collection: "Task", foreignField: "departmentId", many: true },
  },
  Project: {
    owner: { collection: "User", sourceField: "ownerId" },
    department: { collection: "Department", sourceField: "departmentId" },
    members: { collection: "ProjectMember", foreignField: "projectId", many: true },
    tasks: { collection: "Task", foreignField: "projectId", many: true },
    milestones: { collection: "Milestone", foreignField: "projectId", many: true },
    documents: { collection: "Document", foreignField: "projectId", many: true },
  },
  ProjectMember: {
    project: { collection: "Project", sourceField: "projectId" },
    user: { collection: "User", sourceField: "userId" },
  },
  Task: {
    project: { collection: "Project", sourceField: "projectId" },
    assignee: { collection: "User", sourceField: "assigneeId" },
    reporter: { collection: "User", sourceField: "reporterId" },
    department: { collection: "Department", sourceField: "departmentId" },
    subtasks: { collection: "Subtask", foreignField: "taskId", many: true },
    checklist: { collection: "ChecklistItem", foreignField: "taskId", many: true },
    comments: { collection: "Comment", foreignField: "taskId", many: true },
  },
  Document: {
    uploader: { collection: "User", sourceField: "uploaderId" },
    project: { collection: "Project", sourceField: "projectId" },
    versions: { collection: "DocumentVersion", foreignField: "documentId", many: true },
    comments: { collection: "Comment", foreignField: "documentId", many: true },
    permissions: { collection: "DocumentPermission", foreignField: "documentId", many: true },
  },
  HRProfile: {
    user: { collection: "User", sourceField: "userId" },
    documents: { collection: "Document", foreignField: "employeeProfileId", many: true },
  },
  Candidate: { assignedInterviewer: { collection: "User", sourceField: "assignedInterviewerId" } },
  ProcurementItem: { assignedPerson: { collection: "User", sourceField: "assignedPersonId" } },
  Expense: {
    project: { collection: "Project", sourceField: "projectId" },
    paidBy: { collection: "User", sourceField: "paidById" },
    approvedBy: { collection: "User", sourceField: "approvedById" },
  },
  Meeting: {
    organizer: { collection: "User", sourceField: "organizerId" },
    project: { collection: "Project", sourceField: "projectId" },
    participants: { collection: "MeetingParticipant", foreignField: "meetingId", many: true },
    actionItems: { collection: "MeetingActionItem", foreignField: "meetingId", many: true },
  },
  Notification: { user: { collection: "User", sourceField: "userId" } },
  AuditLog: { actor: { collection: "User", sourceField: "actorId" } },
};

const defaults: Partial<Record<CollectionName, Row>> = {
  User: { status: "ACTIVE", salaryVisible: false, canViewFinance: false, canViewSensitiveDocuments: false },
  Project: { status: "PLANNING", priority: "MEDIUM" },
  Task: { status: "TO_DO", priority: "MEDIUM", tags: [], approvalRequired: false },
  Document: { status: "DRAFT", sensitive: false },
  HRProfile: { status: "ACTIVE", salaryCurrency: "PKR" },
  Candidate: { stage: "APPLIED" },
  ProcurementItem: { status: "NEEDED", paymentStatus: "PENDING" },
  Expense: { status: "PENDING" },
  Subtask: { completed: false },
  ChecklistItem: { completed: false },
  MeetingActionItem: { completed: false },
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString?.startsWith("mongodb")) {
  throw new Error("DATABASE_URL must be set to the Azure Cosmos DB for MongoDB connection string.");
}

const globalForCosmos = globalThis as unknown as {
  cosmosClient?: MongoClient;
  cosmosDb?: Promise<Db>;
};

const mongoClient = globalForCosmos.cosmosClient ?? new MongoClient(connectionString);
const database = globalForCosmos.cosmosDb ?? mongoClient.connect().then((client) => client.db());

if (process.env.NODE_ENV !== "production") {
  globalForCosmos.cosmosClient = mongoClient;
  globalForCosmos.cosmosDb = database;
}

function isRow(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRow(document: Document): Row {
  const { _id, ...data } = document;
  return { id: String(_id), ...data };
}

function toDocument(row: Row): Document {
  const { id, ...data } = row;
  return { _id: String(id), ...data };
}

function normalizeCompoundWhere(where: Row | undefined) {
  if (!where) return {};
  const normalized: Row = {};
  for (const [field, value] of Object.entries(where)) {
    if (isRow(value) && ["resource_action", "roleId_permissionId", "projectId_userId", "taskId_dependsOnId", "documentId_version", "meetingId_userId"].includes(field)) {
      Object.assign(normalized, value);
    } else {
      normalized[field] = value;
    }
  }
  return normalized;
}

function fieldName(field: string) {
  return field === "id" ? "_id" : field;
}

function toMongoFilter(whereInput: Row | undefined, collection: CollectionName): Filter<Document> | null {
  const where = normalizeCompoundWhere(whereInput);
  const filter: Filter<Document> = {};

  for (const [field, value] of Object.entries(where)) {
    if (field === "AND" || field === "OR") {
      if (!Array.isArray(value)) return null;
      const parts = value.map((part) => (isRow(part) ? toMongoFilter(part, collection) : null));
      if (parts.some((part) => part === null)) return null;
      filter[field === "AND" ? "$and" : "$or"] = parts as Filter<Document>[];
      continue;
    }
    if (relations[collection]?.[field]) return null;

    const storedField = fieldName(field);
    if (!isRow(value)) {
      filter[storedField] = value;
      continue;
    }

    const operations: Row = {};
    for (const [operator, operand] of Object.entries(value)) {
      if (operator === "contains") operations.$regex = new RegExp(String(operand).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      else if (operator === "in") operations.$in = operand;
      else if (operator === "notIn") operations.$nin = operand;
      else if (operator === "not") operations.$ne = operand;
      else if (operator === "lt") operations.$lt = operand;
      else if (operator === "lte") operations.$lte = operand;
      else if (operator === "gt") operations.$gt = operand;
      else if (operator === "gte") operations.$gte = operand;
      else return null;
    }
    filter[storedField] = operations;
  }

  return filter;
}

async function rowsFor(collection: CollectionName, filter: Filter<Document> = {}) {
  const db = await database;
  return (await db.collection<StoredDocument>(collection).find(filter as Filter<StoredDocument>).toArray()).map(toRow);
}

async function fullSnapshot() {
  const entries = await Promise.all(
    Object.values(collections).map(async (collection) => [collection, await rowsFor(collection)] as const),
  );
  return Object.fromEntries(entries) as Record<CollectionName, Row[]>;
}

function relatedRows(collection: CollectionName, row: Row, relationName: string, snapshot: Record<CollectionName, Row[]>) {
  const relation = relations[collection]?.[relationName];
  if (!relation) return null;
  const rows = snapshot[relation.collection] ?? [];
  if (relation.sourceField) {
    const item = rows.find((target) => target.id === row[relation.sourceField!]) ?? null;
    return relation.many ? (item ? [item] : []) : item;
  }
  const matches = rows.filter((target) => target[relation.foreignField!] === row.id);
  return relation.many ? matches : matches[0] ?? null;
}

function matchesValue(value: unknown, condition: unknown) {
  if (!isRow(condition)) return value === condition;
  return Object.entries(condition).every(([operator, operand]) => {
    if (operator === "contains") return String(value ?? "").toLowerCase().includes(String(operand).toLowerCase());
    if (operator === "in") return Array.isArray(operand) && operand.includes(value);
    if (operator === "notIn") return Array.isArray(operand) && !operand.includes(value);
    if (operator === "not") return value !== operand;
    if (operator === "lt") return value !== null && value !== undefined && compareValues(value, operand) < 0;
    if (operator === "lte") return value !== null && value !== undefined && compareValues(value, operand) <= 0;
    if (operator === "gt") return value !== null && value !== undefined && compareValues(value, operand) > 0;
    if (operator === "gte") return value !== null && value !== undefined && compareValues(value, operand) >= 0;
    return false;
  });
}

function compareValues(left: unknown, right: unknown) {
  if (left instanceof Date || right instanceof Date) {
    return new Date(String(left)).getTime() - new Date(String(right)).getTime();
  }
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

function matchesWhere(collection: CollectionName, row: Row, whereInput: Row | undefined, snapshot: Record<CollectionName, Row[]>): boolean {
  const where = normalizeCompoundWhere(whereInput);
  return Object.entries(where).every(([field, condition]) => {
    if (field === "AND") return Array.isArray(condition) && condition.every((part) => isRow(part) && matchesWhere(collection, row, part, snapshot));
    if (field === "OR") return Array.isArray(condition) && condition.some((part) => isRow(part) && matchesWhere(collection, row, part, snapshot));
    const relation = relations[collection]?.[field];
    if (!relation) return matchesValue(row[field], condition);
    const related = relatedRows(collection, row, field, snapshot);
    if (isRow(condition) && "some" in condition) {
      return Array.isArray(related) && related.some((item) => isRow(condition.some) && matchesWhere(relation.collection, item, condition.some, snapshot));
    }
    return related !== null && !Array.isArray(related) && isRow(condition) && matchesWhere(relation.collection, related, condition, snapshot);
  });
}

async function includeSnapshot(collection: CollectionName, rows: Row[], include: Row | undefined) {
  const needed = new Set<CollectionName>([collection]);
  function collect(parent: CollectionName, requested: Row | undefined) {
    if (!requested) return;
    for (const [name, value] of Object.entries(requested)) {
      if (name === "_count" && isRow(value) && isRow(value.select)) {
        for (const countName of Object.keys(value.select)) {
          const relation = relations[parent]?.[countName];
          if (relation) needed.add(relation.collection);
        }
        continue;
      }
      const relation = relations[parent]?.[name];
      if (!relation) continue;
      needed.add(relation.collection);
      if (isRow(value) && isRow(value.include)) collect(relation.collection, value.include);
    }
  }
  collect(collection, include);

  const entries = await Promise.all(
    [...needed].map(async (name) => [name, name === collection ? rows : await rowsFor(name)] as const),
  );
  return Object.fromEntries(entries) as Record<CollectionName, Row[]>;
}

function enrich(collection: CollectionName, row: Row, include: Row | undefined, snapshot: Record<CollectionName, Row[]>) {
  if (!include) return { ...row };
  const item = { ...row };
  for (const [name, request] of Object.entries(include)) {
    if (name === "_count" && isRow(request) && isRow(request.select)) {
      const counts: Row = {};
      for (const relationName of Object.keys(request.select)) {
        const related = relatedRows(collection, row, relationName, snapshot);
        counts[relationName] = Array.isArray(related) ? related.length : related ? 1 : 0;
      }
      item._count = counts;
      continue;
    }
    const relation = relations[collection]?.[name];
    if (!relation) continue;
    const related = relatedRows(collection, row, name, snapshot);
    const nestedInclude = isRow(request) && isRow(request.include) ? request.include : undefined;
    item[name] = Array.isArray(related)
      ? related.map((record) => enrich(relation.collection, record, nestedInclude, snapshot))
      : related
        ? enrich(relation.collection, related, nestedInclude, snapshot)
        : null;
  }
  return item;
}

function selected(row: Row, select: Row | undefined) {
  if (!select) return row;
  return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]]));
}

function compareRows(orderBy: Record<string, "asc" | "desc"> | undefined) {
  const [field, direction] = Object.entries(orderBy ?? {})[0] ?? [];
  return (left: Row, right: Row) => {
    if (!field) return 0;
    const a = left[field];
    const b = right[field];
    const result = a === b ? 0 : a === null || a === undefined ? -1 : b === null || b === undefined ? 1 : a < b ? -1 : 1;
    return direction === "desc" ? -result : result;
  };
}

async function createRow(collection: CollectionName, input: Row, include?: Row) {
  const now = new Date();
  const nested = Object.entries(input).filter(([, value]) => isRow(value) && "create" in value);
  const data = Object.fromEntries(Object.entries(input).filter(([, value]) => !(isRow(value) && "create" in value)));
  const row: Row = {
    ...(defaults[collection] ?? {}),
    ...data,
    id: typeof data.id === "string" ? data.id : randomUUID(),
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  };
  const db = await database;
  await db.collection<StoredDocument>(collection).insertOne(toDocument(row) as StoredDocument);

  for (const [relationName, relationInput] of nested) {
    const relation = relations[collection]?.[relationName];
    if (!relation?.many || !relation.foreignField || !isRow(relationInput)) continue;
    const creates = Array.isArray(relationInput.create) ? relationInput.create : [relationInput.create];
    for (const child of creates) {
      if (isRow(child)) await createRow(relation.collection, { ...child, [relation.foreignField]: row.id });
    }
  }

  const snapshot = await includeSnapshot(collection, [row], include);
  return enrich(collection, row, include, snapshot);
}

function delegate(collection: CollectionName) {
  return {
    async findMany(args: QueryArgs = {}): Promise<ResultRow[]> {
      const filter = toMongoFilter(args.where, collection);
      let rows: Row[];
      if (filter) {
        rows = await rowsFor(collection, filter);
      } else {
        const snapshot = await fullSnapshot();
        rows = snapshot[collection].filter((row) => matchesWhere(collection, row, args.where, snapshot));
      }
      rows.sort(compareRows(args.orderBy));
      rows = rows.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
      const snapshot = await includeSnapshot(collection, rows, args.include);
      return rows.map((row) => selected(enrich(collection, row, args.include, snapshot), args.select) as ResultRow);
    },
    async findFirst(args: QueryArgs = {}) {
      return (await this.findMany({ ...args, take: 1 }))[0] ?? null;
    },
    async findUnique(args: QueryArgs) {
      return (await this.findMany({ ...args, take: 1 }))[0] ?? null;
    },
    async count(args: QueryArgs = {}) {
      const filter = toMongoFilter(args.where, collection);
      if (filter) return (await database).collection(collection).countDocuments(filter);
      return (await this.findMany({ where: args.where })).length;
    },
    async create(args: QueryArgs): Promise<ResultRow> {
      return createRow(collection, args.data as Row, args.include) as Promise<ResultRow>;
    },
    async createMany(args: QueryArgs) {
      const data = Array.isArray(args.data) ? args.data : [];
      for (const row of data) await createRow(collection, row);
      return { count: data.length };
    },
    async update(args: QueryArgs): Promise<ResultRow> {
      const existing = await this.findUnique({ where: args.where });
      if (!existing) throw new Error(`${collection} not found.`);
      const data = { ...(args.data as Row), updatedAt: new Date() };
      await (await database).collection<StoredDocument>(collection).updateOne({ _id: String(existing.id) }, { $set: data });
      const row = { ...existing, ...data };
      const snapshot = await includeSnapshot(collection, [row], args.include);
      return enrich(collection, row, args.include, snapshot) as ResultRow;
    },
    async delete(args: QueryArgs): Promise<ResultRow> {
      const existing = await this.findUnique({ where: args.where });
      if (!existing) throw new Error(`${collection} not found.`);
      await (await database).collection<StoredDocument>(collection).deleteOne({ _id: String(existing.id) });
      return existing;
    },
    async upsert(args: QueryArgs) {
      const existing = await this.findUnique({ where: args.where });
      return existing
        ? this.update({ where: { id: existing.id }, data: args.update ?? {} })
        : this.create({ data: args.create ?? {} });
    },
    async aggregate(args: QueryArgs) {
      const rows = await this.findMany({ where: args.where });
      const sum: Row = {};
      for (const field of Object.keys(args._sum ?? {})) {
        sum[field] = rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
      }
      return { _sum: sum, _count: rows.length };
    },
    async groupBy(args: QueryArgs) {
      const rows = await this.findMany({ where: args.where });
      const fields = args.by ?? [];
      const groups = new Map<string, Row>();
      for (const row of rows) {
        const values = Object.fromEntries(fields.map((field) => [field, row[field]]));
        const key = JSON.stringify(values);
        const current = groups.get(key) ?? { ...values, _count: 0 };
        current._count = Number(current._count) + 1;
        groups.set(key, current);
      }
      return [...groups.values()];
    },
  };
}

const cosmosClient = {
  role: delegate("Role"),
  permission: delegate("Permission"),
  rolePermission: delegate("RolePermission"),
  user: delegate("User"),
  department: delegate("Department"),
  project: delegate("Project"),
  projectMember: delegate("ProjectMember"),
  milestone: delegate("Milestone"),
  task: delegate("Task"),
  taskDependency: delegate("TaskDependency"),
  subtask: delegate("Subtask"),
  checklistItem: delegate("ChecklistItem"),
  comment: delegate("Comment"),
  document: delegate("Document"),
  documentVersion: delegate("DocumentVersion"),
  documentPermission: delegate("DocumentPermission"),
  hRProfile: delegate("HRProfile"),
  candidate: delegate("Candidate"),
  procurementItem: delegate("ProcurementItem"),
  expense: delegate("Expense"),
  meeting: delegate("Meeting"),
  meetingParticipant: delegate("MeetingParticipant"),
  meetingActionItem: delegate("MeetingActionItem"),
  notification: delegate("Notification"),
  auditLog: delegate("AuditLog"),
  async $disconnect() {
    await mongoClient.close();
  },
};

export const prisma = cosmosClient;
