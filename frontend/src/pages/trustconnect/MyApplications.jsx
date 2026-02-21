import { useEffect, useMemo, useState } from "react";
import CryptoJS from "crypto-js";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ClipboardCheck, RefreshCw, Shield } from "lucide-react";
import ToastStack, { useToastStack } from "../../components/ToastStack";
import { listMyApplications } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";
import ModeToggleButton from "../../components/trustconnect/ModeToggleButton";

function formatTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function statusBadge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PASSED") return "border-emerald-900/60 bg-emerald-950/30 text-emerald-200";
  if (s === "REJECTED") return "border-rose-900/60 bg-rose-950/30 text-rose-200";
  return "border-amber-900/60 bg-amber-950/30 text-amber-200";
}

function formatRequirementId(id) {
  const hex = CryptoJS.SHA256(String(id)).toString();
  return `REQ-${hex.slice(0, 8)}`;
}

export default function MyApplications() {
  const toast = useToastStack();
  const { account } = useTrustProtocol();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  async function refresh() {
    setError("");
    if (!account) {
      setItems([]);
      setError("Please connect your wallet first");
      return;
    }
    setLoading(true);
    try {
      const res = await listMyApplications({ role: "USER", actorId: account });
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
  }, [account]);

  const baseItems = useMemo(() => (items || []).slice(0, 200), [items]);
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return baseItems;
    return baseItems.filter((a) => {
      const hay = [
        a.requirementTitle,
        a.requirementId,
        a.id,
        a.status,
        a.contact
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

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="relative grid gap-6">
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-purple-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-16 top-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
            <Shield className="h-3.5 w-3.5" />
            TrustConnect
          </div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">
            My Submissions
          </div>
          <div className="mt-2 text-sm text-slate-300">View review results and unlocked contact details</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/connect/requirements"
            className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.35)]"
          >
            <ArrowLeft className="h-4 w-4 text-cyan-300" />
            Back to Trust Center
          </Link>
          <ModeToggleButton />
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
            onClick={refresh}
            disabled={loading}
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
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/50 to-slate-950/80 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.7)] backdrop-blur-xl"
      >
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-[90px]" />
        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-purple-500/20 blur-[90px]" />
        <div className="relative z-10 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-xs text-slate-400">Total Submissions</div>
            <div className="mt-1 text-lg font-semibold text-white">{baseItems.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-xs text-slate-400">Status</div>
            <div className="mt-1 text-sm font-medium text-cyan-200">{account ? "Wallet connected" : "Awaiting connection"}</div>
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
            <ClipboardCheck className="h-4 w-4 text-cyan-300" />
            Submission History
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-56 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              placeholder="Search submissions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="text-xs text-slate-400">{filteredItems.length} results</div>
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
                <div className="mt-4 h-3 w-2/3 animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <div className="text-sm text-slate-300">{baseItems.length === 0 ? "No submissions yet" : "No matching submissions"}</div>
            <div className="mt-2 text-xs text-slate-500">
              {baseItems.length === 0 ? "Return to the Trust Center to choose a requirement" : "Try a different keyword"}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {pageItems.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/50 to-slate-950/80 p-5 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_16px_36px_-24px_rgba(56,189,248,0.6)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{a.requirementTitle || formatRequirementId(a.requirementId)}</div>
                    <div className="mt-1 text-xs text-slate-400 font-mono">
                      Submitted: {formatTime(a.createdAt)} {a.reviewedAt ? `· Reviewed: ${formatTime(a.reviewedAt)}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 font-mono">application_id：{a.id}</div>
                  </div>
                  <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(a.status)}`}>{a.status}</div>
                </div>

                {a.status === "PASSED" ? (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    <div className="text-sm font-semibold">Institution Contact</div>
                    <div className="mt-2 break-all text-sm text-emerald-50">{a.contact || "-"}</div>
                  </div>
                ) : a.status === "REJECTED" ? (
                  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                    Rejected
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Pending Review
                  </div>
                )}
              </motion.div>
            ))}
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
    </div>
  );
}
