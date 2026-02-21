import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FileText, ShieldCheck, Sparkles } from "lucide-react";
import ApplyModal from "../../components/trustconnect/ApplyModal";
import ToastStack, { useToastStack } from "../../components/ToastStack";
import { getRequirement } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";
import ModeToggleButton from "../../components/trustconnect/ModeToggleButton";

function formatTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function RequirementDetail() {
  const { id } = useParams();
  const toast = useToastStack();
  const { account, listInstitutions } = useTrustProtocol();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [item, setItem] = useState(null);
  const [instMap, setInstMap] = useState(() => new Map());
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      setLoading(true);
      try {
        const [res, inst] = await Promise.all([getRequirement(id), listInstitutions().catch(() => [])]);
        const map = new Map((inst || []).map((x) => [String(x.address || "").toLowerCase(), String(x.name || "")]));
        if (!cancelled) {
          setItem(res.item || null);
          setInstMap(map);
        }
      } catch (e) {
        if (!cancelled) {
          setItem(null);
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
  }, [id]);

  const instName = useMemo(() => {
    const addr = String(item?.institutionId || "").toLowerCase();
    return instMap.get(addr) || "Unknown Institution";
  }, [item?.institutionId, instMap]);

  function openApply() {
    if (!account) {
      toast.push("Please connect your wallet first", "warning");
      return;
    }
    setApplyOpen(true);
  }

  return (
    <div className="relative grid gap-6">
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-purple-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-16 top-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/50 to-slate-950/80 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.7)] backdrop-blur-xl"
      >
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-[90px]" />
        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-purple-500/20 blur-[90px]" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              TrustConnect
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">Requirement Details</div>
            <div className="mt-2 text-sm text-slate-300">Review requirement details and submit a verified application</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/connect/requirements"
              className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.35)]"
            >
              <ArrowLeft className="h-4 w-4 text-cyan-300" />
              Back to list
            </Link>
            <ModeToggleButton />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl"
      >
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </motion.div>
        ) : null}

        {loading ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="h-5 w-2/3 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-white/10" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          </div>
        ) : !item ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <div className="text-sm text-slate-300">Requirement not found</div>
            <div className="mt-2 text-xs text-slate-500">Go back and choose another requirement</div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{item.title || `Requirement #${item.id}`}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <div className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-cyan-300" />
                      Institution: {instName}
                    </div>
                    <div className="font-mono text-slate-400">{item.createdAt ? `Posted ${formatTime(item.createdAt)}` : ""}</div>
                    <div className="font-mono text-slate-400">Applicants: {Number(item.applicationCount || 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-900/50 to-slate-950/80 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <FileText className="h-4 w-4 text-cyan-300" />
                Description
              </div>
              <div className="mt-4 whitespace-pre-wrap text-sm text-slate-200">{item.description || ""}</div>
            </div>
          </div>
        )}
      </motion.div>

      {item ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-100">{item.title || `Requirement #${item.id}`}</div>
              <div className="mt-0.5 text-xs text-slate-400">{instName}</div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              className="shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.45)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.65)] disabled:opacity-60"
              onClick={openApply}
              disabled={!item || String(item.status || "").toUpperCase() !== "OPEN"}
            >
              Submit Application
            </motion.button>
          </div>
        </div>
      ) : null}

      <ApplyModal open={applyOpen} onClose={() => setApplyOpen(false)} requirement={item} />
      <ToastStack toasts={toast.toasts} />
    </div>
  );
}
