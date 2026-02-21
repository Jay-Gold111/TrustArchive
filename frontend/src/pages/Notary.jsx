import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  RefreshCw,
  Plus,
  FileText,
  ShieldCheck,
  Clock,
  Lock,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileBox,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  File,
  MapPin,
  Calendar
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTrustProtocol } from "../hooks/useTrustProtocol";
import { decryptWithDerivedKey, deriveFileKey, fetchEncryptedFromPinataGateway } from "../services/securityService";

// --- Utility & Constants ---

const PAGE_SIZE = 10;

/**
 * Merge Tailwind class names
 * @param inputs Class name array
 */
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

async function decryptNotaryPayloadWithSeed({ cid, seedHex }) {
  const { raw, cipherText } = await fetchEncryptedFromPinataGateway(cid);
  if (!raw || typeof raw !== "object" || typeof raw.fileId !== "string" || typeof raw.ivHex !== "string") {
    if (!cipherText) throw new Error("Incorrect evidence format");
    throw new Error("Incorrect evidence format");
  }
  const key = deriveFileKey({ masterSeedHex: seedHex, fileId: raw.fileId });
  const plain = decryptWithDerivedKey({ ciphertext: String(raw.ciphertext || ""), ivHex: raw.ivHex, key });
  const parsed = JSON.parse(plain);
  if (!parsed || typeof parsed !== "object") throw new Error("Decryption result format incorrect");
  return parsed;
}

// --- Visual Components (UI Kit) ---

/**
 * Glassmorphism Card Container
 * Style: Dark Tech - Dark semi-transparent background + Blur + Border Highlight
 */
const GlassCard = ({ children, className, ...props }) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-2xl border border-white/10 bg-[#151921]/60 backdrop-blur-xl shadow-2xl transition-all duration-300",
      "hover:border-white/20 hover:bg-[#151921]/80 hover:shadow-purple-500/10",
      className
    )}
    {...props}
  >
    {/* Top Flow Light Decoration */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
    {/* Bottom Ambient Light */}
    <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />
    <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

    <div className="relative z-10">{children}</div>
  </div>
);

/**
 * Neon Button
 * Supports primary (gradient), ghost (transparent), danger (red), success (green)
 */
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

/**
 * Status Badge
 * Uses subtle background and border, high readability
 */
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

/**
 * Loading Skeleton
 * Simulates list item loading with shimmer animation
 */
const LoadingSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.05] to-transparent p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3 w-full">
            <div className="h-6 w-1/3 rounded bg-white/10 animate-pulse" />
            <div className="flex gap-3">
              <div className="h-5 w-20 rounded-full bg-white/5 animate-pulse" />
              <div className="h-5 w-24 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="flex gap-4">
              <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-40 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// --- Sub-Components (Extracted for better structure) ---

/**
 * Search and Filter Toolbar
 */
const SearchToolbar = ({ search, setSearch, filter, setFilter }) => (
  <div className="flex flex-col gap-4 border-b border-white/5 pb-6 lg:flex-row lg:items-center lg:justify-between">
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all focus:border-purple-500/50 focus:bg-black/40 focus:ring-1 focus:ring-purple-500/50"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search title, hash or address..."
      />
      {search && (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
          onClick={() => setSearch("")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>

    <div className="flex gap-2  pb-2 lg:pb-0 scrollbar-hide">
      {[
        { key: "all", label: "All Records" },
        { key: "emergency", label: "Emergency" },
        { key: "notary", label: "Contracts" }
      ].map((t) => (
        <button
          key={t.key}
          onClick={() => setFilter(t.key)}
          className={cn(
            "relative whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all",
            filter === t.key
              ? "text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          )}
        >
          {filter === t.key && (
            <motion.div
              layoutId="activeFilter"
              className="absolute inset-0 rounded-lg bg-white/10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{t.label}</span>
        </button>
      ))}
    </div>
  </div>
);

/**
 * Pagination Component
 */
const Pagination = ({ current, total, onPageChange, totalItems }) => (
  <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
    <div className="text-sm text-slate-500 font-mono">
      Page <span className="text-slate-200">{current}</span> of <span className="text-slate-200">{total}</span>
      <span className="mx-2 text-slate-600">|</span>
      Total <span className="text-slate-200">{totalItems}</span> items
    </div>
    <div className="flex gap-2">
      <button
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:hover:border-white/10 disabled:cursor-not-allowed"
        onClick={() => onPageChange(Math.max(1, current - 1))}
        disabled={current <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:hover:border-white/10 disabled:cursor-not-allowed"
        onClick={() => onPageChange(Math.min(total, current + 1))}
        disabled={current >= total}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

/**
 * 空状态组件
 */
const EmptyState = ({ isConnected }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0 }}
    className="flex flex-col items-center justify-center py-20 text-slate-500"
  >
    <div className="relative mb-6 group">
      <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10 opacity-75 duration-1000" />
      <div className="relative rounded-full bg-white/5 p-6 ring-1 ring-white/10 transition-all group-hover:bg-white/10 group-hover:ring-cyan-500/30">
        <FileBox className="h-10 w-10 text-slate-600 transition-colors group-hover:text-cyan-400" />
      </div>
    </div>
    <p className="text-sm font-medium">{isConnected ? "No notary records found" : "Please connect wallet to view history"}</p>
    {!isConnected && <p className="mt-2 text-xs text-slate-600">Connect wallet to access your data</p>}
  </motion.div>
);

/**
 * List Item Component
 */
const NotaryListItem = ({ h, index, account, onSign, onOpenDetails, onOpenArchive, isSigning, signingId }) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiry = Number(h.expiryTime || 0);
  const isExpired = expiry !== 0 && nowSec > expiry;
  const isSingle = String(h.participant || "").toLowerCase() === "0x0000000000000000000000000000000000000000";
  const canSign = !isSingle && !h.isFinalized && !isExpired && account && String(account).toLowerCase() === String(h.participant || "").toLowerCase();

  let statusType = "warning";
  let statusText = "Pending Sign";

  if (expiry === 0) {
    statusType = "success";
    statusText = "Permanent";
  } else if (h.isFinalized) {
    statusType = "success";
    statusText = "Notarized";
  } else if (!isSingle && isExpired) {
    statusType = "danger";
    statusText = "Expired";
  } else if (isSingle) {
    statusType = "neutral";
    statusText = "Emergency";
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, filter: "blur(10px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-cyan-500/30 hover:bg-white/[0.04] hover:shadow-[0_0_30px_rgba(6,182,212,0.05)]"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="truncate text-lg font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
              {h.title || (isSingle ? "Untitled Emergency Evidence" : "Untitled Notary Agreement")}
            </h3>
            {isSingle ? (
              <StatusBadge type="danger" text="Emergency" icon={AlertTriangle} />
            ) : (
              <StatusBadge type="info" text="Contract" icon={FileText} />
            )}
            <StatusBadge type={statusType} text={statusText} />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-slate-500" />
              CID: <span className="text-slate-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{formatHash(h.ipfsHash)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-slate-500" />
              Initiator: <span className="text-slate-300">{formatAddress(h.initiator)}</span>
            </div>
            {!isSingle && (
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-slate-500" />
                Participant: <span className="text-slate-300">{formatAddress(h.participant)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-slate-500" />
              {expiry === 0 ? "Permanent" : `Deadline: ${formatTime(expiry)}`}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <NeonButton variant="ghost" onClick={() => onOpenDetails(h)} disabled={isExpired} className="h-9 px-3 text-xs">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Details
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => onOpenArchive(h)} disabled={isExpired || !account} className="h-9 px-3 text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Archive
          </NeonButton>
          {canSign && (
            <NeonButton
              variant="primary"
              onClick={() => onSign(h.id)}
              disabled={isSigning}
              loading={isSigning && signingId === h.id}
              className="h-9 px-4 text-xs"
            >
              Sign
            </NeonButton>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Details Modal Component
 */
const NotaryDetailModal = ({
  isOpen,
  onClose,
  record,
  error,
  personalPassword,
  setPersonalPassword,
  isDecrypting,
  onDecrypt,
  decryptedPayload,
  decryptedPlainText
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#151921] shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-200">{record?.title || "Evidence Details"}</h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <Cpu className="h-3 w-3" />
                  {record?.ipfsHash ? formatHash(record.ipfsHash) : "-"}
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {error && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {!decryptedPayload ? (
                <div className="flex flex-col items-center justify-center space-y-6 py-10">
                  <div className="relative">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-cyan-500/20 blur-xl" />
                    <Lock className="relative h-16 w-16 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-slate-200">Encrypted Content Protection</h3>
                    <p className="mt-2 text-sm text-slate-400">This evidence is encrypted using AES-256-GCM. Authorization required.</p>
                  </div>
                  <div className="w-full max-w-xs space-y-4">
                    <input
                      type="password"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-slate-200 placeholder-slate-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                      placeholder="Enter personal password to decrypt"
                      value={personalPassword}
                      onChange={(e) => setPersonalPassword(e.target.value)}
                      disabled={isDecrypting}
                    />
                    <NeonButton
                      onClick={onDecrypt}
                      disabled={isDecrypting || !personalPassword}
                      loading={isDecrypting}
                      className="w-full"
                    >
                      {isDecrypting ? "Decrypting..." : "Decrypt & View"}
                    </NeonButton>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider mb-2">
                        <Calendar className="h-3 w-3" />
                        <span>Created At</span>
                      </div>
                      <div className="font-mono text-sm text-slate-300">{decryptedPayload.createdAt || "-"}</div>
                    </div>
                    {decryptedPayload.location?.mapsUrl && (
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider mb-2">
                          <MapPin className="h-3 w-3" />
                          <span>Location</span>
                        </div>
                        <a
                          href={decryptedPayload.location.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate font-mono text-sm text-cyan-400 hover:underline"
                        >
                          View on Google Maps
                        </a>
                      </div>
                    )}
                  </div>

                  {decryptedPayload.report && (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-5 shadow-inner">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{decryptedPayload.report}</p>
                    </div>
                  )}

                  {/* Attachments */}
                  {Array.isArray(decryptedPayload.files) && decryptedPayload.files.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 text-sm font-medium text-slate-400">
                        <File className="h-4 w-4" />
                        Attachments ({decryptedPayload.files.length})
                      </h4>
                      <div className="grid gap-4">
                        {decryptedPayload.files.map((f, idx) => {
                          if (!f?.dataUrl) return null;
                          const isVideo = String(f.type || "").startsWith("video/");
                          const isPdf = String(f.type || "").includes("pdf") || String(f.name || "").endsWith(".pdf");
                          const title = f.name || `Attachment #${idx + 1}`;

                          return (
                            <div key={`${title}-${idx}`} className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                              <div className="border-b border-white/5 bg-white/5 px-4 py-2 text-xs text-slate-400">
                                {title} {f.type && <span className="ml-2 opacity-50">({f.type})</span>}
                              </div>
                              {isPdf ? (
                                <iframe title={title} className="h-[500px] w-full bg-white" src={f.dataUrl} />
                              ) : isVideo ? (
                                <video className="max-h-[500px] w-full bg-black" controls src={f.dataUrl} />
                              ) : (
                                <div className="flex justify-center bg-black/50 p-4">
                                  <img className="max-h-[500px] object-contain" alt={title} src={f.dataUrl} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Metadata & Raw JSON */}
                  <div className="border-t border-white/5 pt-4">
                    <details className="group">
                      <summary className="flex cursor-pointer items-center text-xs text-slate-500 hover:text-slate-300">
                        <ChevronRight className="mr-1 h-3 w-3 transition-transform group-open:rotate-90" />
                        Show Raw JSON
                      </summary>
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] text-slate-400 scrollbar-thin">
                        {decryptedPlainText}
                      </pre>
                    </details>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/**
 * Archive Modal Component
 */
const NotaryArchiveModal = ({
  isOpen,
  onClose,
  error,
  notice,
  categories,
  categoryName,
  setCategoryName,
  password,
  setPassword,
  isWorking,
  onConfirm,
  isSyncing
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isWorking && onClose()}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#151921] shadow-2xl"
          >
            <div className="border-b border-white/10 bg-white/5 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-200">Archive to Personal Vault</h2>
            </div>

            <div className="space-y-4 p-6">
              {notice && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {notice}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Select Target Category</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    disabled={isWorking}
                  >
                    {(categories.length ? categories : defaultArchiveCategoryNames()).map((n) => (
                      <option key={n} value={n} className="bg-slate-900">{n}</option>
                    ))}
                  </select>
                  <ChevronLeft className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 -rotate-90 text-slate-500" />
                </div>
                {isSyncing && <div className="text-[10px] text-slate-500 animate-pulse">Syncing categories...</div>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Personal Password (for re-encryption)</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password..."
                  disabled={isWorking}
                  onKeyDown={(e) => e.key === "Enter" && onConfirm()}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4">
                <NeonButton variant="ghost" onClick={onClose} disabled={isWorking}>
                  Cancel
                </NeonButton>
                <NeonButton
                  onClick={onConfirm}
                  disabled={isWorking || !password}
                  loading={isWorking}
                >
                  {isWorking ? "Archiving..." : "Confirm Archive"}
                </NeonButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Main Page Component ---

export default function Notary() {
  // 保持原有逻辑 Hooks 不变
  const {
    account,
    getHistory,
    parseProviderError,
    signRecord,
    unlockMasterSeedSession,
    archiveFileToCategory,
    getUserCategories,
    clearSessionSeed
  } = useTrustProtocol();

  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [isSigning, setIsSigning] = useState(false);
  const [signingId, setSigningId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalRecord, setModalRecord] = useState(null);
  const [personalPassword, setPersonalPassword] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedPayload, setDecryptedPayload] = useState(null);
  const [decryptedPlainText, setDecryptedPlainText] = useState("");
  const [decryptedGatewayUrl, setDecryptedGatewayUrl] = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [archiveNotice, setArchiveNotice] = useState("");
  const [archiveWorking, setArchiveWorking] = useState(false);
  const [archivePassword, setArchivePassword] = useState("");
  const [archiveCategories, setArchiveCategories] = useState([]);
  const [archiveCategoryName, setArchiveCategoryName] = useState("Original Documents");
  const [archiveCategorySyncing, setArchiveCategorySyncing] = useState(false);
  const [archiveRecord, setArchiveRecord] = useState(null);

  // --- Logic Hooks ---

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError("");
      setLoadingInitial(true);
      if (!account) {
        setHistory([]);
        setLoadingInitial(false);
        return;
      }
      try {
        const rows = await getHistory(account);
        if (!cancelled) setHistory(rows);
      } catch (e) {
        if (!cancelled) setError(parseProviderError(e));
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [account, getHistory, parseProviderError]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (history || [])
      .filter((h) => {
        const isSingle =
          String(h.participant || "").toLowerCase() === "0x0000000000000000000000000000000000000000";
        if (filter === "emergency") return isSingle;
        if (filter === "notary") return !isSingle;
        return true;
      })
      .filter((h) => {
        if (!q) return true;
        return String(h.title || "").toLowerCase().includes(q);
      });
  }, [filter, history, search]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  // --- Handlers (Logic Unchanged) ---

  async function refresh() {
    setError("");
    setLoadingInitial(true);
    try {
      if (!account) return;
      const rows = await getHistory(account);
      setHistory(rows);
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setLoadingInitial(false);
    }
  }

  async function handleSign(id) {
    setError("");
    setIsSigning(true);
    setSigningId(id);
    try {
      await signRecord(id);
      await refresh();
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsSigning(false);
      setSigningId(null);
    }
  }

  async function openDetails(h) {
    setModalError("");
    setModalRecord(h);
    setIsModalOpen(true);
    setPersonalPassword("");
    setIsDecrypting(false);
    setDecryptedPayload(null);
    setDecryptedPlainText("");
    setDecryptedGatewayUrl("");
  }

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
      const next = uniq.length ? uniq : defaultArchiveCategoryNames();
      setArchiveCategories(next);
      setArchiveCategoryName((prev) => {
        const current = normalizeArchiveCategoryName(prev);
        if (next.includes(current)) return current;
        return next[0] || current || "Original Documents";
      });
    } catch {
      setArchiveCategories(defaultArchiveCategoryNames());
    } finally {
      setArchiveCategorySyncing(false);
    }
  }

  async function handleDecrypt() {
    setModalError("");
    setIsDecrypting(true);
    setDecryptedPayload(null);
    setDecryptedPlainText("");
    setDecryptedGatewayUrl("");
    try {
      if (!modalRecord?.ipfsHash) throw new Error("CID missing");
      const seedHex = await unlockMasterSeedSession({ personalPassword });
      const parsed = await decryptNotaryPayloadWithSeed({ cid: modalRecord.ipfsHash, seedHex });
      setDecryptedPlainText(JSON.stringify(parsed, null, 2));
      setDecryptedPayload({
        report: typeof parsed?.report === "string" ? parsed.report : "",
        createdAt: typeof parsed?.createdAt === "string" ? parsed.createdAt : "",
        location: parsed?.location || null,
        files: Array.isArray(parsed?.files) ? parsed.files : parsed?.file ? [parsed.file] : [],
        raw: parsed
      });
      setDecryptedGatewayUrl("");
    } catch (e) {
      setModalError(parseProviderError(e));
    } finally {
      setIsDecrypting(false);
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setModalError("");
    setModalRecord(null);
    setPersonalPassword("");
    setIsDecrypting(false);
    setDecryptedPayload(null);
    setDecryptedPlainText("");
    setDecryptedGatewayUrl("");
  }

  function openArchive(h) {
    setArchiveError("");
    setArchiveNotice("");
    setArchivePassword("");
    setArchiveCategoryName("Original Documents");
    setArchiveRecord(h);
    setArchiveOpen(true);
    refreshArchiveCategories();
  }

  async function confirmArchive() {
    setArchiveError("");
    setArchiveNotice("");
    if (!account) {
      setArchiveError("Please connect wallet first");
      return;
    }
    const rec = archiveRecord;
    if (!rec?.ipfsHash) {
      setArchiveError("CID missing");
      return;
    }
    const pwd = String(archivePassword || "");
    if (!pwd) {
      setArchiveError("Personal password cannot be empty");
      return;
    }
    const catName = String(archiveCategoryName || "").trim();
    if (!catName) {
      setArchiveError("Please select a category");
      return;
    }

    setArchiveWorking(true);
    try {
      const seedHex = await unlockMasterSeedSession({ personalPassword: pwd });
      const payload = await decryptNotaryPayloadWithSeed({ cid: rec.ipfsHash, seedHex });
      const files = Array.isArray(payload?.files) ? payload.files : payload?.file ? [payload.file] : [];
      let count = 0;
      for (const f of files) {
        if (!f?.dataUrl) continue;
        const name = String(f?.name || "attachment");
        const type = String(f?.type || "");
        const size = Number(f?.size || 0);
        await archiveFileToCategory({ categoryName: catName, name, type, size, dataUrl: String(f.dataUrl) });
        count++;
      }
      if (count === 0 && typeof payload?.report === "string" && payload.report.trim()) {
        const text = payload.report;
        const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
        await archiveFileToCategory({
          categoryName: catName,
          name: (rec.title ? `${rec.title}-report.txt` : "notary-report.txt").slice(0, 120),
          type: "text/plain",
          size: text.length,
          dataUrl
        });
        count = 1;
      }
      setArchiveNotice(`File successfully archived to: ${catName}`);
    } catch (e) {
      setArchiveError(parseProviderError(e));
    } finally {
      try {
        if (account) clearSessionSeed(account);
      } catch {
      }
      setArchiveWorking(false);
    }
  }

  // --- Render (Visual Layer) ---

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-200 selection:bg-cyan-500/30">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto w-full max-w-7xl space-y-8 px-6 pb-6 pt-3 lg:px-12 lg:pb-12 lg:pt-6"
      >
        {/* Header Section */}
        <div className="mb-2">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
                <ShieldCheck className="h-3.5 w-3.5" />
                Cloud Notary
              </div>
              <h1 className="bg-gradient-to-r from-purple-400 via-cyan-400 to-emerald-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">
                Cloud Notary
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Decentralized Cloud Notary · Permanent On-Chain Evidence · Privacy Encrypted Storage
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NeonButton variant="ghost" onClick={refresh} disabled={!account} loading={loadingInitial}>
                <RefreshCw className={cn("h-4 w-4", loadingInitial && "animate-spin")} />
                Refresh List
              </NeonButton>
              <Link to="/notary/create">
                <NeonButton>
                  <Plus className="h-4 w-4" />
                  Create Evidence
                </NeonButton>
              </Link>
            </div>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-6 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200 backdrop-blur-md"
            >
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              {error}
            </motion.div>
          )}
        </div>

        {/* Main Content Area */}
        <GlassCard className="min-h-[600px] p-6">
          <SearchToolbar
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
          />

          <AnimatePresence mode="wait">
            {loadingInitial ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12"
              >
                <LoadingSkeleton />
              </motion.div>
            ) : pageRows.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState isConnected={!!account} />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                className="mt-6 space-y-4"
              >
                <AnimatePresence>
                  {pageRows.map((h, i) => (
                    <NotaryListItem
                      key={h.id}
                      h={h}
                      index={i}
                      account={account}
                      onSign={handleSign}
                      onOpenDetails={openDetails}
                      onOpenArchive={openArchive}
                      isSigning={isSigning}
                      signingId={signingId}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {filtered.length > PAGE_SIZE && (
            <Pagination
              current={page}
              total={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
            />
          )}
        </GlassCard>
      </motion.div>

      {/* Modals */}
      <NotaryDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        record={modalRecord}
        error={modalError}
        personalPassword={personalPassword}
        setPersonalPassword={setPersonalPassword}
        isDecrypting={isDecrypting}
        onDecrypt={handleDecrypt}
        decryptedPayload={decryptedPayload}
        decryptedPlainText={decryptedPlainText}
      />

      <NotaryArchiveModal
        isOpen={archiveOpen}
        onClose={() => { if (!archiveWorking) setArchiveOpen(false); }}
        error={archiveError}
        notice={archiveNotice}
        categories={archiveCategories}
        categoryName={archiveCategoryName}
        setCategoryName={setArchiveCategoryName}
        password={archivePassword}
        setPassword={setArchivePassword}
        isWorking={archiveWorking}
        onConfirm={confirmArchive}
        isSyncing={archiveCategorySyncing}
      />
    </div>
  );
}
