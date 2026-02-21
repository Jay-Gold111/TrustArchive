import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, RefreshCw, Sparkles, UserCheck } from "lucide-react";
import ToastStack, { useToastStack } from "../../components/ToastStack";
import { listRequirements } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";
import ModeToggleButton from "../../components/trustconnect/ModeToggleButton";

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

export default function RequirementList() {
  const toast = useToastStack();
  const { listInstitutions } = useTrustProtocol();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [instMap, setInstMap] = useState(() => new Map());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      setLoading(true);
      try {
        const [reqs, inst] = await Promise.all([listRequirements(), listInstitutions().catch(() => [])]);
        const map = new Map((inst || []).map((x) => [String(x.address || "").toLowerCase(), String(x.name || "")]));
        if (!cancelled) {
          setItems(reqs.items || []);
          setInstMap(map);
        }
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(String(e?.message || e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const baseItems = useMemo(() => (items || []).slice(0, 100), [items]);
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return baseItems;
    return baseItems.filter((r) => {
      const instName = instMap.get(String(r.institutionId || "").toLowerCase()) || "";
      const hay = [
        r.title,
        r.description,
        r.status,
        r.id,
        instName
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(keyword);
    });
  }, [baseItems, query, instMap]);
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
            <Sparkles className="h-3.5 w-3.5" />
            TrustConnect
          </div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">
            Trust Center
          </div>
          <div className="mt-2 text-sm text-slate-300">User-authorized bilateral verification submissions and reviews</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/connect/my"
            className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.35)]"
          >
            <UserCheck className="h-4 w-4 text-cyan-300" />
            My Submissions
          </Link>
          <ModeToggleButton />
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
            <div className="text-xs text-slate-400">Open Requirements</div>
            <div className="mt-1 text-lg font-semibold text-white">{baseItems.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-xs text-slate-400">Institutions</div>
            <div className="mt-1 text-lg font-semibold text-white">{instMap.size}</div>
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
            <Layers className="h-4 w-4 text-cyan-300" />
            Open Requirements
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                className="w-56 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                placeholder="Search requirements"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-400">{filteredItems.length} results</div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Syncing" : "Refresh"}
            </motion.button>
          </div>
        </div>

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </motion.div>
        ) : null}

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`s-${i}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="h-4 w-3/5 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-3 w-2/5 animate-pulse rounded bg-white/10" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-white/5" />
                </div>
                <div className="mt-4 h-3 w-1/3 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <div className="text-sm text-slate-300">{baseItems.length === 0 ? "No open requirements" : "No matching requirements"}</div>
            <div className="mt-2 text-xs text-slate-500">
              {baseItems.length === 0
                ? "Check back later or wait for institutions to publish new verification requirements"
                : "Try a different keyword"}
            </div>
          </div>
        ) : (
          <motion.div
            className="mt-6 grid gap-4 md:grid-cols-2"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          >
            {pageItems.map((r) => {
              const instName = instMap.get(String(r.institutionId || "").toLowerCase()) || "Unknown Institution";
              return (
                <motion.div
                  key={r.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.3 }}
                >
                  <Link
                    to={`/connect/requirements/${r.id}`}
                    className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/50 to-slate-950/80 p-5 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_18px_40px_-24px_rgba(56,189,248,0.6)]"
                  >
                    <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="absolute -right-10 top-0 h-24 w-24 rounded-full bg-cyan-500/15 blur-[60px]" />
                      <div className="absolute -left-12 bottom-0 h-24 w-24 rounded-full bg-purple-500/15 blur-[60px]" />
                    </div>
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{r.title || `Requirement #${r.id}`}</div>
                        <div className="mt-1 text-xs text-slate-400">{instName}</div>
                      </div>
                      <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(r.status)}`}>{r.status}</div>
                    </div>
                    <div className="relative z-10 mt-3 line-clamp-3 text-sm text-slate-300">{r.description || ""}</div>
                    <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="font-mono">Applicants: {Number(r.applicationCount || 0)}</div>
                      <div className="font-mono">{r.createdAt ? `Posted ${formatTime(r.createdAt)}` : ""}</div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
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
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${num === page
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
