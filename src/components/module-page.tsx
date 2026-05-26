"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, KeyRound, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
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
  return value;
}

function formatCell(record: Record<string, unknown>, field: string) {
  const value = displayValue(record, field);
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">-</span>;
  if (typeof value === "boolean") return <StatusBadge value={value} />;
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
  if (["ownerId", "assigneeId", "assignedPersonId", "assignedInterviewerId", "organizerId", "paidById", "approvedById", "headId", "userId"].includes(field.name)) {
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
  const [passwordTarget, setPasswordTarget] = useState<Record<string, unknown> | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
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
          : item[field.name];
      if (value === null || value === undefined) return;
      if (field.type === "date") next[field.name] = String(value).slice(0, 10);
      else if (field.type === "datetime") next[field.name] = String(value).slice(0, 16);
      else next[field.name] = Array.isArray(value) ? value.join(", ") : value;
    });
    setForm(next);
    setModalOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    setError("");
    const payload = editing ? { id: editing.id, ...form } : form;
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
                {canWrite ? <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={(config?.tableFields.length ?? 1) + 1} className="px-4 py-10 text-center text-slate-500">
                    Loading records...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={(config?.tableFields.length ?? 1) + 1} className="px-4 py-10 text-center text-slate-500">
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
                    {canWrite ? (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-md px-2 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
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
                        {config?.key !== "users" ? (
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
                    className: "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                  };
                  return (
                    <label key={field.name} className={cn("block", field.type === "textarea" ? "md:col-span-2" : "")}>
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
                      ) : field.type === "select" ? (
                        <select {...common}>
                          <option value="">Select...</option>
                          {optionsFor(field, references).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
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
