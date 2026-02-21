import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchEncryptedFromPinataGateway } from "../services/securityService";

function gatewayUrlForCid(cid) {
  const c = String(cid || "").trim();
  if (!c) return "";
  const pinataGateway = import.meta.env.VITE_PINATA_GATEWAY;
  return pinataGateway ? `https://${pinataGateway}/ipfs/${c}` : `https://gateway.pinata.cloud/ipfs/${c}`;
}

function resolveImageSrc(image) {
  const s = String(image || "").trim();
  if (!s) return "";
  if (s.startsWith("ipfs://")) return gatewayUrlForCid(s.slice("ipfs://".length));
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
  return gatewayUrlForCid(s);
}

function formatAddress(addr) {
  const a = String(addr || "");
  if (!a) return "";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function formatTime(ts) {
  const n = Number(ts || 0);
  if (!n) return "";
  const ms = n > 10_000_000_000 ? n : n * 1000;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} 分 ${s.toString().padStart(2, "0")} 秒`;
}

export default function VerifyPreview() {
  const { cid } = useParams();
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setExpired(false);
      setError("");
      setExpiresAt(0);
      setPayload(null);
      try {
        const shareCid = String(cid || "").trim();
        if (!shareCid) throw new Error("缺少验证 CID");
        const { raw } = await fetchEncryptedFromPinataGateway(shareCid);
        if (!raw || typeof raw !== "object") throw new Error("验证包格式不正确");
        const scheme = String(raw.scheme || "");
        if (scheme !== "secure-verify-v1") throw new Error("不支持的验证包类型");
        const rawExpiresAt = Number(raw.expiresAt || 0);
        if (!rawExpiresAt) throw new Error("验证包缺少 expiresAt");
        if (Date.now() > rawExpiresAt) {
          if (!cancelled) {
            setExpiresAt(rawExpiresAt);
            setExpired(true);
          }
          return;
        }
        if (!cancelled) {
          setExpiresAt(rawExpiresAt);
          setPayload(raw);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [cid]);

  const remainingMs = useMemo(() => (expiresAt ? Math.max(0, expiresAt - Date.now()) : 0), [expiresAt]);
  const remainingLabel = useMemo(() => formatRemaining(remainingMs), [remainingMs]);

  useEffect(() => {
    if (!expiresAt) return;
    if (expired) return;
    const timer = window.setInterval(() => {
      const remain = Math.max(0, expiresAt - Date.now());
      if (remain <= 0) {
        setExpired(true);
        setPayload(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, expired]);

  const imageSrc = useMemo(() => resolveImageSrc(payload?.image), [payload?.image]);
  const issuerName = String(payload?.issuerName || "");
  const issuerAddress = String(payload?.issuerAddress || "");
  const issuedAtLabel = useMemo(() => formatTime(payload?.issuedAt), [payload?.issuedAt]);
  const fields = useMemo(() => {
    const list = Array.isArray(payload?.fields) ? payload.fields : [];
    return list
      .map((x) => ({
        label: String(x?.label || "").trim(),
        value: String(x?.value || "").trim()
      }))
      .filter((x) => x.label && x.value)
      .slice(0, 32);
  }, [payload]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">TrustArchive 安全验证</h1>
              <p className="mt-2 text-sm text-slate-300">持有人已开启隐私保护模式，地址已匿名</p>
            </div>
            {expiresAt && !expired ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-sm text-slate-200">
                此链接将于 {remainingLabel} 后失效
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
              验证链接已过期 (Link Expired)
            </div>
          ) : null}

          {payload && !expired ? (
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">
                <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/20 p-4">
                  {imageSrc ? (
                    <img className="h-10 w-10 rounded-full bg-black object-contain" src={imageSrc} alt="issuer-logo" />
                  ) : (
                    <div className="h-10 w-10 rounded-full border border-slate-700 bg-slate-950/30" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-50">✅ 已通过 TrustArchive 安全验证</div>
                    <div className="mt-1 truncate text-xs text-slate-400">持有人身份：匿名（隐私保护已开启）</div>
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="grid gap-1">
                    <div className="text-xs text-slate-400">机构信息</div>
                    <div className="text-sm text-slate-300">
                      Issuer Name：<span className="text-slate-100">{issuerName || "未知机构"}</span>
                    </div>
                    <div className="text-sm text-slate-300">
                      Issuer Address：<span className="text-slate-100">{issuerAddress ? formatAddress(issuerAddress) : "-"}</span>
                    </div>
                    <div className="text-sm text-slate-300">
                      签发时间：<span className="text-slate-100">{issuedAtLabel || "-"}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/30">
                    <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">公开信息</div>
                    {fields.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">未选择额外公开字段</div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {fields.map((row, idx) => (
                          <div key={`${row.label}-${idx}`} className="grid grid-cols-12 gap-3 px-4 py-3">
                            <div className="col-span-4 text-xs text-slate-400">{row.label}</div>
                            <div className="col-span-8 text-sm text-slate-100">{row.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
