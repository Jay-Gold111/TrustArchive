import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  FileText, 
  MapPin, 
  Loader2, 
  X, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  File, 
  Lock, 
  Search, 
  Plus, 
  Save,
  Link as LinkIcon,
  Trash2,
  FolderOpen,
  ArrowLeft
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTrustProtocol } from "../hooks/useTrustProtocol";
import { decryptWithDerivedKey, deriveFileKey, fetchEncryptedFromPinataGateway } from "../services/securityService";

// --- Utility & Constants ---

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_NOTARY_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function formatAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatHash(hash) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatTime(tsSeconds) {
  if (!tsSeconds) return "";
  const ms = Number(tsSeconds) * 1000;
  return new Date(ms).toLocaleString();
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const val = n / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function toDatetimeLocalValue(tsSeconds) {
  if (!tsSeconds) return "";
  const d = new Date(Number(tsSeconds) * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function isPdfFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return true;
  return String(file?.type || "").toLowerCase().includes("pdf");
}

function defaultArchiveCategoryNames() {
  return ["Original Documents", "Contracts & Agreements", "Financial Assets"];
}

function normalizeArchiveCategoryName(name) {
  const n = String(name || "").trim();
  if (n === "证件原件") return "Original Documents";
  if (n === "合同协议") return "Contracts & Agreements";
  if (n === "财务资产") return "Financial Assets";
  return n;
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

// --- Visual Components (UI Kit) ---

const GlassCard = ({ children, className, ...props }) => (
  <div 
    className={cn(
      "relative overflow-hidden rounded-2xl border border-white/10 bg-[#151921]/60 backdrop-blur-xl shadow-2xl transition-all duration-300",
      "hover:border-white/20 hover:bg-[#151921]/80 hover:shadow-purple-500/10",
      className
    )} 
    {...props}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
    <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />
    <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

const NeonButton = ({ children, variant = "primary", className, disabled, loading, ...props }) => {
  const variants = {
    primary: "bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] border-none",
    ghost: "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/30 backdrop-blur-md",
    danger: "bg-rose-950/30 border border-rose-900/50 text-rose-200 hover:bg-rose-900/50 hover:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.2)]",
    success: "bg-emerald-950/30 border border-emerald-900/50 text-emerald-200 hover:bg-emerald-900/50 hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-300 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none",
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
};

const StatusBadge = ({ type, text, icon: Icon }) => {
  const styles = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]",
    info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]",
    neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-md", styles[type])}>
      {Icon && <Icon className="h-3 w-3" />}
      {text}
    </span>
  );
};

const EmptyListState = ({ message, subMessage }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-12 text-slate-500"
  >
    <div className="relative mb-4 group">
      <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10 opacity-75 duration-1000" />
      <div className="relative rounded-full bg-white/5 p-4 ring-1 ring-white/10 transition-all group-hover:bg-white/10 group-hover:ring-cyan-500/30">
        <FolderOpen className="h-8 w-8 text-slate-600 transition-colors group-hover:text-cyan-400" />
      </div>
    </div>
    <p className="text-sm font-medium text-slate-400">{message}</p>
    {subMessage && <p className="mt-1 text-xs text-slate-600">{subMessage}</p>}
  </motion.div>
);

// --- Main Component ---

export default function NotaryCreate() {
  const navigate = useNavigate();
  const {
    account,
    connectWallet,
    isConnecting,
    ensureLocalhostChain,
    submitEvidence,
    getCurrentLocation,
    fileToBase64,
    parseProviderError,
    chainId,
    unlockMasterSeedSession,
    getMyFiles,
    getUserCategories,
    clearSessionSeed
  } = useTrustProtocol();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [recordTitle, setRecordTitle] = useState("");
  const [reportText, setReportText] = useState("");

  const [locationInfo, setLocationInfo] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileItems, setFileItems] = useState([]);
  const [fileError, setFileError] = useState("");

  const [archivePickOpen, setArchivePickOpen] = useState(false);
  const [archivePickPassword, setArchivePickPassword] = useState("");
  const [archivePickError, setArchivePickError] = useState("");
  const [archivePickWorking, setArchivePickWorking] = useState(false);
  const [archivePickSeedHex, setArchivePickSeedHex] = useState("");
  const [archiveCategories, setArchiveCategories] = useState(() => defaultArchiveCategoryNames());
  const [archiveCategorySyncing, setArchiveCategorySyncing] = useState(false);
  const [archivePickCategoryName, setArchivePickCategoryName] = useState("Original Documents");
  const [archivePickFiles, setArchivePickFiles] = useState([]);
  const [archivePickSelectedId, setArchivePickSelectedId] = useState("");

  async function refreshArchiveCategories() {
    if (!account) {
      setArchiveCategories(defaultArchiveCategoryNames());
      return;
    }
    setArchiveCategorySyncing(true);
    try {
      const list = await getUserCategories();
      const base = list.length ? list : defaultArchiveCategoryNames();
      const mapped = (base || []).map((x) => normalizeArchiveCategoryName(x)).filter(Boolean);
      const uniq = [];
      for (const n of mapped) if (!uniq.includes(n)) uniq.push(n);
      setArchiveCategories(uniq.length ? uniq : defaultArchiveCategoryNames());
      setArchivePickCategoryName((prev) => {
        const current = normalizeArchiveCategoryName(prev);
        if (uniq.includes(current)) return current;
        return uniq[0] || current || "Original Documents";
      });
    } catch {
      setArchiveCategories(defaultArchiveCategoryNames());
    } finally {
      setArchiveCategorySyncing(false);
    }
  }

  const [participantAddress, setParticipantAddress] = useState("");
  const prevParticipantHasValue = useRef(false);

  const [expiryType, setExpiryType] = useState("preset");
  const [expiryValue, setExpiryValue] = useState(0);
  const [customExpiryLocal, setCustomExpiryLocal] = useState("");

  const [submissions, setSubmissions] = useState([]);

  const isEmergencyMode = useMemo(() => participantAddress.trim().length === 0, [participantAddress]);
  const needsTitle = useMemo(() => !isEmergencyMode, [isEmergencyMode]);
  const titleIsValid = useMemo(() => (isEmergencyMode ? true : recordTitle.trim().length > 0), [isEmergencyMode, recordTitle]);

  const canSubmit = useMemo(() => {
    return (
      !!account &&
      (reportText.trim().length > 0 || fileItems.length > 0 || !!locationInfo) &&
      titleIsValid
    );
  }, [account, fileItems.length, locationInfo, reportText, titleIsValid]);

  useEffect(() => {
    const has = participantAddress.trim().length > 0;
    const prevHas = prevParticipantHasValue.current;
    prevParticipantHasValue.current = has;

    if (!has) {
      setExpiryType("preset");
      setExpiryValue(0);
      setCustomExpiryLocal("");
      return;
    }

    if (!prevHas && has) {
      const nowSec = Math.floor(Date.now() / 1000);
      setExpiryType("preset");
      setExpiryValue(nowSec + DEFAULT_NOTARY_EXPIRY_SECONDS);
      setCustomExpiryLocal("");
    }
  }, [participantAddress]);

  async function handleGetLocation() {
    setError("");
    setIsLocating(true);
    try {
      const loc = await getCurrentLocation();
      setLocationInfo(loc);
      const locLine = `📍 ${loc.mapsUrl}`;
      setReportText((prev) => {
        const base = (prev || "").trimEnd();
        if (!base) return locLine;
        if (base.includes(loc.mapsUrl)) return base;
        return `${base}\n${locLine}`;
      });
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setIsLocating(false);
    }
  }

  async function handleFileChange(e) {
    setFileError("");
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      setSelectedFiles([]);
      setFileItems([]);
      return;
    }

    const errors = [];
    const okFiles = [];
    for (const f of files) {
      const type = String(f.type || "");
      const isAllowed =
        type.startsWith("image/") || type.startsWith("video/") || isPdfFile(f);
      if (!isAllowed) {
        errors.push(`${f.name || "Untitled"}: Only images/videos/PDF supported`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${f.name || "Untitled"}: File too large (${formatBytes(f.size)})`);
        continue;
      }
      okFiles.push(f);
    }

    if (errors.length > 0) setFileError(errors.join("\n"));
    setSelectedFiles(okFiles);

    const items = [];
    for (const f of okFiles) {
      try {
        const dataUrl = await fileToBase64(f);
        const fileType = f.type || (isPdfFile(f) ? "application/pdf" : "");
        items.push({ name: f.name, type: fileType, size: f.size, dataUrl });
      } catch (err) {
        errors.push(`${f.name || "Untitled"}: ${err?.message || String(err)}`);
      }
    }

    if (errors.length > 0) setFileError(errors.join("\n"));
    setFileItems(items);
  }

  async function handleSubmit() {
    setError("");
    setFileError("");
    setIsSubmitting(true);
    try {
      await ensureLocalhostChain();
      const nowSec = Math.floor(Date.now() / 1000);
      const finalExpiryTime = isEmergencyMode
        ? 0
        : expiryType === "custom"
          ? expiryValue
          : expiryValue || nowSec + DEFAULT_NOTARY_EXPIRY_SECONDS;

      const result = await submitEvidence({
        title: recordTitle,
        report: reportText,
        location: locationInfo,
        files: fileItems,
        participantAddress,
        expiryTime: finalExpiryTime
      });

      setSubmissions((prev) => [{ txHash: result.txHash, cid: result.cid }, ...prev]);
      setRecordTitle("");
      setReportText("");
      setLocationInfo(null);
      setSelectedFiles([]);
      setFileItems([]);
      setExpiryType("preset");
      setExpiryValue(isEmergencyMode ? 0 : nowSec + DEFAULT_NOTARY_EXPIRY_SECONDS);
      setCustomExpiryLocal("");
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openArchivePick() {
    setArchivePickPassword("");
    setArchivePickError("");
    setArchivePickWorking(false);
    setArchivePickSeedHex("");
    setArchivePickCategoryName("Original Documents");
    setArchivePickFiles([]);
    setArchivePickSelectedId("");
    setArchivePickOpen(true);
    refreshArchiveCategories();
  }

  async function loadArchivePickFiles() {
    setArchivePickError("");
    if (!account) {
      setArchivePickError("Please connect wallet first");
      return;
    }
    const pwd = String(archivePickPassword || "");
    if (!pwd) {
      setArchivePickError("Personal password cannot be empty");
      return;
    }
    setArchivePickWorking(true);
    try {
      const seedHex = await unlockMasterSeedSession({ personalPassword: pwd });
      setArchivePickSeedHex(seedHex);
      const rows = await getMyFiles();
      const out = [];
      for (const r of rows) {
        const name = decryptArchiveField({ seedHex, encText: r.nameEnc });
        const categoryName = decryptArchiveField({ seedHex, encText: r.categoryEnc });
        out.push({
          id: String(r.id),
          cid: String(r.cid || ""),
          name: String(name || "Untitled"),
          categoryName: normalizeArchiveCategoryName(categoryName),
          mime: String(r.mime || ""),
          size: Number(r.size || 0)
        });
      }
      setArchivePickFiles(out);
    } catch (e) {
      setArchivePickError(parseProviderError(e));
    } finally {
      setArchivePickWorking(false);
    }
  }

  const archivePickVisibleFiles = useMemo(() => {
    const cat = normalizeArchiveCategoryName(archivePickCategoryName);
    return (archivePickFiles || []).filter((f) => normalizeArchiveCategoryName(f.categoryName) === cat);
  }, [archivePickCategoryName, archivePickFiles]);

  async function confirmArchivePick() {
    setArchivePickError("");
    if (!account) {
      setArchivePickError("Please connect wallet first");
      return;
    }
    const seedHex = String(archivePickSeedHex || "");
    if (!seedHex) {
      setArchivePickError("Please unlock and load archive list first");
      return;
    }
    const selected = archivePickVisibleFiles.find((x) => x.id === archivePickSelectedId) || null;
    if (!selected) {
      setArchivePickError("Please select an archive first");
      return;
    }
    setArchivePickWorking(true);
    try {
      const payload = await decryptArchivePayloadByCid({ seedHex, cid: selected.cid });
      const name = String(payload.name || selected.name || "archive");
      const type = String(payload.type || selected.mime || "");
      const size = Number(payload.size || selected.size || 0);
      const dataUrl = String(payload.dataUrl);
      const file = dataUrlToFile(dataUrl, name, type);

      setSelectedFiles((prev) => [file, ...prev]);
      setFileItems((prev) => [{ name, type: type || file.type, size: size || file.size, dataUrl }, ...prev]);
      setArchivePickOpen(false);
      setArchivePickPassword("");
      setArchivePickSeedHex("");
      setArchivePickFiles([]);
      setArchivePickSelectedId("");
      try {
        clearSessionSeed(account);
      } catch {
      }
    } catch (e) {
      setArchivePickError(parseProviderError(e));
    } finally {
      setArchivePickWorking(false);
    }
  }

  // --- Render (Visual Layer) ---

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-200 selection:bg-cyan-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto w-full max-w-5xl space-y-8 px-6 pb-6 pt-3 lg:px-12 lg:pb-12 lg:pt-6"
      >
        {/* Header */}
        <div className="mb-2">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h1 className="bg-gradient-to-r from-purple-400 via-cyan-400 to-emerald-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">
                Create Evidence
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Cloud Notary · Permanent On-Chain Evidence · Privacy Encrypted Storage
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NeonButton variant="ghost" onClick={() => navigate("/notary")}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </NeonButton>
              <div className="text-right hidden sm:block">
                <div className="text-xs text-slate-500 font-mono">Chain ID</div>
                <div className="text-sm text-cyan-400 font-mono">{chainId || "---"}</div>
              </div>
              <NeonButton variant="ghost" onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                {account ? formatAddress(account) : "Connect Wallet"}
              </NeonButton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-7xl mx-auto">
          {/* Left Column: Main Content */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence>
              {submissions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -20, height: 0 }}
                  className="mb-6"
                >
                  <GlassCard className="border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-400">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h3 className="font-bold text-emerald-400">Evidence Created Successfully</h3>
                        <p className="text-sm text-emerald-200/70">
                          Your evidence has been permanently stored on IPFS and recorded on the blockchain.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4">
                          <a 
                            href={`https://etherscan.io/tx/${submissions[0].txHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                          >
                            <LinkIcon className="h-3 w-3" />
                            View Transaction
                          </a>
                          <div className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400">
                            <FileText className="h-3 w-3" />
                            CID: {formatHash(submissions[0].cid)}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSubmissions([])}
                        className="text-emerald-400/50 hover:text-emerald-400 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            <GlassCard className="p-6 space-y-8">
              {/* Title Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Evidence Title
                  {needsTitle ? <span className="text-rose-400 text-xs">*Required</span> : <span className="text-slate-500 text-xs">(Optional)</span>}
                </label>
                <div className="relative group">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-4 text-base text-slate-200 placeholder-slate-600 outline-none transition-all focus:border-cyan-500/50 focus:bg-black/40 focus:ring-1 focus:ring-cyan-500/50"
                    value={recordTitle}
                    onChange={(e) => setRecordTitle(e.target.value)}
                    placeholder={isEmergencyMode ? "Leave blank to auto-generate: Untitled Emergency Evidence" : "e.g., House Rental Contract / Loan Agreement"}
                    disabled={isSubmitting}
                  />
                  <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300 group-focus-within:w-full" />
                </div>
                {needsTitle && !titleIsValid && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-xs text-rose-400">
                    Please enter a title for identification
                  </motion.div>
                )}
              </div>

              {/* Description Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <FileText className="h-4 w-4 text-purple-400" />
                    Description
                  </label>
                  <button
                    onClick={handleGetLocation}
                    disabled={isLocating || isSubmitting}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                  >
                    {isLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                    {isLocating ? "Locating..." : "Get Location"}
                  </button>
                </div>
                <div className="relative group">
                  <textarea
                    className="min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all focus:border-purple-500/50 focus:bg-black/40 focus:ring-1 focus:ring-purple-500/50"
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Describe key information such as content, time, location, etc..."
                    disabled={isSubmitting}
                  />
                  <div className="absolute bottom-1.5 right-0 h-0.5 w-0 bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300 group-focus-within:w-full" />
                </div>
                {locationInfo && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 w-fit">
                    <CheckCircle2 className="h-3 w-3" />
                    Located: {locationInfo.lat}, {locationInfo.lng}
                  </motion.div>
                )}
              </div>

              {/* File Upload Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Upload className="h-4 w-4 text-cyan-400" />
                  Upload Attachments <span className="text-slate-500 text-xs">(Supports Image/Video/PDF)</span>
                </label>
                
                <div className="grid gap-4">
                  <motion.div 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="relative group overflow-hidden rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] transition-all hover:border-cyan-500/50 hover:bg-cyan-500/5"
                  >
                    <input
                      className="absolute inset-0 cursor-pointer opacity-0 z-10"
                      type="file"
                      accept="image/*,video/*,.pdf"
                      multiple
                      onChange={handleFileChange}
                      disabled={isSubmitting}
                    />
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative rounded-full bg-white/5 p-4 group-hover:bg-cyan-500/10 transition-colors">
                          <Upload className="h-6 w-6 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-300 group-hover:text-cyan-300 transition-colors">Click or drag to upload files</p>
                      <p className="mt-1 text-xs text-slate-500">Max 25MB per file</p>
                    </div>
                  </motion.div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={openArchivePick}
                      disabled={!account || isSubmitting}
                      className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Import from Archive...
                    </button>
                  </div>

                  <AnimatePresence>
                    {selectedFiles.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                        {selectedFiles.map((f, idx) => (
                          <motion.div
                            key={`${f.name}-${idx}`}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 10, opacity: 0 }}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="rounded bg-white/5 p-2">
                                <File className="h-4 w-4 text-slate-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm text-slate-200">{f.name}</div>
                                <div className="text-xs text-slate-500">{formatBytes(f.size)}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const nextSelected = selectedFiles.filter((x) => x !== f);
                                setSelectedFiles(nextSelected);
                                setFileItems((prev) => prev.filter((x) => x.name !== f.name || x.size !== f.size));
                              }}
                              className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </motion.div>
                        ))}
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => {
                              setSelectedFiles([]);
                              setFileItems([]);
                              setFileError("");
                            }}
                            className="text-xs text-rose-400 hover:underline"
                          >
                            Clear All
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {fileError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/20">
                      {fileError}
                    </motion.div>
                  )}
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Right Column: Settings & Action */}
          <div className="lg:col-span-4 space-y-6 sticky top-24">
            <GlassCard className="p-6 space-y-6">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Notary Settings
              </h3>
              
              {/* Participant */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  Participant Address
                  <span className="text-slate-500 text-xs">(Optional)</span>
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all focus:border-emerald-500/50 focus:bg-black/40 focus:ring-1 focus:ring-emerald-500/50 font-mono"
                  value={participantAddress}
                  onChange={(e) => setParticipantAddress(e.target.value)}
                  placeholder="Leave blank for single evidence; enter address for dual signature"
                  disabled={isSubmitting}
                />
              </div>

              {/* Expiry */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Validity Period
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "1 Hour", value: 60 * 60 },
                    { label: "24 Hours", value: 24 * 60 * 60 },
                    { label: "7 Days", value: 7 * 24 * 60 * 60 },
                    { label: "Permanent", value: 0 }
                  ].map((opt) => {
                    const finalActive =
                      isEmergencyMode
                        ? opt.value === 0
                        : opt.value === 0
                          ? expiryType === "preset" && expiryValue === 0
                          : expiryType === "preset" &&
                            expiryValue > 0 &&
                            expiryValue - Math.floor(Date.now() / 1000) <= opt.value + 5 &&
                            expiryValue - Math.floor(Date.now() / 1000) >= opt.value - 5;

                    return (
                      <button
                        key={opt.label}
                        type="button"
                        className={cn(
                          "rounded-xl border px-4 py-2 text-xs font-medium transition-all",
                          finalActive
                            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                            : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
                          isEmergencyMode && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (isEmergencyMode) return;
                          setExpiryType("preset");
                          setCustomExpiryLocal("");
                          if (opt.value === 0) {
                            setExpiryValue(0);
                            return;
                          }
                          const nowSec = Math.floor(Date.now() / 1000);
                          setExpiryValue(nowSec + opt.value);
                        }}
                        disabled={isSubmitting || isEmergencyMode}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl border px-4 py-2 text-xs font-medium transition-all",
                      !isEmergencyMode && expiryType === "custom"
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                        : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
                      isEmergencyMode && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => {
                      if (isEmergencyMode) return;
                      setExpiryType("custom");
                      if (!customExpiryLocal) setCustomExpiryLocal(toDatetimeLocalValue(expiryValue));
                    }}
                    disabled={isSubmitting || isEmergencyMode}
                  >
                    Custom
                  </button>
                </div>
                
                {!isEmergencyMode && expiryType === "custom" && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                      type="datetime-local"
                      value={customExpiryLocal}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomExpiryLocal(v);
                        const ms = new Date(v).getTime();
                        if (!Number.isFinite(ms) || ms <= 0) {
                          setExpiryValue(0);
                          return;
                        }
                        setExpiryValue(Math.floor(ms / 1000));
                      }}
                      disabled={isSubmitting}
                    />
                  </motion.div>
                )}
                
                <div className="text-xs text-slate-500">
                  {isEmergencyMode ? (
                    <span className="text-emerald-400/80">Emergency evidence is permanent by default</span>
                  ) : (
                    <span>
                      {expiryValue === 0 ? "Permanent validity" : `Deadline: ${formatTime(expiryValue)}`}
                    </span>
                  )}
                </div>
              </div>
            </GlassCard>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                {error}
              </motion.div>
            )}

            <NeonButton 
              className="w-full py-4 text-base shadow-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-500/30 transition-all" 
              onClick={handleSubmit} 
              disabled={!canSubmit || isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting
                ? "Encrypting & Uploading..."
                : isEmergencyMode
                  ? "Create Evidence Now"
                  : "Initiate Notary Agreement"}
            </NeonButton>
          </div>
        </div>

        {/* Archive Picker Modal */}
        <AnimatePresence>
          {archivePickOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setArchivePickOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#151921]/90 backdrop-blur-xl shadow-2xl"
              >
                <div className="border-b border-white/10 bg-white/5 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-purple-400" />
                    Select from Archive
                  </h2>
                  <button 
                    onClick={() => setArchivePickOpen(false)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400">Select Category</label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                          value={archivePickCategoryName}
                          onChange={(e) => setArchivePickCategoryName(e.target.value)}
                          disabled={archivePickWorking}
                        >
                          {archiveCategories.map((n) => (
                            <option key={n} value={n} className="bg-slate-900">{n}</option>
                          ))}
                        </select>
                        <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-500" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400">Personal Password (for decryption)</label>
                      <div className="flex gap-2">
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                          value={archivePickPassword}
                          onChange={(e) => setArchivePickPassword(e.target.value)}
                          placeholder="Enter password"
                          type="password"
                          disabled={archivePickWorking}
                          onKeyDown={(e) => e.key === "Enter" && loadArchivePickFiles()}
                        />
                        <NeonButton 
                          variant="ghost" 
                          onClick={loadArchivePickFiles} 
                          disabled={archivePickWorking || !archivePickPassword}
                          className="shrink-0"
                        >
                          {archivePickWorking ? <Loader2 className="animate-spin h-4 w-4" /> : "Unlock"}
                        </NeonButton>
                      </div>
                    </div>
                  </div>

                  {archivePickError && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {archivePickError}
                    </motion.div>
                  )}

                  <div className="rounded-xl border border-white/5 bg-black/20 overflow-hidden">
                    <div className="bg-white/5 px-4 py-2 text-xs font-medium text-slate-400 border-b border-white/5 flex justify-between items-center">
                      <span>File List</span>
                      {archivePickFiles.length > 0 && <span className="text-xs text-slate-600">{archivePickFiles.length} items</span>}
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1 scrollbar-thin">
                      {archivePickVisibleFiles.length === 0 ? (
                         <EmptyListState 
                           message={archivePickSeedHex ? "No files in this category" : "Please unlock to load files"} 
                           subMessage={archivePickSeedHex ? "Switch category or upload new files" : "Enter password to unlock your private archive"}
                         />
                      ) : (
                        <AnimatePresence>
                          {archivePickVisibleFiles.map((f, i) => (
                            <motion.button
                              key={f.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => setArchivePickSelectedId(f.id)}
                              className={cn(
                                "w-full flex items-center justify-between p-3 rounded-lg text-left transition-all group relative overflow-hidden",
                                archivePickSelectedId === f.id
                                  ? "bg-purple-500/20 border border-purple-500/30 text-white"
                                  : "hover:bg-white/5 text-slate-300 border border-transparent"
                              )}
                            >
                              {archivePickSelectedId === f.id && (
                                <motion.div layoutId="activeArchiveItem" className="absolute inset-0 bg-purple-500/10" />
                              )}
                              <div className="min-w-0 flex items-center gap-3 relative z-10">
                                <div className={cn("p-2 rounded bg-white/5 transition-colors", archivePickSelectedId === f.id ? "text-purple-300" : "text-slate-500 group-hover:text-slate-400")}>
                                  <File className="h-4 w-4" />
                                </div>
                                <div className="truncate text-sm font-medium">{f.name}</div>
                              </div>
                              <div className="text-xs opacity-50 font-mono ml-4 relative z-10">{formatBytes(f.size)}</div>
                            </motion.button>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <NeonButton variant="ghost" onClick={() => setArchivePickOpen(false)} disabled={archivePickWorking}>
                      Cancel
                    </NeonButton>
                    <NeonButton 
                      onClick={confirmArchivePick} 
                      disabled={archivePickWorking || !archivePickSelectedId}
                      loading={archivePickWorking}
                    >
                      Confirm Import
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
