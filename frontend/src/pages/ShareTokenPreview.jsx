import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { accessShareToken } from "../services/trustConnectService";

function gatewayUrl(cid) {
  const c = String(cid || "").trim();
  if (!c) return "";
  const pinataGateway = import.meta.env.VITE_PINATA_GATEWAY;
  if (pinataGateway) return `https://${pinataGateway}/ipfs/${c}`;
  return `https://gateway.pinata.cloud/ipfs/${c}`;
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} 分 ${s.toString().padStart(2, "0")} 秒`;
}

export default function ShareTokenPreview() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [cid, setCid] = useState("");
  const [expireAtIso, setExpireAtIso] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      setExpired(false);
      setCid("");
      setExpireAtIso("");
      try {
        const t = String(token || "").trim();
        if (!t) throw new Error("缺少 token");
        const res = await accessShareToken(t);
        if (cancelled) return;
        setCid(String(res.cid || ""));
        setExpireAtIso(String(res.expireAt || ""));
      } catch (e) {
        if (cancelled) return;
        const msg = String(e?.message || e);
        setError(msg);
        if (msg.includes("失效") || msg.includes("过期")) setExpired(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const url = useMemo(() => gatewayUrl(cid), [cid]);
  const expireAtMs = useMemo(() => (expireAtIso ? new Date(expireAtIso).getTime() : 0), [expireAtIso]);
  const remainingMs = useMemo(() => (expireAtMs ? Math.max(0, expireAtMs - Date.now()) : 0), [expireAtMs]);
  const remainingLabel = useMemo(() => formatRemaining(remainingMs), [remainingMs]);

  useEffect(() => {
    if (!expireAtMs) return;
    if (expired) return;
    const timer = window.setInterval(() => {
      const remain = Math.max(0, expireAtMs - Date.now());
      if (remain <= 0) setExpired(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expireAtMs, expired]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">材料预览</h1>
              <p className="mt-2 text-sm text-slate-300">TrustConnect · 临时分享（免登录）</p>
            </div>
            {expireAtMs && !expired ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-sm text-slate-200">
                链接将于 {remainingLabel} 后失效
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          {loading ? <div className="text-sm text-slate-300">加载中...</div> : null}

          {error ? (
            <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>
          ) : null}

          {expired ? (
            <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-5 text-sm text-amber-200">
              链接已失效 (Link Expired)
            </div>
          ) : null}

          {!loading && !error && !expired && url ? (
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-200">
                <div className="text-xs text-slate-400">网关地址</div>
                <div className="mt-1 break-all">{url}</div>
              </div>
              <iframe title="file" className="h-[78vh] w-full rounded-xl border border-slate-800 bg-black" src={url} />
              <a
                className="rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-sm text-slate-200 underline hover:text-white"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                在新窗口打开/下载
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

