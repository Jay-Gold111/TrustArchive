import CryptoJS from "crypto-js";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { decryptWithDerivedKey, fetchEncryptedFromPinataGateway } from "../services/securityService";

function isPdfLike({ name, type }) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".pdf")) return true;
  return String(type || "").toLowerCase().includes("pdf");
}

function isImageLike({ name, type }) {
  const t = String(type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  const n = String(name || "").toLowerCase();
  return n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp") || n.endsWith(".gif");
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} 分 ${s.toString().padStart(2, "0")} 秒`;
}

export default function SharePreview() {
  const { cid } = useParams();
  const [searchParams] = useSearchParams();
  const tempKey = searchParams.get("key") || "";

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
      setPayload(null);
      setExpiresAt(0);
      try {
        const shareCid = String(cid || "").trim();
        if (!shareCid) throw new Error("缺少分享 CID");
        if (!tempKey) throw new Error("缺少临时解密参数 key");

        const { raw } = await fetchEncryptedFromPinataGateway(shareCid);
        if (!raw || typeof raw !== "object") throw new Error("分享包格式不正确");
        let rawExpiresAt = Number(raw.expiresAt || 0);
        if (!rawExpiresAt) {
          const ttlSec = Number(raw.ttlSec || 0);
          if (!ttlSec) throw new Error("分享包缺少必要字段");
          const storageKey = `ta_share_opened_at:${shareCid}`;
          let openedAt = 0;
          try {
            openedAt = Number(window.localStorage.getItem(storageKey) || 0);
          } catch {
            openedAt = 0;
          }
          if (!Number.isFinite(openedAt) || openedAt <= 0) {
            openedAt = Date.now();
            try {
              window.localStorage.setItem(storageKey, String(openedAt));
            } catch {
            }
          }
          rawExpiresAt = openedAt + ttlSec * 1000;
        }
        const ivHex = typeof raw.ivHex === "string" ? raw.ivHex : "";
        const ciphertext = typeof raw.ciphertext === "string" ? raw.ciphertext : "";
        if (!rawExpiresAt || !ivHex || !ciphertext) throw new Error("分享包缺少必要字段");

        if (Date.now() > rawExpiresAt) {
          if (!cancelled) {
            setExpiresAt(rawExpiresAt);
            setExpired(true);
          }
          return;
        }

        const key = CryptoJS.SHA256(`TA_SHARE_V1|${tempKey}`);
        const plain = decryptWithDerivedKey({ ciphertext, ivHex, key });
        const parsed = JSON.parse(plain);
        if (!parsed || typeof parsed !== "object") throw new Error("解密结果格式不正确");
        if (!parsed.dataUrl) throw new Error("解密结果缺少 dataUrl");

        if (!cancelled) {
          setExpiresAt(rawExpiresAt);
          setPayload(parsed);
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
  }, [cid, tempKey]);

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

  const title = payload?.title || "预览模式";
  const [blobUrl, setBlobUrl] = useState("");

  useEffect(() => {
    setBlobUrl("");
    if (!payload?.dataUrl) return;
    if (!isPdfLike({ name: payload.name, type: payload.type })) return;
    const s = String(payload.dataUrl || "");
    const match = s.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) return;
    try {
      const mime = match[1] || "application/pdf";
      const b64 = match[2] || "";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setBlobUrl("");
    }
  }, [payload?.dataUrl, payload?.name, payload?.type]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-slate-300">TrustArchive · 预览模式（免登录）</p>
            </div>
            {expiresAt && !expired ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-sm text-slate-200">
                此敏感文件将于 {remainingLabel} 后停止访问
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          {loading ? <div className="text-sm text-slate-300">加载并解密中...</div> : null}

          {error ? (
            <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>
          ) : null}

          {expired ? (
            <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-5 text-sm text-amber-200">
              链接已失效 (Link Expired)
            </div>
          ) : null}

          {payload && !expired ? (
            <div className="grid gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-100">
                <div className="text-xs text-slate-400">文件信息</div>
                <div className="mt-2 text-xs text-slate-300">
                  文件：<span className="text-slate-100">{payload.name || "未命名"}</span>
                  {payload.type ? <span className="ml-2 text-slate-500">{payload.type}</span> : null}
                </div>
              </div>

              {payload.dataUrl ? (
                isPdfLike({ name: payload.name, type: payload.type }) ? (
                  <iframe
                    title={payload.name || "pdf"}
                    className="h-[78vh] w-full rounded-xl border border-slate-800 bg-black"
                    src={blobUrl || payload.dataUrl}
                  />
                ) : isImageLike({ name: payload.name, type: payload.type }) ? (
                  <img
                    className="w-full max-h-[78vh] rounded-xl border border-slate-800 object-contain bg-black"
                    alt={payload.name || "preview"}
                    src={payload.dataUrl}
                  />
                ) : (
                  <a
                    className="rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-sm text-slate-200 underline hover:text-white"
                    href={payload.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开/下载附件
                  </a>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
