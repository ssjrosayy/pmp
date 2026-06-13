import { cn, titleCase } from "@/lib/utils";

const tones: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DONE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  BLOCKED: "bg-red-50 text-red-700 ring-red-200",
  CRITICAL: "bg-red-50 text-red-700 ring-red-200",
  OVERDUE: "bg-red-50 text-red-700 ring-red-200",
  REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
  WAITING: "bg-amber-50 text-amber-700 ring-amber-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-200",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-200",
  APPLIED: "bg-slate-100 text-slate-700 ring-slate-200",
  SHORTLISTED: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  INTERVIEW_SCHEDULED: "bg-violet-50 text-violet-700 ring-violet-200",
  INTERVIEWED: "bg-blue-50 text-blue-700 ring-blue-200",
  SELECTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  OFFER_SENT: "bg-amber-50 text-amber-700 ring-amber-200",
  HIRED: "bg-teal-50 text-teal-700 ring-teal-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ value }: { value: string | boolean | null | undefined }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">-</span>;
  const key = String(value).toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        tones[key] ?? "bg-slate-100 text-slate-700 ring-slate-200",
      )}
    >
      {typeof value === "boolean" ? (value ? "Yes" : "No") : titleCase(String(value))}
    </span>
  );
}
