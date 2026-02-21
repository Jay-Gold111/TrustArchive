import { useMemo } from "react";
import { Sparkles, X } from "lucide-react";

function toneForLevel(level) {
  const l = String(level || "C").toUpperCase();
  if (l === "S") return { ring: "border-indigo-900/60", bg: "bg-indigo-950/30", text: "text-indigo-200" };
  if (l === "A") return { ring: "border-emerald-900/60", bg: "bg-emerald-950/30", text: "text-emerald-200" };
  if (l === "B") return { ring: "border-amber-900/60", bg: "bg-amber-950/30", text: "text-amber-200" };
  return { ring: "border-rose-900/60", bg: "bg-rose-950/30", text: "text-rose-200" };
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function ProgressRow({ label, value, max, tone }) {
  const pct = useMemo(() => (max ? clamp((Number(value || 0) / max) * 100, 0, 100) : 0), [value, max]);
  const barCls =
    tone === "good"
      ? "bg-emerald-500/70"
      : tone === "warn"
        ? "bg-amber-500/70"
        : tone === "bad"
          ? "bg-rose-500/70"
          : "bg-slate-500/70";
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
        <div>{label}</div>
        <div className="tabular-nums text-slate-200">
          {Number(value || 0).toFixed(2)} / {max}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-2 ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-11/12 max-h-[90vh] min-h-0 flex flex-col rounded-3xl border border-white/10 bg-[#0B0E14]/80 shadow-[0_20px_80px_rgba(6,182,212,0.15)] backdrop-blur-2xl md:w-2/3 lg:w-1/2">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">Trust Report</div>
              <div className="text-base font-semibold text-slate-50">{title}</div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function TrustBadge({ level, score, updatedAt, onClick }) {
  const t = toneForLevel(level);
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${t.ring} ${t.bg} ${t.text} hover:opacity-90`}
      onClick={onClick}
    >
      <span className="font-semibold">Trust Level {String(level || "C").toUpperCase()}</span>
      <span className="text-slate-300">·</span>
      <span className="tabular-nums text-slate-100">{Number(score || 0).toFixed(1)}</span>
      {updatedAt ? <span className="text-slate-400">· {String(updatedAt).slice(0, 19).replace("T", " ")}</span> : null}
    </button>
  );
}

export function TrustReportModal({ open, onClose, data }) {
  if (!open) return null;
  const level = String(data?.trustLevel || "C").toUpperCase();
  const totalScore = Number(data?.totalScore || 0);
  const sbtCount = Number(data?.sbtCount || 0);
  const breakdown = data?.breakdown || {};
  const risk = Number(breakdown.riskPenalty || 0);
  return (
    <ModalShell title={`Level ${level} · ${totalScore.toFixed(1)}`} onClose={onClose}>
      <div className="grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 shadow-[0_0_20px_rgba(6,182,212,0.08)]">
          Weights: Base 40% · Behavior 30% · Stability 20% · Risk 10%
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
          SBT Holdings: <span className="tabular-nums text-slate-50">{sbtCount}</span>
        </div>
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <ProgressRow label="Base (SBT Holdings)" value={breakdown.base} max={40} tone="good" />
          <ProgressRow label="Behavior (Positive Actions)" value={breakdown.behavior} max={30} tone="good" />
          <ProgressRow label="Stability (Account Longevity)" value={breakdown.stability} max={20} tone="warn" />
          <ProgressRow label="Risk Deductions (Rejections)" value={risk} max={10} tone="bad" />
        </div>
      </div>
    </ModalShell>
  );
}
