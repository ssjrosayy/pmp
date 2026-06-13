"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, KeyRound, Plus, Printer, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatCurrency, titleCase } from "@/lib/utils";

type Field = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  hiddenOnTable?: boolean;
  sensitive?: boolean;
  defaultValue?: string | boolean;
};

type Config = {
  key: string;
  title: string;
  singular: string;
  description: string;
  fields: Field[];
  tableFields: string[];
};

type References = {
  roles: { id: string; label: string; name: string }[];
  users: { id: string; name: string; email: string }[];
  departments: { id: string; name: string }[];
  projects: { id: string; name: string }[];
};

const hrFieldGroups = [
  {
    title: "Personal Information",
    fields: ["fullName", "employeeCode", "contactDetails", "emergencyContacts", "cnic", "bankAccountDetails"],
  },
  {
    title: "Employment Lifecycle",
    fields: ["joiningDate", "probationStartDate", "probationEndDate", "confirmationDate", "resignationDate", "leavingDate"],
  },
  {
    title: "Job & Role Details",
    fields: ["designation", "departmentId", "reportingManagerId", "employmentType", "contractStatus"],
  },
  {
    title: "Leave & Attendance",
    fields: ["casualLeaveBalance", "medicalLeaveBalance", "annualLeaveBalance", "leaveRequests", "attendanceLogs", "attendanceNotes"],
  },
  {
    title: "Performance & Assets",
    fields: ["performanceHistory", "promotionHistory", "performanceNotes", "warnings", "assetLedger"],
  },
  {
    title: "Financials & Payroll",
    fields: ["salaryAmount", "baseSalary", "allowances", "bonuses", "deductions", "payrollNotes", "payslips"],
  },
];

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function listText(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function parseListText(value: unknown) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fieldDefinition(config: Config | null, name: string) {
  return config?.fields.find((field) => field.name === name);
}

function hrDisplayValue(record: Record<string, unknown>, field: string) {
  if (field === "departmentId") return asRecord(record.department)?.name ?? asRecord(asRecord(record.user)?.department)?.name ?? "-";
  if (field === "reportingManagerId") return asRecord(record.reportingManager)?.name ?? "-";
  const value = record[field];
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return `${value.length} entr${value.length === 1 ? "y" : "ies"}`;
  if (field.toLowerCase().includes("date")) return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(String(value)));
  if (["salaryAmount", "baseSalary", "allowances", "bonuses", "deductions"].includes(field)) return formatCurrency(String(value));
  return String(value);
}

function optionUnderline(value: unknown) {
  const key = String(value ?? "").toUpperCase();
  const colors: Record<string, string> = {
    APPLIED: "#94a3b8",
    SHORTLISTED: "#06b6d4",
    INTERVIEW_SCHEDULED: "#8b5cf6",
    INTERVIEWED: "#2563eb",
    SELECTED: "#059669",
    OFFER_SENT: "#f59e0b",
    HIRED: "#0d9488",
    REJECTED: "#dc2626",
    ACTIVE: "#059669",
    INACTIVE: "#94a3b8",
    INVITED: "#3b82f6",
    PROBATION: "#a855f7",
    CONTRACTOR: "#f97316",
    INTERN: "#06b6d4",
    TERMINATED: "#dc2626",
    RESIGNED: "#e11d48",
    FULL_TIME: "#059669",
    PART_TIME: "#06b6d4",
    CONTRACT: "#f97316",
    REMOTE: "#2563eb",
  };
  return colors[key] ?? "#3b82f6";
}

function stageCell(value: unknown) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">-</span>;
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="font-medium text-slate-800">{titleCase(String(value))}</span>
      <span className="block h-1 rounded-full" style={{ backgroundColor: optionUnderline(value) }} />
    </span>
  );
}

function currencyValue(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function payslipNumbers(record: Record<string, unknown>, payslip: Record<string, unknown>) {
  const base = Number(record.baseSalary ?? record.salaryAmount ?? 0);
  const allowances = Number(record.allowances ?? 0);
  const bonuses = Number(record.bonuses ?? 0);
  const deductions = Number(payslip.deductions ?? record.deductions ?? 0);
  const gross = Number(payslip.gross ?? base + allowances + bonuses);
  const net = Number(payslip.net ?? gross - deductions);
  return { base, allowances, bonuses, deductions, gross, net };
}

function payslipFileName(record: Record<string, unknown>, payslip: Record<string, unknown>) {
  const employeeCode = String(record.employeeCode ?? "employee").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const month = String(payslip.month ?? "payslip").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `${employeeCode}-${month}-payslip.pdf`;
}

function printPayslip(record: Record<string, unknown>, payslip: Record<string, unknown>) {
  const numbers = payslipNumbers(record, payslip);
  const employee = String(record.fullName ?? displayValue(record, "user") ?? "Employee");
  const code = String(record.employeeCode ?? "-");
  const designation = String(record.designation ?? "-");
  const department = String(asRecord(record.department)?.name ?? asRecord(asRecord(record.user)?.department)?.name ?? "-");
  const month = String(payslip.month ?? "-");
  const status = String(payslip.status ?? "GENERATED");
  const issuedOn = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date());
  const printable = window.open("", "_blank", "width=900,height=1100");
  if (!printable) return;
  printable.document.write(`<!doctype html>
<html>
  <head>
    <title>Pay Slip - ${employee}</title>
    <style>
      body { margin: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a; }
      .page { width: 760px; margin: 28px auto; background: white; border: 1px solid #dbe3ef; padding: 34px; }
      .header { display: flex; justify-content: space-between; border-bottom: 3px solid #1d4ed8; padding-bottom: 18px; }
      .brand { font-size: 28px; font-weight: 800; color: #1d4ed8; }
      .muted { color: #64748b; font-size: 12px; line-height: 1.6; }
      h1 { font-size: 22px; margin: 26px 0 16px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
      .box { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
      .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; }
      .value { margin-top: 6px; font-size: 14px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 13px; }
      th { background: #f1f5f9; color: #334155; }
      td.amount { text-align: right; font-weight: 700; }
      .net { margin-top: 18px; display: flex; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; font-weight: 800; }
      .footer { margin-top: 30px; display: flex; justify-content: space-between; color: #64748b; font-size: 12px; }
      .actions { width: 760px; margin: 20px auto 0; text-align: right; }
      .actions button { background: #1d4ed8; color: white; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 700; }
      @media print { body { background: white; } .actions { display: none; } .page { margin: 0 auto; border: 0; } }
    </style>
  </head>
  <body>
    <div class="actions"><button onclick="window.print()">Print Pay Slip</button></div>
    <main class="page">
      <section class="header">
        <div><div class="brand">AXIS OPS</div><div class="muted">Internal Operations Platform<br/>Monthly Pay Slip</div></div>
        <div class="muted">Pay Period: <strong>${month}</strong><br/>Status: <strong>${status}</strong><br/>Issued: ${issuedOn}</div>
      </section>
      <h1>Employee Pay Slip</h1>
      <section class="grid">
        <div class="box"><div class="label">Employee</div><div class="value">${employee}</div></div>
        <div class="box"><div class="label">Employee ID</div><div class="value">${code}</div></div>
        <div class="box"><div class="label">Designation</div><div class="value">${designation}</div></div>
        <div class="box"><div class="label">Department</div><div class="value">${department}</div></div>
      </section>
      <table>
        <thead><tr><th>Earnings</th><th class="amount">Amount (PKR)</th></tr></thead>
        <tbody>
          <tr><td>Base Salary</td><td class="amount">${currencyValue(numbers.base)}</td></tr>
          <tr><td>Allowances</td><td class="amount">${currencyValue(numbers.allowances)}</td></tr>
          <tr><td>Bonuses</td><td class="amount">${currencyValue(numbers.bonuses)}</td></tr>
          <tr><td>Gross Pay</td><td class="amount">${currencyValue(numbers.gross)}</td></tr>
        </tbody>
      </table>
      <table>
        <thead><tr><th>Deductions</th><th class="amount">Amount (PKR)</th></tr></thead>
        <tbody><tr><td>Tax / Provident fund / Other deductions</td><td class="amount">${currencyValue(numbers.deductions)}</td></tr></tbody>
      </table>
      <div class="net"><span>Net Pay</span><span>PKR ${currencyValue(numbers.net)}</span></div>
      <section class="footer"><span>Generated by Axis Ops</span><span>Authorized HR / Payroll</span></section>
    </main>
    <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script>
  </body>
</html>`);
  printable.document.close();
}

function pdfTextLine(x: number, y: number, size: number, text: string) {
  const safe = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  return `BT /F1 ${size} Tf ${x} ${y} Td (${safe}) Tj ET\n`;
}

function downloadPayslipPdf(record: Record<string, unknown>, payslip: Record<string, unknown>) {
  const numbers = payslipNumbers(record, payslip);
  const employee = String(record.fullName ?? displayValue(record, "user") ?? "Employee");
  const code = String(record.employeeCode ?? "-");
  const designation = String(record.designation ?? "-");
  const department = String(asRecord(record.department)?.name ?? asRecord(asRecord(record.user)?.department)?.name ?? "-");
  const month = String(payslip.month ?? "-");
  const status = String(payslip.status ?? "GENERATED");
  const issuedOn = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date());
  let content = "";
  content += "0.2 w 42 805 511 0 l S\n";
  content += pdfTextLine(48, 780, 22, "AXIS OPS");
  content += pdfTextLine(48, 758, 10, "Internal Operations Platform");
  content += pdfTextLine(410, 780, 12, "MONTHLY PAY SLIP");
  content += pdfTextLine(410, 760, 10, `Pay Period: ${month}`);
  content += pdfTextLine(410, 744, 10, `Status: ${status}`);
  content += pdfTextLine(48, 710, 16, "Employee Pay Slip");
  [
    ["Employee", employee, "Employee ID", code],
    ["Designation", designation, "Department", department],
    ["Issued On", issuedOn, "Currency", "PKR"],
  ].forEach((row, index) => {
    const y = 680 - index * 38;
    content += `48 ${y - 8} 220 30 re S\n300 ${y - 8} 220 30 re S\n`;
    content += pdfTextLine(58, y + 8, 8, row[0]);
    content += pdfTextLine(58, y - 6, 11, row[1]);
    content += pdfTextLine(310, y + 8, 8, row[2]);
    content += pdfTextLine(310, y - 6, 11, row[3]);
  });
  content += pdfTextLine(48, 550, 13, "Earnings");
  [
    ["Base Salary", numbers.base],
    ["Allowances", numbers.allowances],
    ["Bonuses", numbers.bonuses],
    ["Gross Pay", numbers.gross],
  ].forEach((row, index) => {
    const y = 525 - index * 24;
    content += `48 ${y - 8} 360 22 re S\n408 ${y - 8} 112 22 re S\n`;
    content += pdfTextLine(58, y, 10, row[0]);
    content += pdfTextLine(430, y, 10, currencyValue(row[1]));
  });
  content += pdfTextLine(48, 405, 13, "Deductions");
  content += `48 374 360 22 re S\n408 374 112 22 re S\n`;
  content += pdfTextLine(58, 382, 10, "Tax / Provident fund / Other deductions");
  content += pdfTextLine(430, 382, 10, currencyValue(numbers.deductions));
  content += `48 322 472 42 re S\n`;
  content += pdfTextLine(58, 338, 15, "Net Pay");
  content += pdfTextLine(400, 338, 15, `PKR ${currencyValue(numbers.net)}`);
  content += pdfTextLine(48, 90, 9, "Generated by Axis Ops");
  content += pdfTextLine(390, 90, 9, "Authorized HR / Payroll");
  const stream = content;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = payslipFileName(record, payslip);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return data && typeof data.error === "string" ? data.error : fallback;
}

function displayValue(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (field === "role" && record.role && typeof record.role === "object") return (record.role as { label?: string }).label;
  if (field === "department" && record.department && typeof record.department === "object") return (record.department as { name?: string }).name;
  if (field === "owner" && record.owner && typeof record.owner === "object") return (record.owner as { name?: string }).name;
  if (field === "assignee" && record.assignee && typeof record.assignee === "object") return (record.assignee as { name?: string }).name;
  if (field === "reporter" && record.reporter && typeof record.reporter === "object") return (record.reporter as { name?: string }).name;
  if (field === "project" && record.project && typeof record.project === "object") return (record.project as { name?: string }).name;
  if (field === "head" && record.head && typeof record.head === "object") return (record.head as { name?: string }).name;
  if (field === "user" && record.user && typeof record.user === "object") return (record.user as { name?: string }).name;
  if (field === "uploader" && record.uploader && typeof record.uploader === "object") return (record.uploader as { name?: string }).name;
  if (field === "paidBy" && record.paidBy && typeof record.paidBy === "object") return (record.paidBy as { name?: string }).name;
  if (field === "approvedBy" && record.approvedBy && typeof record.approvedBy === "object") return (record.approvedBy as { name?: string }).name;
  if (field === "assignedPerson" && record.assignedPerson && typeof record.assignedPerson === "object") return (record.assignedPerson as { name?: string }).name;
  if (field === "assignedInterviewer" && record.assignedInterviewer && typeof record.assignedInterviewer === "object") return (record.assignedInterviewer as { name?: string }).name;
  if (field === "organizer" && record.organizer && typeof record.organizer === "object") return (record.organizer as { name?: string }).name;
  if (field === "reportingManager" && record.reportingManager && typeof record.reportingManager === "object") return (record.reportingManager as { name?: string }).name;
  return value;
}

function formatCell(record: Record<string, unknown>, field: string) {
  const value = displayValue(record, field);
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">-</span>;
  if (typeof value === "boolean") return <StatusBadge value={value} />;
  if (field === "stage") return stageCell(value);
  if (field.toLowerCase().includes("status") || field === "priority" || field === "action") return <StatusBadge value={String(value)} />;
  if (field.toLowerCase().includes("cost") || field === "amount" || field === "budget") return formatCurrency(String(value));
  if (field.toLowerCase().includes("date") || field === "scheduledAt" || field === "createdAt") {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(String(value)));
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function initialForm(config: Config) {
  const form: Record<string, unknown> = {};
  for (const field of config.fields) {
    if (field.defaultValue !== undefined) form[field.name] = field.defaultValue;
    else if (field.type === "boolean") form[field.name] = false;
    else if (field.type === "list") form[field.name] = "[]";
    else form[field.name] = "";
  }
  return form;
}

function optionsFor(field: Field, references: References | null) {
  if (field.options) return field.options.map((value) => ({ value, label: titleCase(value) }));
  if (!references) return [];
  if (field.name === "roleId") return references.roles.map((role) => ({ value: role.id, label: role.label }));
  if (["departmentId"].includes(field.name)) return references.departments.map((department) => ({ value: department.id, label: department.name }));
  if (["projectId"].includes(field.name)) return references.projects.map((project) => ({ value: project.id, label: project.name }));
  if (["ownerId", "assigneeId", "assignedPersonId", "assignedInterviewerId", "organizerId", "paidById", "approvedById", "headId", "userId", "reportingManagerId"].includes(field.name)) {
    return references.users.map((user) => ({ value: user.id, label: user.name }));
  }
  return [];
}

export function ModulePage({ moduleKey }: { moduleKey: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [references, setReferences] = useState<References | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Record<string, unknown> | null>(null);
  const [detailsEditing, setDetailsEditing] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<Record<string, unknown> | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [openSelectKey, setOpenSelectKey] = useState<string | null>(null);
  const formDefaults = useMemo(() => (config ? initialForm(config) : {}), [config]);
  const [form, setForm] = useState<Record<string, unknown>>({});

  async function load(search = query) {
    setLoading(true);
    setError("");
    const [moduleResponse, referenceResponse] = await Promise.all([
      fetch(`/api/modules/${moduleKey}?q=${encodeURIComponent(search)}`),
      fetch("/api/references"),
    ]);
    setLoading(false);

    if (!moduleResponse.ok) {
      const data = await moduleResponse.json();
      setError(data.error ?? "Unable to load module.");
      return;
    }

    const data = await moduleResponse.json();
    setConfig(data.config);
    setItems(data.items);
    setCanWrite(data.canWrite);
    if (referenceResponse.ok) setReferences(await referenceResponse.json());
  }

  useEffect(() => {
    void Promise.resolve().then(() => load(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  function openCreate() {
    setEditing(null);
    setForm(formDefaults);
    setModalOpen(true);
  }

  function openEdit(item: Record<string, unknown>) {
    setEditing(item);
    const next = { ...formDefaults };
    config?.fields.forEach((field) => {
      const value =
        config.key === "users" && field.name === "username"
          ? String(item.email ?? "").split("@")[0]
          : config.key === "hr" && field.name === "userId"
            ? String(item.fullName ?? displayValue(item, "user") ?? "")
          : item[field.name];
      if (value === null || value === undefined) return;
      if (field.type === "list") next[field.name] = listText(value);
      else if (field.type === "date") next[field.name] = String(value).slice(0, 10);
      else if (field.type === "datetime") next[field.name] = String(value).slice(0, 16);
      else next[field.name] = Array.isArray(value) ? value.join(", ") : value;
    });
    setForm(next);
    setModalOpen(true);
  }

  function openDetails(item: Record<string, unknown>, startEditing = true) {
    openEdit(item);
    setModalOpen(false);
    setDetailsTarget(item);
    setDetailsEditing(startEditing);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    setError("");
    const normalized = Object.fromEntries(
      config.fields.map((field) => [field.name, field.type === "list" ? parseListText(form[field.name]) : form[field.name]]),
    );
    const payload = editing ? { id: editing.id, ...normalized } : normalized;
    const response = await fetch(`/api/modules/${moduleKey}`, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!response.ok) {
      setError(await readError(response, "Unable to save record."));
      return;
    }

    setModalOpen(false);
    setDetailsEditing(false);
    setDetailsTarget(null);
    await load();
  }

  async function remove(item: Record<string, unknown>) {
    const message =
      config?.key === "users"
        ? "Deactivate this user? They will no longer be able to sign in."
        : "Delete this record?";
    if (!confirm(message)) return;
    const response = await fetch(`/api/modules/${moduleKey}?id=${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readError(response, config?.key === "users" ? "Unable to deactivate user." : "Unable to delete record."));
      return;
    }
    await load();
  }

  async function reactivate(item: Record<string, unknown>) {
    if (!confirm("Reactivate this user? They will be able to sign in again.")) return;
    const response = await fetch(`/api/modules/${moduleKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "reactivate" }),
    });
    if (!response.ok) {
      setError(await readError(response, "Unable to reactivate user."));
      return;
    }
    await load();
  }

  async function permanentlyRemove(item: Record<string, unknown>) {
    if (!confirm("Permanently delete this user account? This cannot be undone.")) return;
    const response = await fetch(`/api/modules/${moduleKey}?id=${item.id}&permanent=true`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readError(response, "Unable to permanently delete user."));
      return;
    }
    await load();
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/modules/${moduleKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: passwordTarget.id, password: temporaryPassword }),
    });
    setSaving(false);

    if (!response.ok) {
      setError(await readError(response, "Unable to reset password."));
      return;
    }

    setPasswordTarget(null);
    setTemporaryPassword("");
  }

  const kanban = moduleKey === "tasks" && items.length > 0;
  const columns = ["BACKLOG", "TO_DO", "IN_PROGRESS", "WAITING", "REVIEW", "DONE"];

  function renderSelectControl(field: Field, value: unknown, selectKey: string, onChange: (value: string) => void) {
    const options = optionsFor(field, references);
    const selected = options.find((option) => option.value === String(value));
    const isOpen = openSelectKey === selectKey;
    return (
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setOpenSelectKey(isOpen ? null : selectKey)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <span className={selected ? "text-slate-950" : "text-slate-400"}>{selected?.label ?? "Select..."}</span>
          <span className="mt-2 block h-1 rounded-full transition-colors" style={{ width: selected?.label ? `${Math.max(selected.label.length, 4)}ch` : "4ch", backgroundColor: value ? optionUnderline(value) : "#e2e8f0" }} />
        </button>
        {isOpen ? (
          <div className="absolute z-[70] mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange("");
                setOpenSelectKey(null);
              }}
              className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
            >
              Select...
              <span className="mt-1 block h-1 rounded-full bg-slate-200" />
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setOpenSelectKey(null);
                }}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm font-medium transition hover:bg-slate-50",
                  String(value) === option.value ? "bg-slate-50 text-slate-950" : "text-slate-700",
                )}
              >
                {option.label}
                <span className="mt-1 block h-1 rounded-full" style={{ width: `${Math.max(option.label.length, 4)}ch`, backgroundColor: optionUnderline(option.value) }} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">Axis module</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{config?.title ?? titleCase(moduleKey)}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{config?.description ?? "Loading module..."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 min-w-72 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") load(query);
              }}
              placeholder="Filter this module"
              className="w-full text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => load(query)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          {moduleKey === "users" && canWrite ? (
            <a
              href="/api/admin/database-export"
              download
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />
              Download Database Export
            </a>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              New {config?.singular ?? "Record"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {kanban ? (
        <section className="grid gap-4 xl:grid-cols-6">
          {columns.map((column) => (
            <div key={column} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <StatusBadge value={column} />
                <span className="text-xs text-slate-400">{items.filter((item) => item.status === column).length}</span>
              </div>
              <div className="space-y-3">
                {items
                  .filter((item) => item.status === column)
                  .map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => canWrite && openEdit(item)}
                      className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-blue-200 hover:bg-blue-50"
                    >
                      <p className="text-sm font-medium">{String(item.title)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge value={String(item.priority)} />
                        {displayValue(item, "assignee") ? <span className="text-xs text-slate-500">{String(displayValue(item, "assignee"))}</span> : null}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {(config?.tableFields ?? []).map((field) => (
                  <th key={field} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {titleCase(field)}
                  </th>
                ))}
                {canWrite || moduleKey === "hr" ? <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={(config?.tableFields.length ?? 1) + (canWrite || moduleKey === "hr" ? 1 : 0)} className="px-4 py-10 text-center text-slate-500">
                    Loading records...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={(config?.tableFields.length ?? 1) + (canWrite || moduleKey === "hr" ? 1 : 0)} className="px-4 py-10 text-center text-slate-500">
                    No records found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={String(item.id)} className="hover:bg-slate-50">
                    {(config?.tableFields ?? []).map((field) => (
                      <td key={field} className="max-w-72 whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatCell(item, field)}
                      </td>
                    ))}
                    {canWrite || moduleKey === "hr" ? (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {moduleKey === "hr" ? (
                          <button
                            type="button"
                            onClick={() => openDetails(item, true)}
                            className="rounded-md px-2 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
                          >
                            View details
                          </button>
                        ) : null}
                        {moduleKey !== "hr" && canWrite ? (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="rounded-md px-2 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                        ) : null}
                        {config?.key === "users" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordTarget(item);
                                setTemporaryPassword("");
                              }}
                              className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-700 hover:bg-blue-50"
                              aria-label="Reset password"
                              title="Reset password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {(item.role as { name?: string } | undefined)?.name !== "SUPER_ADMIN" ? item.status === "INACTIVE" ? (
                              <button
                                type="button"
                                onClick={() => reactivate(item)}
                                className="ml-1 rounded-md px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                                aria-label="Reactivate"
                                title="Reactivate"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => remove(item)}
                                className="ml-1 rounded-md px-2 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50"
                                aria-label="Deactivate"
                                title="Deactivate"
                              >
                                Deactivate
                              </button>
                            ) : item.status === "INACTIVE" ? (
                              <button
                                type="button"
                                onClick={() => reactivate(item)}
                                className="ml-1 rounded-md px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                                aria-label="Reactivate"
                                title="Reactivate"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <span className="ml-1 px-2 py-1 text-sm font-medium text-slate-500">
                                Protected
                              </span>
                            )}
                            {(item.role as { name?: string } | undefined)?.name !== "SUPER_ADMIN" ? (
                              <button
                                type="button"
                                onClick={() => permanentlyRemove(item)}
                                className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                                aria-label="Permanently delete"
                                title="Permanently delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {config?.key !== "users" && canWrite ? (
                          <button
                            type="button"
                            onClick={() => remove(item)}
                            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detailsTarget && config?.key === "hr" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Employee Details</h2>
                <p className="text-sm text-slate-500">
                  {String(detailsTarget.fullName ?? displayValue(detailsTarget, "user") ?? "Employee")} · {String(detailsTarget.employeeCode ?? "-")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => setDetailsEditing((current) => !current)}
                    className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    {detailsEditing ? "View mode" : "Edit details"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setDetailsTarget(null);
                    setDetailsEditing(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <form onSubmit={submit} className="max-h-[calc(92vh-73px)] overflow-y-auto p-5">
              <div className="space-y-5">
                {hrFieldGroups.map((group) => (
                  <section key={group.title} className="rounded-lg border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
                    </div>
                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      {group.fields.map((fieldName) => {
                        const field = fieldDefinition(config, fieldName);
                        const isList = field?.type === "list";
                        const value = form[fieldName] ?? "";
                        const viewValue = hrDisplayValue(detailsTarget, fieldName);
                        return (
                          <label key={fieldName} className={cn("block", isList || field?.type === "textarea" ? "md:col-span-2" : "")}>
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              {field?.label ?? titleCase(fieldName)}
                              {field?.sensitive ? <span className="ml-2 text-amber-600">Restricted</span> : null}
                            </span>
                            {detailsEditing && field ? (
                              isList ? (
                                fieldName === "payslips" ? (
                                  <div className="mt-2 space-y-3">
                                    <div className="rounded-lg border border-blue-100 bg-white p-3">
                                      <p className="text-sm font-semibold text-slate-900">Payslip Generator</p>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">Use existing payslip entries below to print or download a professional monthly payslip.</p>
                                      <div className="mt-3 space-y-2">
                                        {Array.isArray(detailsTarget.payslips) && detailsTarget.payslips.length > 0 ? (
                                          (detailsTarget.payslips as Record<string, unknown>[]).map((payslip, index) => (
                                            <div key={index} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                                              <div>
                                                <p className="text-sm font-medium text-slate-900">{String(payslip.month ?? `Payslip ${index + 1}`)}</p>
                                                <p className="text-xs text-slate-500">
                                                  Net: {formatCurrency(String(payslipNumbers(detailsTarget, payslip).net))} · Status: {String(payslip.status ?? "GENERATED")}
                                                </p>
                                              </div>
                                              <div className="flex flex-wrap gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => printPayslip(detailsTarget, payslip)}
                                                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                >
                                                  <Printer className="h-4 w-4" />
                                                  Print
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => downloadPayslipPdf(detailsTarget, payslip)}
                                                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800"
                                                >
                                                  <Download className="h-4 w-4" />
                                                  Download PDF
                                                </button>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <p className="text-xs text-slate-500">No payslip entries yet. Add one in the JSON editor below.</p>
                                        )}
                                      </div>
                                    </div>
                                    <textarea
                                      value={String(value)}
                                      onChange={(event) => setForm((current) => ({ ...current, [fieldName]: event.target.value }))}
                                      rows={5}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    />
                                  </div>
                                ) : (
                                  <textarea
                                    value={String(value)}
                                    onChange={(event) => setForm((current) => ({ ...current, [fieldName]: event.target.value }))}
                                    rows={5}
                                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  />
                                )
                              ) : field.type === "textarea" ? (
                                <textarea
                                  value={String(value)}
                                  onChange={(event) => setForm((current) => ({ ...current, [fieldName]: event.target.value }))}
                                  rows={3}
                                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                              ) : field.type === "select" ? (
                                renderSelectControl(field, value, `details-${fieldName}`, (nextValue) =>
                                  setForm((current) => ({ ...current, [fieldName]: nextValue })),
                                )
                              ) : (
                                <input
                                  value={String(value)}
                                  onChange={(event) => setForm((current) => ({ ...current, [fieldName]: event.target.value }))}
                                  type={field.type === "money" || field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                  step={field.type === "money" ? "0.01" : undefined}
                                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                              )
                            ) : (
                              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                                {isList && Array.isArray(detailsTarget[fieldName]) ? (
                                  (detailsTarget[fieldName] as Record<string, unknown>[]).length > 0 ? (
                                    <div className="space-y-2">
                                      {(detailsTarget[fieldName] as Record<string, unknown>[]).map((entry, index) => (
                                        <div key={index} className="rounded-md border border-slate-100 p-2">
                                          <p className="text-xs leading-5 text-slate-600">
                                            {Object.entries(entry).map(([key, entryValue]) => `${titleCase(key)}: ${String(entryValue || "-")}`).join(" | ")}
                                          </p>
                                          {fieldName === "payslips" ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                              <button
                                                type="button"
                                                onClick={() => printPayslip(detailsTarget, entry)}
                                                className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                              >
                                                <Printer className="h-3.5 w-3.5" />
                                                Print
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => downloadPayslipPdf(detailsTarget, entry)}
                                                className="inline-flex h-8 items-center gap-2 rounded-md bg-blue-700 px-2 text-xs font-semibold text-white hover:bg-blue-800"
                                              >
                                                <Download className="h-3.5 w-3.5" />
                                                Download PDF
                                              </button>
                                            </div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">No entries</span>
                                  )
                                ) : (
                                  viewValue
                                )}
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              {detailsEditing ? (
                <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailsEditing(false);
                      if (detailsTarget) openDetails(detailsTarget);
                    }}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save details"}
                  </button>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}

      {modalOpen && config ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{editing ? "Edit" : "New"} {config.singular}</h2>
                <p className="text-sm text-slate-500">Role controls apply when this record is saved.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="max-h-[calc(90vh-73px)] overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                {config.fields.map((field) => {
                  const common = {
                    value: String(form[field.name] ?? ""),
                    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value })),
                    required: field.required || (config.key === "users" && field.name === "password" && !editing),
                    placeholder: config.key === "hr" && field.name === "userId" ? "Axis CEO, Axis CTO, HR Manager..." : undefined,
                    className: "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                  };
                  return (
                    <label key={field.name} className={cn("block", field.type === "textarea" || field.type === "list" ? "md:col-span-2" : "")}>
                      <span className="text-sm font-medium text-slate-700">
                        {config.key === "users" && field.name === "username" && editing ? "Email" : field.label}
                        {field.sensitive ? <span className="ml-2 text-xs text-amber-600">Restricted</span> : null}
                      </span>
                      {config.key === "users" && field.name === "username" && editing ? (
                        <input
                          value={String(editing.email ?? "")}
                          type="email"
                          disabled
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                        />
                      ) : config.key === "users" && field.name === "username" ? (
                        <span className="mt-2 flex overflow-hidden rounded-lg border border-slate-200 bg-white text-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                          <input
                            {...common}
                            type="text"
                            className="w-full px-3 py-2 outline-none"
                            autoComplete="off"
                          />
                          <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-slate-500">
                            @axis-internal.com
                          </span>
                        </span>
                      ) : field.type === "textarea" ? (
                        <textarea {...common} rows={4} />
                      ) : field.type === "list" ? (
                        <textarea {...common} rows={5} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                      ) : field.type === "select" ? (
                        renderSelectControl(field, form[field.name], `modal-${field.name}`, (nextValue) =>
                          setForm((current) => ({ ...current, [field.name]: nextValue })),
                        )
                      ) : field.type === "boolean" ? (
                        <span className="mt-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(form[field.name])}
                            onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 text-blue-700"
                          />
                          <span className="text-sm text-slate-600">Enabled</span>
                        </span>
                      ) : (
                        <input
                          {...common}
                          type={field.type === "money" || field.type === "number" ? "number" : field.type === "datetime" ? "datetime-local" : field.type}
                          step={field.type === "money" ? "0.01" : undefined}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {passwordTarget && config?.key === "users" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Reset Password</h2>
                <p className="text-sm text-slate-500">{String(passwordTarget.name)}</p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={resetPassword} className="p-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">New temporary password</span>
                <input
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <p className="mt-3 text-xs leading-5 text-slate-500">Share the temporary password securely and have the user replace it after sign-in.</p>
              <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
