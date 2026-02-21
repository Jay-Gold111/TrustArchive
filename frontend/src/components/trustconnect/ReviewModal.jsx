import { useEffect, useMemo, useState } from "react";
import ModalShell from "../ModalShell";
import ToastStack, { useToastStack } from "../ToastStack";
import { getApplicationTrustScore, getShareMeta, reviewApplication, verifySbtTicket, viewShare } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";

function formatTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function safeScope(scope) {
  if (!scope || typeof scope !== "object") return {};
  const { issuerName, issuerAddress, issuedAt, sbtTitle, contract } = scope;
  return {
    sbtTitle: sbtTitle != null ? String(sbtTitle) : "",
    issuerName: issuerName != null ? String(issuerName) : "",
    issuerAddress: issuerAddress != null ? String(issuerAddress) : "",
    issuedAt: issuedAt != null ? String(issuedAt) : "",
    contract: contract != null ? String(contract) : ""
  };
}

function statusBadge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PASSED") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (s === "REJECTED") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export default function ReviewModal({ open, onClose, requirement, application, onUpdated }) {
  const { account } = useTrustProtocol();
  const toast = useToastStack();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareLinkExpireAt, setShareLinkExpireAt] = useState("");
  const [verifyAll, setVerifyAll] = useState([]);
  const [trustInfo, setTrustInfo] = useState(null);
  const [trustLoading, setTrustLoading] = useState(false);
  const [contact, setContact] = useState("");

  const appId = Number(application?.id || 0);
  const shareId = String(application?.normalFileShareId || "");
  const tickets = Array.isArray(application?.sbtVerifyTickets) && application.sbtVerifyTickets.length
    ? application.sbtVerifyTickets.map((x) => String(x)).filter(Boolean)
    : [String(application?.sbtVerifyTicket || "")].filter(Boolean);

  const roleHeaders = useMemo(() => ({ role: "INSTITUTION", actorId: account }), [account]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setWorking(false);
    setShareLink("");
    setShareLinkExpireAt("");
    setVerifyAll([]);
    setTrustInfo(null);
    setContact("");
    if (!shareId) return;
    setMetaLoading(true);
    getShareMeta(shareId)
      .then((r) => setMeta(r))
      .catch((e) => {
        setMeta(null);
        setError(String(e?.message || e));
      })
      .finally(() => setMetaLoading(false));
  }, [open, shareId]);

  useEffect(() => {
    if (!open) return;
    if (!appId) return;
    if (!account) return;
    let cancelled = false;
    setTrustLoading(true);
    getApplicationTrustScore(appId, roleHeaders)
      .then((r) => {
        if (cancelled) return;
        setTrustInfo({
          subjectId: String(r.subjectId || ""),
          trustScore: Number(r.trustScore || 0),
          trustLevel: String(r.trustLevel || "")
        });
      })
      .catch(() => {
        if (cancelled) return;
        setTrustInfo(null);
      })
      .finally(() => {
        if (!cancelled) setTrustLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, appId, account]);

  async function copyTicket() {
    if (!tickets.length) return;
    try {
      await navigator.clipboard.writeText(tickets.join("\n"));
      toast.push("All tickets copied", "success");
    } catch {
      toast.push("Copy failed", "error");
    }
  }

  async function doViewShare() {
    setError("");
    if (!shareId) {
      setError("Missing share_id");
      return;
    }
    setWorking(true);
    try {
      const r = await viewShare(shareId);
      const token = String(r.accessToken || "").trim();
      if (!token) throw new Error("Failed to obtain temporary share link");
      const url = `${window.location.origin}/share/tc/${encodeURIComponent(token)}`;
      setShareLink(url);
      setShareLinkExpireAt(String(r.accessExpireAt || ""));
      try {
        await navigator.clipboard.writeText(url);
        toast.push("Temporary share link generated (5 min), copied", "success");
      } catch {
        toast.push("Temporary share link generated (5 min)", "success");
      }
      const m = await getShareMeta(shareId).catch(() => null);
      if (m) setMeta(m);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setWorking(false);
    }
  }

  async function doVerifyAll() {
    setError("");
    if (!tickets.length) {
      setError("Missing sbt_verify_ticket");
      return;
    }
    setWorking(true);
    const out = [];
    for (const tk of tickets) {
      try {
        const r = await verifySbtTicket({ ticket: tk }, roleHeaders);
        out.push({ ticket: tk, ok: true, data: r });
      } catch (e) {
        out.push({ ticket: tk, ok: false, error: String(e?.message || e) });
      }
    }
    setVerifyAll(out);
    const okCount = out.filter((x) => x.ok).length;
    toast.push(`Verified ${okCount}/${out.length} SBTs`, okCount === out.length ? "success" : "warning", 3200);
    setWorking(false);
  }

  async function doReview(status) {
    setError("");
    if (!appId) {
      setError("Missing application_id");
      return;
    }
    setWorking(true);
    try {
      const r = await reviewApplication({ application_id: appId, status }, roleHeaders);
      if (status === "PASSED") setContact(String(r.contact || ""));
      toast.push(status === "PASSED" ? "Approved" : "Rejected", "success");
      onUpdated?.(status, r);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setWorking(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <ModalShell
        title={`Review · #${application?.id || "-"} · ${String(application?.status || "PENDING")}`}
        onClose={() => {
          if (working) return;
          onClose?.();
        }}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-100 transition-all hover:border-rose-400/60 hover:bg-rose-400/20 disabled:opacity-60"
              onClick={() => doReview("REJECTED")}
              disabled={working}
            >
              Reject
            </button>
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(16,185,129,0.45)] transition-all hover:shadow-[0_0_28px_rgba(34,211,238,0.6)] disabled:opacity-60"
              onClick={() => doReview("PASSED")}
              disabled={working}
            >
              Approve
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">{requirement?.title || "Requirement"}</div>
              <div className={`rounded-full border px-3 py-1 text-xs ${statusBadge(application?.status)}`}>
                {String(application?.status || "PENDING")}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">Submitted: {formatTime(application?.createdAt)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <div className="text-slate-400">Applicant:</div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                {trustInfo?.subjectId ? (
                  trustInfo.subjectId
                ) : trustLoading ? (
                  <span className="inline-block h-4 w-24 rounded bg-white/10 align-middle animate-pulse" />
                ) : (
                  "-"
                )}
              </div>
              <div className="text-slate-400">Trust Score：</div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200 tabular-nums">
                {trustLoading ? (
                  <span className="inline-block h-4 w-28 rounded bg-white/10 align-middle animate-pulse" />
                ) : trustInfo ? (
                  `${trustInfo.trustScore} (${trustInfo.trustLevel || "-"})`
                ) : (
                  "-"
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">Standard materials (restricted)</div>
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
                onClick={doViewShare}
                disabled={working || !shareId}
              >
                {working ? "Processing..." : "Generate share link (consumes 1 view)"}
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-400">share_id：{shareId || "-"}</div>
            <div className="mt-2">
              {metaLoading ? (
                <div className="grid gap-2">
                  <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-56 rounded bg-white/10 animate-pulse" />
                </div>
              ) : meta ? (
                <div className="grid gap-1 text-xs text-slate-300">
                  <div>
                    Remaining views: <span className="tabular-nums text-slate-50">{meta.remainingViews}</span> / {meta.maxViews}
                  </div>
                  <div>Expires: {formatTime(meta.expireAt)}</div>
                  <div>Status: {meta.expired || meta.burned ? "Burned" : "Active"}</div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">Share info unavailable</div>
              )}
            </div>
            {shareLink ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">Temporary share link (valid for 5 minutes)</div>
                  <a
                    className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(59,130,246,0.45)]"
                    href={shareLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                </div>
                <div className="mt-2 break-all font-mono">{shareLink}</div>
                {shareLinkExpireAt ? <div className="mt-2 text-xs text-slate-500">Expires at: {formatTime(shareLinkExpireAt)}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">API Verification Core (SBT Ticket)</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
                  onClick={copyTicket}
                  disabled={tickets.length === 0}
                >
                  Copy all tickets
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(59,130,246,0.45)] disabled:opacity-60"
                  onClick={doVerifyAll}
                  disabled={working || tickets.length === 0}
                >
                  ⚡ Quick web verify
                </button>
              </div>
            </div>
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
              <div className="text-xs text-slate-400">tickets</div>
              <div className="mt-1 text-xs text-slate-300">Total {tickets.length} tickets (click “Quick web verify” to verify each and list results)</div>
            </div>

            {Array.isArray(verifyAll) && verifyAll.length ? (
              <div className="mt-3 grid gap-2">
                <div className="text-xs text-slate-400">Verification results (each consumes 1 verify)</div>
                {verifyAll.map((x, idx) => {
                  if (!x.ok) {
                    return (
                      <div key={`${x.ticket}-${idx}`} className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                        <div className="text-xs text-rose-200/80">Ticket #{idx + 1}</div>
                        <div className="mt-1 break-all text-xs text-rose-100/80">{x.ticket}</div>
                        <div className="mt-2">{x.error || "Verification failed"}</div>
                      </div>
                    );
                  }
                  const d = x.data || {};
                  const scope = safeScope(d.scopeJson);
                  return (
                    <div key={`${x.ticket}-${idx}`} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                      <div className="text-xs text-emerald-100/80">Ticket #{idx + 1}</div>
                      <div className="mt-1 grid gap-1 text-xs text-emerald-50/90">
                        <div>SBT: {scope.sbtTitle || `Token #${d.sbtTokenId}`}</div>
                        <div>Issuer: {scope.issuerName || "-"}</div>
                        <div>Issued: {scope.issuedAt ? formatTime(new Date(Number(scope.issuedAt)).toISOString()) : "-"}</div>
                        <div>Contract type: {scope.contract || "-"}</div>
                        <div>
                          used {d.usedTimes}/{d.maxVerifyTimes}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {contact ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <div className="text-sm font-semibold text-emerald-100">Institution Contact (unlocked after approval)</div>
              <div className="mt-2 break-all font-mono text-sm text-emerald-50">{contact}</div>
            </div>
          ) : null}

          {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
        </div>
      </ModalShell>
      <ToastStack toasts={toast.toasts} />
    </>
  );
}
