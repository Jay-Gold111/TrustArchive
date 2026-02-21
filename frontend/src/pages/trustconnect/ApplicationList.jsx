import { useEffect, useMemo, useState } from "react";
import CryptoJS from "crypto-js";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Shield, UserCheck, Wallet } from "lucide-react";
import ToastStack, { useToastStack } from "../../components/ToastStack";
import ReviewModal from "../../components/trustconnect/ReviewModal";
import { consumeReviewOpenFee, getRequirement, listApplications } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";
import ModeToggleButton from "../../components/trustconnect/ModeToggleButton";
import RechargeModal from "../../components/billing/RechargeModal";

function formatTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatNomadId(addr) {
  if (!addr) return "-";
  const hex = CryptoJS.SHA256(String(addr).trim().toLowerCase()).toString();
  return `TA-${hex.slice(0, 10)}`;
}

function statusBadge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PASSED") return "border-emerald-900/60 bg-emerald-950/30 text-emerald-200";
  if (s === "REJECTED") return "border-rose-900/60 bg-rose-950/30 text-rose-200";
  return "border-amber-900/60 bg-amber-950/30 text-amber-200";
}

export default function ApplicationList() {
  const { id } = useParams();
  const requirementId = Number(id || 0);
  const toast = useToastStack();
  const { account, isInstitution } = useTrustProtocol();
  const [issuerOk, setIssuerOk] = useState(false);
  const [reqItem, setReqItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeApp, setActiveApp] = useState(null);
  const [needRecharge, setNeedRecharge] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

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
    if (!requirementId) {
      setItems([]);
      setError("Invalid requirement_id");
      return;
    }
    setLoading(true);
    try {
      const [reqRes, appRes] = await Promise.all([
        getRequirement(requirementId),
        listApplications(requirementId, { role: "INSTITUTION", actorId: account })
      ]);
      setReqItem(reqRes.item || null);
      setItems(appRes.items || []);
    } catch (e) {
      setItems([]);
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [account, issuerOk, requirementId]);

  const displayed = useMemo(() => (items || []).slice(0, 200), [items]);

  async function openReview(app) {
    if (!account) {
      toast.push("Please connect your wallet first", "warning");
      return;
    }
    if (!issuerOk) {
      toast.push("Current address is not an institution", "warning");
      return;
    }
    try {
      await consumeReviewOpenFee(app?.id, { role: "INSTITUTION", actorId: account });
      setActiveApp(app);
      setReviewOpen(true);
      setNeedRecharge(false);
    } catch (e) {
      const msg = String(e?.message || e);
      const insufficient = Number(e?.statusCode || 0) === 402 || msg.includes("余额不足");
      setNeedRecharge(insufficient);
      toast.push(msg, "error", 3200);
    }
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
              <Shield className="h-3.5 w-3.5" />
              TrustConnect · Applications
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{reqItem?.title || `Requirement #${requirementId}`}</div>
            <div className="mt-2 text-sm text-slate-300">Review applications and view materials</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/connect/manage"
              className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.35)]"
            >
              <ArrowLeft className="h-4 w-4 text-cyan-300" />
              Back to Requirements
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
        <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-xs text-slate-400">Applications</div>
            <div className="mt-1 text-lg font-semibold text-white">{displayed.length}</div>
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
        {needRecharge ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-300" />
              Insufficient balance to review applications.
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.45)]"
              onClick={() => setRechargeOpen(true)}
            >
              Top up
            </motion.button>
          </div>
        ) : null}

        <AnimatePresence>
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
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
        ) : displayed.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <div className="text-sm text-slate-300">No applications</div>
            <div className="mt-2 text-xs text-slate-500">Wait for submissions or refresh</div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {displayed.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/50 to-slate-950/80 p-5 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_16px_36px_-24px_rgba(56,189,248,0.6)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      <UserCheck className="mr-2 inline h-4 w-4 text-cyan-300" />
                      Applicant: <span className="font-mono">{formatNomadId(a.userAddress)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400 font-mono">Submitted: {formatTime(a.createdAt)}</div>
                    <div className="mt-1 text-xs text-slate-500 font-mono">application_id：{a.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(a.status)}`}>{a.status}</div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.45)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.65)] disabled:opacity-60"
                      onClick={() => openReview(a)}
                      disabled={a.status !== "PENDING"}
                    >
                      Review
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        requirement={reqItem}
        application={activeApp}
        onUpdated={() => {
          toast.push("Status updated", "success");
          setReviewOpen(false);
          refresh();
        }}
      />

      <ToastStack toasts={toast.toasts} />
      <RechargeModal open={rechargeOpen} onClose={() => setRechargeOpen(false)} role="INSTITUTION" />
    </div>
  );
}
