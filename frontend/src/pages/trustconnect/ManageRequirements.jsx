import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ClipboardList, PlusCircle, RefreshCw, Shield } from "lucide-react";
import ToastStack, { useToastStack } from "../../components/ToastStack";
import { batchDeleteRequirements, deleteRequirement, listMyRequirements, updateRequirement } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";
import ModeToggleButton from "../../components/trustconnect/ModeToggleButton";
import CreateRequirementModal from "../../components/trustconnect/CreateRequirementModal";
import EditRequirementModal from "../../components/trustconnect/EditRequirementModal";

function formatTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function statusBadge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "CLOSED") return "border-slate-700 bg-slate-900/50 text-slate-300";
  return "border-emerald-900/60 bg-emerald-950/30 text-emerald-200";
}

export default function ManageRequirements() {
  const navigate = useNavigate();
  const toast = useToastStack();
  const { account, isInstitution } = useTrustProtocol();
  const [issuerOk, setIssuerOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeRequirement, setActiveRequirement] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [actionBusy, setActionBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!account) {
        if (!cancelled) setIssuerOk(false);
        return;
      }
      try {
        const ok = await isInstitution(account);
        if (!cancelled) setIssuerOk(Boolean(ok));
      } catch {
        if (!cancelled) setIssuerOk(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [account, isInstitution]);

  async function refresh() {
    setError("");
    if (!account) {
      setItems([]);
      setError("Please connect your wallet first");
      return;
    }
    if (!issuerOk) {
      setItems([]);
      setError("Current address is not an institution");
      return;
    }
    setLoading(true);
    try {
      const res = await listMyRequirements({ role: "INSTITUTION", actorId: account });
      setItems(res.items || []);
    } catch (e) {
      setItems([]);
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [account, issuerOk]);

  const baseItems = useMemo(() => (items || []).slice(0, 200), [items]);
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return baseItems;
    return baseItems.filter((r) => {
      const hay = [
        r.title,
        r.description,
        r.status,
        r.id
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(keyword);
    });
  }, [baseItems, query]);
  const pageSize = 6;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / pageSize)),
    [filteredItems.length]
  );
  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const nums = [];
    for (let i = start; i <= end; i += 1) nums.push(i);
    return nums;
  }, [page, totalPages]);
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);
  const allSelected = useMemo(
    () => pageItems.length > 0 && pageItems.every((r) => selectedIds.has(Number(r.id))),
    [pageItems, selectedIds]
  );
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleOne(id) {
    const rid = Number(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const r of pageItems) next.delete(Number(r.id));
      } else {
        for (const r of pageItems) next.add(Number(r.id));
      }
      return next;
    });
  }

  async function setStatus(requirement, status) {
    if (!account) return;
    const rid = Number(requirement?.id || 0);
    if (!rid) return;
    setActionBusy(true);
    try {
      const res = await updateRequirement(rid, { status }, { role: "INSTITUTION", actorId: account });
      setItems((prev) => prev.map((x) => (Number(x.id) === rid ? { ...x, ...res.item } : x)));
      toast.push("Status updated", "success");
    } catch (e) {
      toast.push(String(e?.message || e), "error", 3200);
    } finally {
      setActionBusy(false);
    }
  }

  function openEdit(r) {
    setActiveRequirement(r);
    setEditOpen(true);
  }

  async function removeOne(r) {
    if (!account) return;
    const rid = Number(r?.id || 0);
    if (!rid) return;
    const ok = window.confirm("Delete this requirement? This will also remove its applications, shares, and ticket records.");
    if (!ok) return;
    setActionBusy(true);
    try {
      await deleteRequirement(rid, { role: "INSTITUTION", actorId: account });
      setItems((prev) => prev.filter((x) => Number(x.id) !== rid));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rid);
        return next;
      });
      toast.push("Deleted", "success");
    } catch (e) {
      toast.push(String(e?.message || e), "error", 3200);
    } finally {
      setActionBusy(false);
    }
  }

  async function removeSelected() {
    if (!account) return;
    const ids = Array.from(selectedIds.values());
    if (ids.length === 0) return;
    const ok = window.confirm(`Delete ${ids.length} requirements? This action cannot be undone.`);
    if (!ok) return;
    setActionBusy(true);
    try {
      await batchDeleteRequirements(ids, { role: "INSTITUTION", actorId: account });
      setItems((prev) => prev.filter((x) => !selectedIds.has(Number(x.id))));
      setSelectedIds(new Set());
      toast.push("Batch delete completed", "success");
    } catch (e) {
      toast.push(String(e?.message || e), "error", 3200);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="relative grid gap-6">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-purple-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[140px]" />

      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
            <Shield className="h-3.5 w-3.5" />
            TrustConnect · Institution
          </div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">
            Institution Requirements
          </div>
          <div className="mt-2 text-sm text-slate-300">Publish and manage requirements, track applications</div>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggleButton />
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.45)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.65)] disabled:opacity-60"
            onClick={() => setCreateOpen(true)}
            disabled={loading || !issuerOk || actionBusy}
            title={!issuerOk ? "Current address is not an institution" : ""}
          >
            <PlusCircle className="h-4 w-4" />
            Publish Requirement
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
            onClick={refresh}
            disabled={loading || actionBusy}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing" : "Refresh"}
          </motion.button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/50 to-slate-950/80 p-6 shadow-[0_22px_60px_-32px_rgba(15,23,42,0.7)] backdrop-blur-xl"
      >
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-[100px]" />
        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-purple-500/20 blur-[90px]" />
        <div className="relative z-10 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-xs text-slate-400">Published</div>
            <div className="mt-1 text-lg font-semibold text-white">{baseItems.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-xs text-slate-400">Selected</div>
            <div className="mt-1 text-lg font-semibold text-white">{selectedCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-xs text-slate-400">Role Status</div>
            <div className="mt-1 text-sm font-medium text-cyan-200">{issuerOk ? "Institution access active" : "Institution access required"}</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ClipboardList className="h-4 w-4 text-cyan-300" />
            Requirements
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-56 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              placeholder="Search requirements"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="text-xs text-slate-400">{filteredItems.length} results</div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition-all hover:border-rose-400/60 hover:bg-rose-500/20 disabled:opacity-60"
              onClick={removeSelected}
              disabled={actionBusy || selectedCount === 0}
            >
              Delete Selected
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {loading ? (
          <div className="mt-6 grid gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`s-${i}`} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="h-4 w-2/5 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-white/10" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <div className="text-sm text-slate-300">{baseItems.length === 0 ? "No requirements" : "No matching requirements"}</div>
            <div className="mt-2 text-xs text-slate-500">
              {baseItems.length === 0 ? "Create your first requirement to start receiving applications" : "Try a different keyword"}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={actionBusy} />
                Select all
                {selectedCount ? <span className="text-xs text-slate-400">({selectedCount} selected)</span> : null}
              </label>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                Bulk actions ready
              </div>
            </div>

            <AnimatePresence>
              {pageItems.map((r) => {
                const rid = Number(r.id);
                return (
                  <motion.div
                    key={rid}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/50 to-slate-950/80 p-5 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_16px_36px_-24px_rgba(56,189,248,0.6)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedIds.has(rid)}
                          onChange={() => toggleOne(rid)}
                          disabled={actionBusy}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{r.title || `Requirement #${rid}`}</div>
                          <div className="mt-1 text-xs text-slate-400 font-mono">
                            {r.createdAt ? `Posted ${formatTime(r.createdAt)}` : ""} · Applicants: {Number(r.applicationCount || 0)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className={`rounded-xl border px-3 py-2 text-xs outline-none ${statusBadge(r.status)} bg-transparent`}
                          value={String(r.status || "OPEN").toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN"}
                          onChange={(e) => setStatus(r, e.target.value)}
                          disabled={actionBusy}
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 disabled:opacity-60"
                          onClick={() => navigate(`/connect/manage/requirements/${rid}`)}
                          disabled={actionBusy}
                        >
                          View applications
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 disabled:opacity-60"
                          onClick={() => openEdit(r)}
                          disabled={actionBusy}
                        >
                          Edit
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 transition-all hover:border-rose-400/60 hover:bg-rose-500/20 disabled:opacity-60"
                          onClick={() => removeOne(r)}
                          disabled={actionBusy}
                        >
                          Delete
                        </motion.button>
                      </div>
                    </div>

                    <div className="mt-3 line-clamp-2 text-sm text-slate-300">{r.description || ""}</div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        {filteredItems.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={`p-${num}`}
                  type="button"
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                    num === page
                      ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                      : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/40 hover:bg-white/10"
                  }`}
                  onClick={() => setPage(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>

      <ToastStack toasts={toast.toasts} />
      <CreateRequirementModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          toast.push("Requirement published", "success");
          setCreateOpen(false);
          refresh();
        }}
      />
      <EditRequirementModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        requirement={activeRequirement}
        onUpdated={(item) => {
          if (!item) return;
          setItems((prev) => prev.map((x) => (Number(x.id) === Number(item.id) ? { ...x, ...item } : x)));
        }}
      />
    </div>
  );
}
