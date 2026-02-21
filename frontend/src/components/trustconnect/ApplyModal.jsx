import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ModalShell from "../ModalShell";
import ToastStack, { useToastStack } from "../ToastStack";
import { applyToRequirement, consumeUploadFee, refundUploadFee } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";
import RechargeModal from "../billing/RechargeModal";
import { Lock } from "lucide-react";
import { decryptWithDerivedKey, deriveFileKey, fetchEncryptedFromPinataGateway } from "../../services/securityService";

function formatTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return null;
  }
}

function decryptArchiveField({ seedHex, encText }) {
  const env = parseMaybeJson(encText);
  const fileId = typeof env?.fileId === "string" ? env.fileId : "";
  const ivHex = typeof env?.ivHex === "string" ? env.ivHex : "";
  const ciphertext = typeof env?.ciphertext === "string" ? env.ciphertext : "";
  if (!fileId || !ivHex || !ciphertext) return "";
  const key = deriveFileKey({ masterSeedHex: String(seedHex || ""), fileId });
  return decryptWithDerivedKey({ ciphertext, ivHex, key });
}

async function decryptArchivePayloadByCid({ seedHex, cid }) {
  const { raw, cipherText } = await fetchEncryptedFromPinataGateway(cid);
  if (!raw || typeof raw !== "object" || typeof raw.fileId !== "string" || typeof raw.ivHex !== "string") {
    if (!cipherText) throw new Error("Archive format incorrect");
    throw new Error("Archive format incorrect");
  }
  const key = deriveFileKey({ masterSeedHex: String(seedHex || ""), fileId: raw.fileId });
  const plain = decryptWithDerivedKey({ ciphertext: String(raw.ciphertext || ""), ivHex: raw.ivHex, key });
  const parsed = parseMaybeJson(plain);
  if (!parsed || typeof parsed !== "object" || !parsed.dataUrl) throw new Error("Decryption result format incorrect");
  return parsed;
}

function dataUrlToFile(dataUrl, name, type) {
  const s = String(dataUrl || "");
  const match = s.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    const blob = new Blob([s], { type: type || "application/octet-stream" });
    return new File([blob], name || "file", { type: type || "application/octet-stream" });
  }
  const mime = type || match[1] || "application/octet-stream";
  const b64 = match[2] || "";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  return new File([blob], name || "file", { type: mime });
}

function normalizeSbtOption(t, kind) {
  return {
    key: `${kind}:${t.tokenId}`,
    kind,
    tokenId: String(t.tokenId),
    issuerName: String(t.issuerName || ""),
    issuerAddress: String(t.issuer || t.issuerAddress || ""),
    title: String(t.title || ""),
    issuedAt: Date.now()
  };
}

function newActionId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export default function ApplyModal({ open, onClose, requirement }) {
  const {
    account,
    uploadFileToIpfs,
    getMyFiles,
    getMyTokens,
    getMyBatchTokens,
    parseProviderError,
    unlockMasterSeedSession,
    clearSessionSeed
  } = useTrustProtocol();
  const toast = useToastStack();

  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [needRecharge, setNeedRecharge] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const [fileMode, setFileMode] = useState("upload");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCid, setUploadCid] = useState("");
  const [archiveFiles, setArchiveFiles] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSelectedCid, setArchiveSelectedCid] = useState("");
  const [archivePassword, setArchivePassword] = useState("");
  const [archiveSeedHex, setArchiveSeedHex] = useState("");
  const [archivePickError, setArchivePickError] = useState("");
  const [archiveGeneratedCid, setArchiveGeneratedCid] = useState("");

  const [tokens, setTokens] = useState([]);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [selectedTokenKeys, setSelectedTokenKeys] = useState(() => new Set());

  const [expireAtIso, setExpireAtIso] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [maxViews, setMaxViews] = useState(3);
  const [ticketExpireIso, setTicketExpireIso] = useState(() => new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16));
  const [maxVerifyTimes, setMaxVerifyTimes] = useState(2);

  useEffect(() => {
    if (!open) return;
    setWorking(false);
    setError("");
    setSuccess(null);
    setNeedRecharge(false);
    setRechargeOpen(false);
    setUploadFile(null);
    setUploadCid("");
    setArchiveSelectedCid("");
    setArchiveGeneratedCid("");
    setArchivePassword("");
    setArchiveSeedHex("");
    setArchivePickError("");
    setSelectedTokenKeys(new Set());
  }, [open]);

  async function loadArchiveFiles() {
    setArchivePickError("");
    if (!account) {
      setArchivePickError("Please connect your wallet first");
      return;
    }
    const pwd = String(archivePassword || "");
    if (!pwd) {
      setArchivePickError("Personal password cannot be empty");
      return;
    }
    setArchiveLoading(true);
    try {
      const seedHex = await unlockMasterSeedSession({ personalPassword: pwd });
      setArchiveSeedHex(seedHex);
      const files = await getMyFiles();
      const out = [];
      for (const r of files || []) {
        const name = decryptArchiveField({ seedHex, encText: r.nameEnc });
        out.push({
          id: String(r.id),
          cid: String(r.cid || "").trim(),
          name: String(name || "Untitled"),
          mime: String(r.mime || ""),
          size: Number(r.size || 0),
          createdAt: Number(r.createdAt || 0)
        });
      }
      setArchiveFiles(out.filter((x) => x.cid));
    } catch (e) {
      setArchiveSeedHex("");
      setArchivePickError(parseProviderError(e));
      setArchiveFiles([]);
    } finally {
      setArchiveLoading(false);
    }
  }

  async function loadTokens() {
    setTokenLoading(true);
    try {
      const [legacy, batch] = await Promise.all([getMyTokens(), getMyBatchTokens()]);
      const merged = [];
      for (const t of batch || []) merged.push(normalizeSbtOption(t, "issuer_batch"));
      for (const t of legacy || []) merged.push(normalizeSbtOption(t, "credential_center"));
      setTokens(merged);
    } catch (e) {
      toast.push(parseProviderError(e), "error");
      setTokens([]);
    } finally {
      setTokenLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadTokens();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (fileMode === "archive") loadArchiveFiles();
  }, [open, fileMode]);
  

  const selectedTokens = useMemo(
    () => tokens.filter((t) => selectedTokenKeys.has(t.key)),
    [tokens, selectedTokenKeys]
  );

  const chosenCid = useMemo(() => {
    if (fileMode === "upload") return uploadCid;
    return archiveGeneratedCid;
  }, [fileMode, uploadCid, archiveGeneratedCid]);

  async function doUpload() {
    if (!uploadFile) {
      toast.push("Please select a file", "warning");
      return;
    }
    if (!account) {
      toast.push("Please connect your wallet first", "warning");
      return;
    }
    if (!requirement?.id) {
      toast.push("Missing requirement", "error");
      return;
    }
    setWorking(true);
    const actionId = newActionId();
    try {
      await consumeUploadFee(requirement.id, actionId, { role: "USER", actorId: account });
      const cid = await uploadFileToIpfs(uploadFile);
      setUploadCid(String(cid || ""));
      toast.push("File uploaded to IPFS", "success");
    } catch (e) {
      const msg = parseProviderError(e);
      if (Number(e?.statusCode || 0) === 402 || String(msg).includes("余额不足")) {
        setNeedRecharge(true);
      }
      try {
        await refundUploadFee(actionId, { role: "USER", actorId: account });
        toast.push("Upload failed, fee refunded", "warning", 3200);
      } catch {
      }
      toast.push(msg, "error");
    } finally {
      setWorking(false);
    }
  }

  async function doGenerateCidFromArchive() {
    if (!archiveSelectedCid) {
      toast.push("Please select an archive file", "warning");
      return;
    }
    if (!account) {
      toast.push("Please connect your wallet first", "warning");
      return;
    }
    if (!requirement?.id) {
      toast.push("Missing requirement", "error");
      return;
    }
    if (!archiveSeedHex) {
      toast.push("Please unlock your archive first", "warning");
      return;
    }
    setWorking(true);
    const actionId = newActionId();
    try {
      await consumeUploadFee(requirement.id, actionId, { role: "USER", actorId: account });
      const payload = await decryptArchivePayloadByCid({ seedHex: archiveSeedHex, cid: archiveSelectedCid });
      const file = dataUrlToFile(payload.dataUrl, String(payload.name || "archive-file"), String(payload.type || ""));
      const cid = await uploadFileToIpfs(file);
      setArchiveGeneratedCid(String(cid || ""));
      toast.push("CID generated from archive", "success");
    } catch (e) {
      const msg = parseProviderError(e);
      if (Number(e?.statusCode || 0) === 402 || String(msg).includes("余额不足")) {
        setNeedRecharge(true);
      }
      try {
        await refundUploadFee(actionId, { role: "USER", actorId: account });
        toast.push("Generation failed, fee refunded", "warning", 3200);
      } catch {
      }
      toast.push(msg, "error");
      setArchiveGeneratedCid("");
    } finally {
      setWorking(false);
    }
  }

  async function submit() {
    setError("");
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }
    if (!requirement?.id) {
      setError("Missing requirement");
      return;
    }
    if (!chosenCid) {
      setError("Prepare standard materials (CID) first");
      return;
    }
    if (selectedTokens.length === 0) {
      setError("Select at least one SBT for verification");
      return;
    }

    const expireAt = new Date(expireAtIso);
    const ticketExpireAt = new Date(ticketExpireIso);
    if (Number.isNaN(expireAt.getTime()) || Number.isNaN(ticketExpireAt.getTime())) {
      setError("Invalid expiration time format");
      return;
    }

    const payload = {
      requirement_id: Number(requirement.id),
      cid: String(chosenCid),
      expire_at: expireAt.toISOString(),
      max_views: Number(maxViews || 1),
      ticket_expire_at: ticketExpireAt.toISOString(),
      max_verify_times: Number(maxVerifyTimes || 1),
      sbt_tokens: selectedTokens.map((t) => ({
        sbt_token_id: String(t.tokenId),
        scope_json: {
          sbtTitle: t.title,
          issuerName: t.issuerName,
          issuerAddress: t.issuerAddress,
          issuedAt: t.issuedAt,
          contract: t.kind
        }
      }))
    };

    setWorking(true);
    try {
      const res = await applyToRequirement(payload, { role: "USER", actorId: account });
      setSuccess({
        applicationId: Number(res.applicationId || 0),
        shareId: String(res.shareId || ""),
        ticketCount: Array.isArray(res.tickets) ? res.tickets.length : selectedTokens.length
      });
      toast.push("Submission successful", "success", 3500);
    } catch (e) {
      const msg = String(e?.message || e);
      setError(msg);
      setNeedRecharge(Number(e?.statusCode || 0) === 402 || msg.includes("余额不足"));
    } finally {
      setWorking(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <ModalShell
        title={requirement?.title ? `Submit: ${requirement.title}` : "Submit Application"}
        onClose={() => {
          if (working) return;
          onClose?.();
        }}
        footer={
          <div className="flex items-center justify-between gap-2">
            {success ? (
              <div className="text-xs text-emerald-200">Submitted · application_id {success.applicationId || "-"}</div>
            ) : (
              <div className="text-xs text-slate-400">A restricted share link and verification tickets will be generated after submission (with expiry and view limits)</div>
            )}
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.45)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.65)] disabled:opacity-60"
              onClick={submit}
              disabled={working || Boolean(success)}
            >
              {success ? "Submitted" : working ? "Packaging..." : "Package & Submit"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          {success ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="text-sm font-semibold">Submission successful</div>
              <div className="mt-2 grid gap-1 text-xs text-emerald-50/90">
                <div>application_id：{success.applicationId || "-"}</div>
                <div>share_id：{success.shareId || "-"}</div>
                <div>SBT tickets: {success.ticketCount || 0}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  to="/connect/my"
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.45)]"
                  onClick={onClose}
                >
                  Go to My Submissions
                </Link>
                <button
                  type="button"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 transition-all hover:border-emerald-400/60 hover:bg-emerald-400/20"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-slate-100">Standard Materials</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-xl border px-3 py-1.5 text-xs ${
                  fileMode === "upload"
                    ? "border-cyan-400/40 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setFileMode("upload")}
                disabled={working || Boolean(success)}
              >
                Upload from device
              </button>
              <button
                type="button"
                className={`rounded-xl border px-3 py-1.5 text-xs ${
                  fileMode === "archive"
                    ? "border-cyan-400/40 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setFileMode("archive")}
                disabled={working || Boolean(success)}
              >
                Choose from Archive
              </button>
            </div>

            {fileMode === "upload" ? (
              <div className="grid gap-2">
                <input
                  type="file"
                  className="block w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  disabled={working || Boolean(success)}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
                    onClick={doUpload}
                    disabled={working || Boolean(success) || !uploadFile}
                  >
                    {working ? "Uploading..." : "Upload & generate CID"}
                  </button>
                  <div className="min-w-0 flex-1 text-xs text-slate-400">
                    {uploadCid ? <span className="break-all font-mono text-slate-200">CID: {uploadCid}</span> : "CID will appear after upload"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">Select from on-chain archive (using file record CID)</div>
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
                    onClick={loadArchiveFiles}
                    disabled={working || Boolean(success) || archiveLoading}
                  >
                    {archiveLoading ? "Loading..." : "Refresh list"}
                  </button>
                </div>
                <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Lock className="h-3.5 w-3.5 text-cyan-300" />
                    Unlock your private archive to browse files
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                      placeholder="Enter personal password"
                      value={archivePassword}
                      onChange={(e) => setArchivePassword(e.target.value)}
                      disabled={working || Boolean(success) || archiveLoading}
                    />
                    <button
                      type="button"
                      className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.45)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.65)] disabled:opacity-60"
                      onClick={loadArchiveFiles}
                      disabled={working || Boolean(success) || archiveLoading || !archivePassword}
                    >
                      {archiveLoading ? "Unlocking..." : "Unlock & Load"}
                    </button>
                    {archiveSeedHex ? (
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
                        onClick={() => {
                          try {
                            clearSessionSeed?.(account);
                          } catch {
                          }
                          setArchiveSeedHex("");
                          setArchivePassword("");
                          setArchiveFiles([]);
                          setArchiveSelectedCid("");
                        }}
                        disabled={working || Boolean(success) || archiveLoading}
                      >
                        Lock
                      </button>
                    ) : null}
                  </div>
                  {archivePickError ? (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                      {archivePickError}
                    </div>
                  ) : null}
                </div>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                  value={archiveSelectedCid}
                  onChange={(e) => {
                    setArchiveSelectedCid(e.target.value);
                    setArchiveGeneratedCid("");
                  }}
                  disabled={working || Boolean(success) || archiveLoading}
                >
                  <option value="">Select an archive file</option>
                  {archiveFiles.map((f) => (
                    <option key={f.id} value={String(f.cid || "")}>
                      {f.name ? `${f.name} · ` : ""}#{f.id} · {f.size || 0} bytes ·{" "}
                      {f.createdAt ? new Date(Number(f.createdAt) * 1000).toLocaleDateString() : ""}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
                    onClick={doGenerateCidFromArchive}
                    disabled={working || Boolean(success) || archiveLoading || !archiveSelectedCid || !archiveSeedHex}
                  >
                    {working ? "Generating..." : "Upload & generate CID"}
                  </button>
                  <div className="min-w-0 flex-1 text-xs text-slate-400">
                    {archiveGeneratedCid ? (
                      <span className="break-all font-mono text-slate-200">CID: {archiveGeneratedCid}</span>
                    ) : (
                      "CID will appear after selection"
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">Verification Materials (SBT)</div>
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
                onClick={loadTokens}
                disabled={working || Boolean(success) || tokenLoading}
              >
                {tokenLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
            <div className="text-xs text-slate-400">Required public fields: issuer name, issue time</div>

            {tokenLoading ? (
              <div className="grid gap-2">
                <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-sm text-slate-400">No available SBTs</div>
            ) : (
              <div className="grid gap-2">
                {tokens.slice(0, 12).map((t) => (
                  <label key={t.key} className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:border-cyan-400/40 hover:bg-white/10">
                    <input
                      type="checkbox"
                      className="mt-1 accent-cyan-400"
                      checked={selectedTokenKeys.has(t.key)}
                      onChange={() => {
                        setSelectedTokenKeys((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.key)) next.delete(t.key);
                          else next.add(t.key);
                          return next;
                        });
                      }}
                      disabled={working || Boolean(success)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">
                        {t.title || `Token #${t.tokenId}`} <span className="text-xs text-slate-400">({t.kind})</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Issuer: {t.issuerName || "-"} · Issued: {formatTime(new Date(t.issuedAt).toISOString())}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-500">{t.issuerAddress || ""}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-xs text-slate-400">Standard material expiry</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                value={expireAtIso}
                onChange={(e) => setExpireAtIso(e.target.value)}
                disabled={working || Boolean(success)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs text-slate-400">Max views</label>
              <input
                type="number"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                value={maxViews}
                onChange={(e) => setMaxViews(Number(e.target.value || 0))}
                min={1}
                max={50}
                disabled={working || Boolean(success)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs text-slate-400">SBT ticket expiry</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                value={ticketExpireIso}
                onChange={(e) => setTicketExpireIso(e.target.value)}
                disabled={working || Boolean(success)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs text-slate-400">Max verification times</label>
              <input
                type="number"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
                value={maxVerifyTimes}
                onChange={(e) => setMaxVerifyTimes(Number(e.target.value || 0))}
                min={1}
                max={20}
                disabled={working || Boolean(success)}
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              <div>{error}</div>
              {needRecharge ? (
                <button
                  type="button"
                  className="mt-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.45)]"
                  onClick={() => setRechargeOpen(true)}
                >
                  Top up
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </ModalShell>
      <ToastStack toasts={toast.toasts} />
      <RechargeModal open={rechargeOpen} onClose={() => setRechargeOpen(false)} role="USER" />
    </>
  );
}
