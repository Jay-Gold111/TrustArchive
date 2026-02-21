import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Copy, Check, Wallet, Shield, FileText, Settings, Key,
  Eye, EyeOff, Upload, Plus, X, Loader2, AlertTriangle, Building,
  Ban, RefreshCw, ChevronRight, Download, Lock, Unlock, Cpu
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import CryptoJS from "crypto-js";

import { useTrustProtocol } from "../hooks/useTrustProtocol";
import { decryptWithDerivedKey, deriveFileKey, fetchEncryptedFromPinataGateway } from "../services/securityService";
import { getTrustScore } from "../services/trustScoreService";
import { getWalletBalance, mnemonicSetup, mnemonicView, recoverPassword } from "../services/trustConnectService";
import { TrustBadge, TrustReportModal } from "../components/TrustBadge";
import RechargeModal from "../components/billing/RechargeModal";

// --- 样式工具 ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- 格式化工具 ---
function formatAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const val = n / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function formatTime(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatTimeSec(tsSeconds) {
  const ms = Number(tsSeconds || 0) * 1000;
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function ipfsUrl(cid) {
  const c = String(cid || "").trim();
  if (!c) return "";
  const g = import.meta.env.VITE_PINATA_GATEWAY;
  if (g) return `https://${g}/ipfs/${c}`;
  return `https://gateway.pinata.cloud/ipfs/${c}`;
}

function gatewayUrlForTokenUri(uri) {
  const u = String(uri || "").trim();
  if (!u) return "";
  if (u.startsWith("ipfs://")) return ipfsUrl(u.slice("ipfs://".length));
  return u;
}

function normalizeAddressKey(addr) {
  return String(addr || "").trim().toLowerCase();
}

function joinedAtKey(addr) {
  return `TA_JOINED_AT_${normalizeAddressKey(addr)}`;
}

function safeJsonParse(text, fallback) {
  try {
    const parsed = JSON.parse(String(text || ""));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function tokenMetaCacheKey() {
  return "TA_TOKEN_META_CACHE_V1";
}

function loadTokenMetaCache() {
  try {
    const raw = localStorage.getItem(tokenMetaCacheKey());
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveTokenMetaCache(cache) {
  try {
    localStorage.setItem(tokenMetaCacheKey(), JSON.stringify(cache || {}));
  } catch {
  }
}

async function fetchJsonByUri(uri) {
  const url = gatewayUrlForTokenUri(uri);
  if (!url) throw new Error("Missing URI");
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Metadata fetch failed (${res.status})`);
  return await res.json();
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

// --- UI Component System ---

/**
 * GlassCard: Core Container Component
 * Dark semi-transparent background + gradient border + internal glow, creating a floating tech feel
 */
const GlassCard = ({ children, className, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className={cn(
      "relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-purple-500/5",
      className
    )}
    {...props}
  >
    {/* 装饰性光晕 - 仅在 hover 时增强 */}
    <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-purple-500/10 blur-[80px] transition-opacity duration-500 group-hover:bg-purple-500/20" />
    <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-[80px] transition-opacity duration-500 group-hover:bg-cyan-500/20" />
    <div className="relative z-10">{children}</div>
  </motion.div>
);

/**
 * NeonButton: 交互核心
 * 提供多种变体，支持 Loading 状态，带有微交互缩放和光影效果
 */
const NeonButton = ({ children, variant = "primary", className, disabled, loading, icon: Icon, ...props }) => {
  const variants = {
    primary: "bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:brightness-110 border-none",
    secondary: "bg-slate-800 text-cyan-400 border border-cyan-500/30 hover:bg-slate-700 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]",
    ghost: "bg-transparent border border-white/5 text-slate-400 hover:bg-white/5 hover:text-white hover:border-white/20",
    danger: "bg-rose-950/30 border border-rose-900/50 text-rose-400 hover:bg-rose-900/50 hover:border-rose-500/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]",
    success: "bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/50 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]",
  };

  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold tracking-wide transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      {children}
    </motion.button>
  );
};

/**
 * StatusBadge: 状态指示器
 * 统一的色彩语义，带微弱背景发光
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-md", styles[type])}>
      {Icon && <Icon className="h-3 w-3" />}
      {text}
    </span>
  );
};

/**
 * ModalShell: 全局弹窗容器
 * 赛博朋克风格，居中覆盖，带动画
 */
const ModalShell = ({ title, onClose, children }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-[0_0_50px_rgba(8,145,178,0.2)] overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 uppercase">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-cyan-900/50">
          {children}
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

// --- Main Page Component ---

export default function Profile() {
  const navigate = useNavigate();
  const {
    account,
    connectWallet,
    isConnecting,
    isInstitution,
    listInstitutions,
    getMyTokens,
    getMyBatchTokens,
    getMyBlockedIssuers,
    unblockIssuer,
    parseProviderError,
    initSecurityCenter,
    unlockMasterSeedSession,
    rewrapSeedEnvelope,
    setSeedEnvelopeText,
    getMyFiles,
    getUserCategories,
    applyForIssuer,
    getMyIssuerApplication,
    uploadJsonToIpfs,
    clearSessionSeed
  } = useTrustProtocol();

  // --- State Definition (Keep original logic) ---
  const [activeTab, setActiveTab] = useState("assets"); // New: Tab Switch State
  const [error, setError] = useState("");
  const [tokens, setTokens] = useState([]);
  const [tokenDetailOpen, setTokenDetailOpen] = useState(false);
  const [tokenDetail, setTokenDetail] = useState(null);
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustError, setTrustError] = useState("");
  const [trustData, setTrustData] = useState(null);
  const [trustReportOpen, setTrustReportOpen] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const [joinedAt, setJoinedAt] = useState(0);
  const [copied, setCopied] = useState(false);

  const [rewrapOpen, setRewrapOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [rewrapError, setRewrapError] = useState("");
  const [rewrapWorking, setRewrapWorking] = useState(false);
  const [rewrapNotice, setRewrapNotice] = useState("");

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPassword, setQuickPassword] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickWorking, setQuickWorking] = useState(false);

  const [issuerApp, setIssuerApp] = useState(null);
  const [issuerAppLoading, setIssuerAppLoading] = useState(false);
  const [isIssuerActive, setIsIssuerActive] = useState(false);
  const [issuerApplyOpen, setIssuerApplyOpen] = useState(false);
  const [issuerApplyError, setIssuerApplyError] = useState("");
  const [issuerApplyWorking, setIssuerApplyWorking] = useState(false);
  const [issuerCompanyName, setIssuerCompanyName] = useState("");
  const [issuerApplyPassword, setIssuerApplyPassword] = useState("");
  const [issuerApplySeedHex, setIssuerApplySeedHex] = useState("");
  const [issuerApplyFiles, setIssuerApplyFiles] = useState([]);
  const [issuerApplySelectedIds, setIssuerApplySelectedIds] = useState(() => new Set());
  const [issuerCategories, setIssuerCategories] = useState(() => defaultArchiveCategoryNames());
  const [issuerCatSyncing, setIssuerCatSyncing] = useState(false);
  const [issuerFileSyncing, setIssuerFileSyncing] = useState(false);
  const [issuerActiveCategory, setIssuerActiveCategory] = useState("Original Documents");
  const [issuerPreviewOpen, setIssuerPreviewOpen] = useState(false);
  const [issuerPreviewLoading, setIssuerPreviewLoading] = useState(false);
  const [issuerPreviewError, setIssuerPreviewError] = useState("");
  const [issuerPreviewPayload, setIssuerPreviewPayload] = useState(null);

  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistError, setBlacklistError] = useState("");
  const [blacklistRows, setBlacklistRows] = useState(() => []);
  const [blacklistWorkingAddr, setBlacklistWorkingAddr] = useState("");

  const [mnemonicOpen, setMnemonicOpen] = useState(false);
  const [mnemonicPassword, setMnemonicPassword] = useState("");
  const [mnemonicWorking, setMnemonicWorking] = useState(false);
  const [mnemonicError, setMnemonicError] = useState("");
  const [mnemonicWords, setMnemonicWords] = useState(null);
  const [mnemonicCopied, setMnemonicCopied] = useState(false);

  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverWordsText, setRecoverWordsText] = useState("");
  const [recoverNewPassword, setRecoverNewPassword] = useState("");
  const [recoverWorking, setRecoverWorking] = useState(false);
  const [recoverError, setRecoverError] = useState("");
  const [recoverOk, setRecoverOk] = useState(false);

  // --- Business Logic Functions (Keep original logic) ---

  async function refreshWallet() {
    if (!account) {
      setWalletBalance(null);
      return;
    }
    setWalletLoading(true);
    try {
      const r = await getWalletBalance({ role: "USER", actorId: account });
      setWalletBalance(Number(r.balance || 0));
    } catch {
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  }

  async function refreshBlacklist() {
    setBlacklistError("");
    setBlacklistLoading(true);
    try {
      if (!account) {
        setBlacklistRows([]);
        return;
      }
      const [blocked, institutions] = await Promise.all([getMyBlockedIssuers(), listInstitutions()]);
      const instMap = new Map((institutions || []).map((x) => [String(x.address || "").toLowerCase(), x]));
      const out = (blocked || []).map((addr) => {
        const a = String(addr || "");
        const inst = instMap.get(a.toLowerCase()) || null;
        return { address: a, name: String(inst?.name || ""), isActive: Boolean(inst?.isActive) };
      });
      setBlacklistRows(out);
    } catch (e) {
      setBlacklistError(parseProviderError(e));
      setBlacklistRows([]);
    } finally {
      setBlacklistLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError("");
      if (!account) {
        setTokens([]);
        return;
      }
      try {
        const [legacy, batch] = await Promise.all([getMyTokens(), getMyBatchTokens()]);
        const legacyDisplayed = (legacy || []).filter((t) => Boolean(t.displayed));
        const batchDisplayed = (batch || []).filter((t) => Boolean(t.displayed));

        const cache = loadTokenMetaCache();
        const now = Date.now();
        const TTL_MS = 24 * 60 * 60 * 1000;
        const batchMetas = {};

        await Promise.all(
          batchDisplayed.map(async (t) => {
            const uri = String(t?.tokenURI || "").trim();
            if (!uri) return;
            const cached = cache[uri];
            if (cached && typeof cached === "object" && cached.data && Number(cached.ts || 0) + TTL_MS > now) {
              batchMetas[String(t.tokenId)] = cached.data;
              return;
            }
            const data = await fetchJsonByUri(uri);
            cache[uri] = { ts: now, data };
            batchMetas[String(t.tokenId)] = data;
          })
        );
        saveTokenMetaCache(cache);

        const normalizedLegacy = legacyDisplayed.map((t) => ({
          kind: "legacy",
          tokenId: t.tokenId,
          title: t.title,
          issuerName: t.issuerName,
          issuer: t.issuer,
          category: t.category,
          imageUrl: t.publicImageCid ? ipfsUrl(t.publicImageCid) : ""
        }));

        const normalizedBatch = batchDisplayed.map((t) => {
          const meta = batchMetas[String(t.tokenId)] || null;
          const title = String(meta?.name || "").trim() || t.templateId || `Batch #${t.tokenId}`;
          const issuerName = String(meta?.issuerName || "").trim() || t.issuerName || "Unknown Issuer";
          const issuer = String(meta?.issuerAddress || "").trim() || t.issuer || "";
          const category = String(meta?.category || "").trim() || "Batch Issuance";
          const imageUrl = meta?.image ? gatewayUrlForTokenUri(meta.image) : "";
          return { kind: "batch", tokenId: t.tokenId, title, issuerName, issuer, category, imageUrl };
        });

        if (!cancelled) setTokens([...normalizedBatch, ...normalizedLegacy]);
      } catch (e) {
        if (!cancelled) setError(parseProviderError(e));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [account, getMyBatchTokens, getMyTokens, parseProviderError]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setIssuerApp(null);
      if (!account) return;
      setIssuerAppLoading(true);
      try {
        const [app, ok] = await Promise.all([getMyIssuerApplication(), isInstitution(account)]);
        if (!cancelled) {
          setIssuerApp(app && app.id ? app : null);
          setIsIssuerActive(Boolean(ok));
        }
      } catch {
        if (!cancelled) {
          setIssuerApp(null);
          setIsIssuerActive(false);
        }
      } finally {
        if (!cancelled) setIssuerAppLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [account, getMyIssuerApplication, isInstitution]);

  useEffect(() => {
    setCopied(false);
    setJoinedAt(0);
    setRewrapNotice("");
    setRewrapError("");
    setRewrapOpen(false);
    setOldPassword("");
    setNewPassword("");
    setQuickOpen(false);
    setQuickPassword("");
    setQuickError("");
    setIssuerApplyOpen(false);
    setIssuerApplyError("");
    setIssuerApplyWorking(false);
    setIssuerCompanyName("");
    setIssuerApplyPassword("");
    setIssuerApplySeedHex("");
    setIssuerApplyFiles([]);
    setIssuerApplySelectedIds(new Set());
    setIssuerCategories(defaultArchiveCategoryNames());
    setIssuerCatSyncing(false);
    setIssuerFileSyncing(false);
    setIssuerActiveCategory("Original Documents");
    setIssuerPreviewOpen(false);
    setIssuerPreviewLoading(false);
    setIssuerPreviewError("");
    setIssuerPreviewPayload(null);

    if (!account) {
      return;
    }

    const key = joinedAtKey(account);
    const now = Date.now();
    const stored = Number(localStorage.getItem(key) || 0);
    const v = stored && Number.isFinite(stored) ? stored : now;
    if (!stored) localStorage.setItem(key, String(v));
    setJoinedAt(v);
  }, [account]);

  async function doMnemonicSetup() {
    setMnemonicError("");
    setMnemonicWords(null);
    setMnemonicCopied(false);
    if (!account) {
      setMnemonicError("Please connect wallet first");
      return;
    }
    if (!mnemonicPassword) {
      setMnemonicError("Please enter current password");
      return;
    }
    setMnemonicWorking(true);
    try {
      const res = await withMnemonicSeedEnvelope(() => mnemonicSetup(mnemonicPassword, { role: "USER", actorId: account }));
      const words = Array.isArray(res?.mnemonic) ? res.mnemonic : [];
      setMnemonicWords(words);
    } catch (e) {
      setMnemonicError(parseProviderError(e));
    } finally {
      setMnemonicWorking(false);
    }
  }

  async function doMnemonicView() {
    setMnemonicError("");
    setMnemonicWords(null);
    setMnemonicCopied(false);
    if (!account) {
      setMnemonicError("Please connect wallet first");
      return;
    }
    if (!mnemonicPassword) {
      setMnemonicError("Please enter current password");
      return;
    }
    setMnemonicWorking(true);
    try {
      const res = await withMnemonicSeedEnvelope(() => mnemonicView(mnemonicPassword, { role: "USER", actorId: account }));
      const words = Array.isArray(res?.mnemonic) ? res.mnemonic : [];
      setMnemonicWords(words);
    } catch (e) {
      setMnemonicError(parseProviderError(e));
    } finally {
      setMnemonicWorking(false);
    }
  }

  async function doRecoverPassword() {
    setRecoverError("");
    setRecoverOk(false);
    if (!account) {
      setRecoverError("Please connect wallet first");
      return;
    }
    const words = String(recoverWordsText || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean);
    if (words.length !== 12) {
      setRecoverError("Mnemonic must be 12 words");
      return;
    }
    if (!recoverNewPassword) {
      setRecoverError("Please enter new password");
      return;
    }
    setRecoverWorking(true);
    try {
      const res = await recoverPassword({ mnemonic: words, newPassword: recoverNewPassword }, { role: "USER", actorId: account });
      const envelopeText = typeof res?.seedEnvelope === "string" ? res.seedEnvelope : "";
      if (envelopeText) {
        await setSeedEnvelopeText({ envelopeText });
      }
      setRecoverOk(true);
      setRecoverWordsText("");
      setRecoverNewPassword("");
    } catch (e) {
      setRecoverError(String(e?.message || e));
    } finally {
      setRecoverWorking(false);
    }
  }

  async function withMnemonicSeedEnvelope(action) {
    try {
      return await action();
    } catch (e) {
      const msg = String(e?.message || e);
      const code = Number(e?.statusCode || 0);
      if ((code === 400 || code === 404) && msg.includes("种子信封")) {
        await initSecurityCenter({ personalPassword: mnemonicPassword });
        return await action();
      }
      throw e;
    }
  }

  const nomadId = useMemo(() => {
    if (!account) return "";
    const hex = CryptoJS.SHA256(normalizeAddressKey(account)).toString();
    return `TA-${hex.slice(0, 10)}`;
  }, [account]);

  useEffect(() => {
    refreshTrust();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    refreshWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  async function copyAddress() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
    }
  }

  async function refreshTrust() {
    setTrustError("");
    if (!account) {
      setTrustData(null);
      return;
    }
    setTrustLoading(true);
    try {
      const res = await getTrustScore(account);
      setTrustData(res);
    } catch (e) {
      setTrustError(e?.message || String(e));
    } finally {
      setTrustLoading(false);
    }
  }

  function openTokenDetail(t) {
    setTokenDetail(t || null);
    setTokenDetailOpen(true);
  }

  async function confirmRewrap() {
    setRewrapError("");
    setRewrapNotice("");
    const oldPwd = String(oldPassword || "");
    const newPwd = String(newPassword || "");
    if (!oldPwd || !newPwd) {
      setRewrapError("Please fill in both old and new passwords");
      return;
    }
    setRewrapWorking(true);
    try {
      const res = await rewrapSeedEnvelope({ oldPassword: oldPwd, newPassword: newPwd });
      setRewrapNotice(`Envelope re-wrapped (Transaction successful): ${formatAddress(res?.txHash || "")}`);
      setOldPassword("");
      setNewPassword("");
      setRewrapOpen(false);
    } catch (e) {
      setRewrapError(parseProviderError(e));
    } finally {
      setRewrapWorking(false);
    }
  }

  async function confirmQuickAccess() {
    setQuickError("");
    if (!account) {
      setQuickError("Please connect wallet first");
      return;
    }
    const pwd = String(quickPassword || "");
    if (!pwd) {
      setQuickError("Personal password cannot be empty");
      return;
    }
    setQuickWorking(true);
    try {
      await unlockMasterSeedSession({ personalPassword: pwd });
      setQuickOpen(false);
      setQuickPassword("");
      navigate("/archives?category=identity");
    } catch (e) {
      setQuickError(parseProviderError(e));
    } finally {
      setQuickWorking(false);
    }
  }

  function decryptArchiveField({ seedHex, encText }) {
    const env = safeJsonParse(encText, null);
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
      if (!cipherText) throw new Error("Incorrect archive format");
      throw new Error("Incorrect archive format");
    }
    const key = deriveFileKey({ masterSeedHex: String(seedHex || ""), fileId: raw.fileId });
    const plain = decryptWithDerivedKey({ ciphertext: String(raw.ciphertext || ""), ivHex: raw.ivHex, key });
    const parsed = safeJsonParse(plain, null);
    if (!parsed || typeof parsed !== "object" || !parsed.dataUrl) throw new Error("Incorrect decryption result format");
    return parsed;
  }

  async function refreshIssuerCategories() {
    if (!account) {
      setIssuerCategories(defaultArchiveCategoryNames());
      return;
    }
    setIssuerCatSyncing(true);
    try {
      const names = await getUserCategories();
      const base = names.length ? names : defaultArchiveCategoryNames();
      const mapped = (base || []).map((x) => normalizeArchiveCategoryName(x)).filter(Boolean);
      const uniq = [];
      for (const n of mapped) if (!uniq.includes(n)) uniq.push(n);
      const next = uniq.length ? uniq : defaultArchiveCategoryNames();
      setIssuerCategories(next);
      setIssuerActiveCategory((prev) => {
        const current = normalizeArchiveCategoryName(prev);
        if (next.includes(current)) return current;
        return next[0] || current || "Original Documents";
      });
    } catch {
      setIssuerCategories(defaultArchiveCategoryNames());
    } finally {
      setIssuerCatSyncing(false);
    }
  }

  async function loadIssuerApplyFiles() {
    setIssuerApplyError("");
    if (!account) {
      setIssuerApplyError("Please connect wallet first");
      return;
    }
    const pwd = String(issuerApplyPassword || "");
    if (!pwd) {
      setIssuerApplyError("Personal password cannot be empty");
      return;
    }
    setIssuerFileSyncing(true);
    try {
      const seedHex = await unlockMasterSeedSession({ personalPassword: pwd });
      setIssuerApplySeedHex(seedHex);
      await refreshIssuerCategories();
      const rows = await getMyFiles();
      const out = [];
      for (const r of rows) {
        const name = decryptArchiveField({ seedHex, encText: r.nameEnc });
        const categoryName = decryptArchiveField({ seedHex, encText: r.categoryEnc });
        out.push({
          id: String(r.id),
          cid: String(r.cid || ""),
          name: String(name || "Untitled"),
          categoryName: normalizeArchiveCategoryName(categoryName || "Uncategorized"),
          mime: String(r.mime || ""),
          size: Number(r.size || 0),
          createdAt: Number(r.createdAt || 0)
        });
      }
      setIssuerApplyFiles(out);
    } catch (e) {
      setIssuerApplyError(parseProviderError(e));
    } finally {
      setIssuerFileSyncing(false);
    }
  }

  const issuerVisibleFiles = useMemo(() => {
    const cat = normalizeArchiveCategoryName(issuerActiveCategory);
    return (issuerApplyFiles || []).filter((f) => normalizeArchiveCategoryName(f.categoryName) === cat);
  }, [issuerActiveCategory, issuerApplyFiles]);

  async function openIssuerPreview(fileRow) {
    setIssuerPreviewError("");
    setIssuerPreviewPayload(null);
    setIssuerPreviewOpen(true);
    setIssuerPreviewLoading(true);
    try {
      const seedHex = String(issuerApplySeedHex || "");
      if (!seedHex) throw new Error("Please enter personal password and load archive list first");
      const cid = String(fileRow?.cid || "").trim();
      if (!cid) throw new Error("Missing CID");
      const payload = await decryptArchivePayloadByCid({ seedHex, cid });
      setIssuerPreviewPayload(payload);
    } catch (e) {
      setIssuerPreviewError(parseProviderError(e));
    } finally {
      setIssuerPreviewLoading(false);
    }
  }

  async function createSharePayload({ name, type, size, dataUrl, title }) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const tempKey = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const ttlSec = 30 * 60;
    const plain = JSON.stringify({ title: title || "", name, type, size, dataUrl }, null, 0);
    const key = CryptoJS.SHA256(`TA_SHARE_V1|${tempKey}`);
    const iv = CryptoJS.lib.WordArray.random(16);
    const cipher = CryptoJS.AES.encrypt(plain, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    const shareCid = await uploadJsonToIpfs({
      scheme: "share-v1",
      ttlSec,
      ivHex: iv.toString(CryptoJS.enc.Hex),
      ciphertext: cipher.toString()
    });
    const url = `${window.location.origin}/share/v1/${shareCid}?key=${encodeURIComponent(tempKey)}`;
    return { shareCid, url, ttlSec };
  }

  async function submitIssuerApplication() {
    setIssuerApplyError("");
    if (!account) {
      setIssuerApplyError("Please connect wallet first");
      return;
    }
    const name = String(issuerCompanyName || "").trim();
    if (!name) {
      setIssuerApplyError("Please enter issuer name");
      return;
    }
    const seedHex = String(issuerApplySeedHex || "");
    if (!seedHex) {
      setIssuerApplyError("Please enter personal password and load archive list first");
      return;
    }
    const selected = issuerApplyFiles.filter((f) => issuerApplySelectedIds.has(f.id));
    if (selected.length === 0) {
      setIssuerApplyError("Please select at least 1 document file");
      return;
    }
    setIssuerApplyWorking(true);
    try {
      const docs = [];
      for (const f of selected) {
        const payload = await decryptArchivePayloadByCid({ seedHex, cid: f.cid });
        const share = await createSharePayload({
          title: `IssuerApplication|${name}`,
          name: String(payload.name || f.name || "document"),
          type: String(payload.type || f.mime || ""),
          size: Number(payload.size || f.size || 0),
          dataUrl: String(payload.dataUrl)
        });
        docs.push({
          name: String(payload.name || f.name || ""),
          category: f.categoryName,
          shareUrl: share.url,
          ttlSec: share.ttlSec
        });
      }
      const metadata = {
        kind: "issuer-application-v1",
        applicant: account,
        issuerName: name,
        submittedAt: new Date().toISOString(),
        documents: docs
      };
      const metadataCID = await uploadJsonToIpfs(metadata);
      await applyForIssuer({ metadataCID });
      setIssuerApplyOpen(false);
      setIssuerApplySelectedIds(new Set());
      setIssuerApplyFiles([]);
      setIssuerCompanyName("");
      setIssuerApplyPassword("");
      setIssuerApplySeedHex("");
      try {
        clearSessionSeed(account);
      } catch {
      }
      try {
        const app = await getMyIssuerApplication();
        setIssuerApp(app && app.id ? app : null);
      } catch {
      }
    } catch (e) {
      setIssuerApplyError(parseProviderError(e));
    } finally {
      setIssuerApplyWorking(false);
    }
  }

  // --- 页面渲染 ---

  if (!account) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="absolute -inset-10 animate-pulse rounded-full bg-cyan-500/20 blur-3xl"></div>
          <GlassCard className="flex flex-col items-center p-12">
            <Shield className="mb-6 h-16 w-16 text-cyan-400" />
            <h1 className="mb-4 text-3xl font-bold text-white">Please connect wallet first</h1>
            <p className="mb-8 text-slate-400">Identity Hub requires Web3 signature to verify your identity</p>
            <NeonButton onClick={connectWallet} disabled={isConnecting} loading={isConnecting} className="w-full">
              {isConnecting ? "Connecting..." : "Connect MetaMask"}
            </NeonButton>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 px-6 pb-6 pt-3 lg:px-12 lg:pb-12 lg:pt-6 font-sans selection:bg-cyan-500/30">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* 顶部标题区 */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
              <User className="h-3.5 w-3.5" />
              Profile
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
              IDENTITY HUB
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-mono tracking-wide">
              {nomadId} <span className="mx-2 text-slate-700">|</span> Profile & Settings
            </p>
          </div>

          <div className="flex gap-2">
            {/* 快速入口按钮 */}
            <NeonButton variant="secondary" onClick={() => setRechargeOpen(true)} icon={Wallet}>
              Top up Gas
            </NeonButton>
            <NeonButton variant="secondary" onClick={() => setQuickOpen(true)} icon={FileText}>
              Quick Access Archives
            </NeonButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* 左侧：个人信息卡片 (占 4 列) */}
          <div className="lg:col-span-4 space-y-6">
            <GlassCard className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                    <User className="h-10 w-10 text-cyan-400" />
                  </div>
                  <div className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>

                <h2 className="text-lg font-bold text-white mb-1">Web3 Citizen</h2>
                <div
                  className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-1.5 text-xs text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors border border-white/5 hover:border-cyan-500/30"
                  onClick={copyAddress}
                >
                  <span className="font-mono">{formatAddress(account)}</span>
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 w-full">
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center border border-white/5">
                    <div className="text-xs text-slate-500 mb-1">Registered At</div>
                    <div className="text-sm font-bold text-slate-200">{formatTime(joinedAt).split(" ")[0]}</div>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center border border-white/5">
                    <div className="text-xs text-slate-500 mb-1">Trust Score</div>
                    <div className="text-sm font-bold text-purple-400">
                      {trustLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : trustData ? (
                        <span>Lv.{trustData.trustLevel ?? "?"} · {trustData.totalScore ?? 0}</span>
                      ) : (
                        "N/A"
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 w-full">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400">Wallet Balance</span>
                    <span className="text-xs font-mono text-emerald-400">
                      {walletLoading ? "..." : walletBalance !== null ? formatBytes(walletBalance) : "0 B"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 w-[75%] rounded-full"></div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 信用评分详细入口 */}
            <GlassCard className="p-6 cursor-pointer hover:scale-[1.01] group" onClick={() => setTrustReportOpen(true)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:text-purple-300 transition-colors">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200 group-hover:text-white">Trust Report</h3>
                    <p className="text-xs text-slate-500">View detailed trust report and on-chain footprint</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-purple-400 transition-colors" />
              </div>
            </GlassCard>
          </div>

          {/* 右侧：主要功能区 (占 8 列) */}
          <div className="lg:col-span-8">

            {/* Tab 导航 */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { id: "assets", label: "My Showcase", icon: Wallet },
                { id: "issuer", label: "Issuer Verification", icon: Building },
                { id: "security", label: "Security Settings", icon: Lock },
                { id: "blacklist", label: "Blacklist", icon: Ban },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                    activeTab === tab.id
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                      : "bg-slate-900/50 text-slate-400 border border-transparent hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[500px]">
              <AnimatePresence mode="wait">

                {/* --- 资产 Tab --- */}
                {activeTab === "assets" && (
                  <motion.div
                    key="assets"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {tokens.length === 0 ? (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                        <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                          <FileText className="h-8 w-8 opacity-20" />
                        </div>
                        <p>No Assets</p>
                      </div>
                    ) : (
                      tokens.map((t, i) => (
                        <GlassCard key={`${t.tokenId}-${i}`} className="p-4 flex flex-col gap-4 group hover:border-cyan-500/30 transition-all cursor-pointer" onClick={() => openTokenDetail(t)}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-slate-800 overflow-hidden border border-white/5">
                                {t.imageUrl ? (
                                  <img src={t.imageUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-slate-600">
                                    <FileText className="h-6 w-6" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-200 line-clamp-1">{t.title || "Untitled Asset"}</h4>
                                <div className="text-xs text-slate-500">{t.category || "General"}</div>
                              </div>
                            </div>
                            <StatusBadge type="info" text={`#${t.tokenId}`} />
                          </div>
                          <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center text-xs text-slate-400">
                            <span>{t.issuerName}</span>
                            <span className="group-hover:text-cyan-400 transition-colors">View Details →</span>
                          </div>
                        </GlassCard>
                      ))
                    )}
                  </motion.div>
                )}

                {/* --- 机构认证 Tab --- */}
                {activeTab === "issuer" && (
                  <motion.div
                    key="issuer"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {issuerAppLoading ? (
                      <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-cyan-400" /></div>
                    ) : isIssuerActive ? (
                      <GlassCard className="p-8 text-center">
                        <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                          <Check className="h-10 w-10 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Issuer Verified</h2>
                        <p className="text-slate-400 max-w-md mx-auto">
                          Your address is already authorized as an issuer. You can start using issuance features.
                        </p>
                      </GlassCard>
                    ) : issuerApp && Number(issuerApp.status) === 0 ? (
                      <GlassCard className="p-8 text-center">
                        <div className="mx-auto h-20 w-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                          <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Application Pending</h2>
                        <p className="text-slate-400 max-w-md mx-auto mb-6">
                          Your issuer application is under review. ID: <span className="font-mono text-cyan-400">{issuerApp.id}</span>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                          <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-slate-500">Applied At</div>
                            <div className="font-mono text-slate-200">{formatTime(Number(issuerApp.createdAt) * 1000)}</div>
                          </div>
                          <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-slate-500">Metadata CID</div>
                            <div className="font-mono text-slate-200 break-all">{String(issuerApp.metadataCID || "-")}</div>
                          </div>
                        </div>
                      </GlassCard>
                    ) : issuerApp && Number(issuerApp.status) === 2 ? (
                      <GlassCard className="p-8 text-center border-rose-500/20 bg-rose-500/5">
                        <div className="mx-auto h-20 w-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6 border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.08)]">
                          <X className="h-10 w-10 text-rose-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Application Rejected</h2>
                        <p className="text-slate-400 max-w-md mx-auto mb-8">
                          You can update your documents and submit again.
                        </p>
                        <NeonButton onClick={() => setIssuerApplyOpen(true)} className="px-8">
                          Re-Apply
                        </NeonButton>
                      </GlassCard>
                    ) : (
                      <GlassCard className="p-8 text-center border-dashed border-slate-700 bg-slate-900/20">
                        <div className="mx-auto h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                          <Building className="h-10 w-10 text-slate-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Apply to become an Issuer</h2>
                        <p className="text-slate-400 max-w-md mx-auto mb-8">
                          Gain permission to batch issue SBTs and Verifiable Credentials. Requires submission of relevant qualification documents.
                        </p>
                        <NeonButton onClick={() => setIssuerApplyOpen(true)} className="px-8">
                          Apply Now
                        </NeonButton>
                      </GlassCard>
                    )}
                  </motion.div>
                )}

                {/* --- 安全设置 Tab --- */}
                {activeTab === "security" && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* 助记词管理 */}
                    <GlassCard className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <Key className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-lg text-white">Mnemonic Management</h3>
                      </div>
                      <p className="text-sm text-slate-400 mb-6 min-h-[40px]">
                        View or regenerate your master key mnemonic. Please ensure you are in a secure environment.
                      </p>
                      <div className="space-y-3">
                        <NeonButton variant="secondary" className="w-full" onClick={() => { setMnemonicOpen(true); }}>
                          View/Set Mnemonic
                        </NeonButton>
                        <NeonButton variant="ghost" className="w-full" onClick={() => setRecoverOpen(true)}>
                          Recover/Reset Mnemonic
                        </NeonButton>
                      </div>
                    </GlassCard>

                    {/* 密码管理 */}
                    <GlassCard className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                          <Lock className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-lg text-white">Security Reset</h3>
                      </div>
                      <p className="text-sm text-slate-400 mb-6 min-h-[40px]">
                        Change your personal encryption password. Note: This will re-encrypt your master key envelope.
                      </p>
                      <NeonButton variant="danger" className="w-full" onClick={() => setRewrapOpen(true)}>
                        Change Personal Password
                      </NeonButton>
                    </GlassCard>
                  </motion.div>
                )}

                {/* --- 黑名单 Tab --- */}
                {activeTab === "blacklist" && (
                  <motion.div
                    key="blacklist"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white">Blocked Issuers</h3>
                      <NeonButton size="sm" variant="ghost" onClick={refreshBlacklist} loading={blacklistLoading}>
                        <RefreshCw className="h-4 w-4" />
                      </NeonButton>
                    </div>

                    {blacklistError && (
                      <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> {blacklistError}
                      </div>
                    )}

                    <div className="space-y-2">
                      {blacklistRows.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                          No blocked records
                        </div>
                      ) : (
                        blacklistRows.map((row) => (
                          <GlassCard key={row.address} className="p-4 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-200">{row.name || "Unknown Issuer"}</div>
                              <div className="text-xs font-mono text-slate-500">{row.address}</div>
                            </div>
                            <NeonButton
                              variant="danger"
                              size="sm"
                              onClick={async () => {
                                setBlacklistWorkingAddr(row.address);
                                try {
                                  await unblockIssuer({ issuerAddress: row.address });
                                  refreshBlacklist();
                                } catch (e) {
                                  setBlacklistError(String(e));
                                } finally {
                                  setBlacklistWorkingAddr("");
                                }
                              }}
                              loading={blacklistWorkingAddr === row.address}
                            >
                              Unblock
                            </NeonButton>
                          </GlassCard>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* --- Modals --- */}

      {/* Token Detail Modal */}
      {tokenDetailOpen && tokenDetail && (
        <ModalShell title={tokenDetail.title} onClose={() => setTokenDetailOpen(false)}>
          <div className="space-y-6">
            <div className="aspect-video w-full rounded-xl bg-slate-950 overflow-hidden border border-slate-800 relative">
              {tokenDetail.imageUrl ? (
                <img src={tokenDetail.imageUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-700">
                  <FileText className="h-16 w-16" />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <StatusBadge type="info" text={tokenDetail.kind === "batch" ? "Batch Token" : "Legacy Token"} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="text-xs text-slate-500 mb-1">Token ID</div>
                <div className="font-mono text-cyan-400 font-bold">#{tokenDetail.tokenId}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="text-xs text-slate-500 mb-1">Category</div>
                <div className="text-slate-200">{tokenDetail.category}</div>
              </div>
              <div className="col-span-2 p-4 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="text-xs text-slate-500 mb-1">Issuer</div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-200 font-bold">{tokenDetail.issuerName}</span>
                  <span className="text-xs font-mono text-slate-500">{formatAddress(tokenDetail.issuer)}</span>
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Trust Report Modal */}
      {trustReportOpen && (
        <TrustReportModal
          open={trustReportOpen}
          onClose={() => setTrustReportOpen(false)}
          data={trustData}
        />
      )}

      {/* Recharge Modal */}
      {rechargeOpen && (
        <RechargeModal
          open={rechargeOpen}
          onClose={() => setRechargeOpen(false)}
          currentBalance={walletBalance}
          account={account}
        />
      )}

      {/* Quick Access Modal */}
      {quickOpen && (
        <ModalShell title="Quick Access Archives" onClose={() => setQuickOpen(false)}>
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-200 text-sm">
              Verify personal password to unlock session and quickly jump to archive management page.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Personal Password</label>
              <input
                type="password"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                value={quickPassword}
                onChange={(e) => setQuickPassword(e.target.value)}
                placeholder="Enter your password..."
              />
            </div>
            {quickError && (
              <div className="text-sm text-rose-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> {quickError}
              </div>
            )}
            <NeonButton onClick={confirmQuickAccess} loading={quickWorking} className="w-full">
              Unlock and Jump
            </NeonButton>
          </div>
        </ModalShell>
      )}

      {/* Rewrap (Password Change) Modal */}
      {rewrapOpen && (
        <ModalShell title="Change Personal Password" onClose={() => setRewrapOpen(false)}>
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-200 text-sm">
              <AlertTriangle className="h-5 w-5 inline-block mr-2 mb-1" />
              Warning: Changing password will re-encrypt your master key envelope. Please make sure to remember the new password, otherwise you will permanently lose access.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Current Old Password</label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white focus:border-cyan-500 focus:outline-none transition-all"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Set New Password</label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white focus:border-cyan-500 focus:outline-none transition-all"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            {rewrapError && (
              <div className="text-sm text-rose-400">{rewrapError}</div>
            )}
            {rewrapNotice && (
              <div className="text-sm text-emerald-400">{rewrapNotice}</div>
            )}

            <NeonButton variant="danger" onClick={confirmRewrap} loading={rewrapWorking} className="w-full">
              Confirm Change Password
            </NeonButton>
          </div>
        </ModalShell>
      )}

      {/* Issuer Apply Modal */}
      {issuerApplyOpen && (
        <ModalShell title="Apply to become an Issuer" onClose={() => setIssuerApplyOpen(false)}>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Issuer Name</label>
              <input
                type="text"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white focus:border-cyan-500 focus:outline-none transition-all"
                value={issuerCompanyName}
                onChange={(e) => setIssuerCompanyName(e.target.value)}
                placeholder="E.g., Trust Tech Ltd."
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-white">Qualification Documents</h4>
                {issuerApplySeedHex ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Archives Unlocked</span>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Enter password to unlock..."
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white w-32 focus:w-40 transition-all"
                      value={issuerApplyPassword}
                      onChange={(e) => setIssuerApplyPassword(e.target.value)}
                    />
                    <button
                      onClick={loadIssuerApplyFiles}
                      disabled={issuerFileSyncing}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {issuerFileSyncing ? "..." : "Load"}
                    </button>
                  </div>
                )}
              </div>

              {issuerApplySeedHex && (
                <div className="space-y-2">
                  {/* Category Filter */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {issuerCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setIssuerActiveCategory(cat)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
                          issuerActiveCategory === cat
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            : "bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* File List */}
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {issuerVisibleFiles.length === 0 ? (
                      <div className="text-center text-xs text-slate-500 py-4">No files in this category</div>
                    ) : (
                      issuerVisibleFiles.map(f => {
                        const isSelected = issuerApplySelectedIds.has(f.id);
                        return (
                          <div
                            key={f.id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer",
                              isSelected
                                ? "bg-cyan-900/20 border-cyan-500/50"
                                : "bg-slate-950 border-slate-800 hover:border-slate-600"
                            )}
                            onClick={() => {
                              const next = new Set(issuerApplySelectedIds);
                              if (next.has(f.id)) next.delete(f.id);
                              else next.add(f.id);
                              setIssuerApplySelectedIds(next);
                            }}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className={cn("h-4 w-4 rounded-full border flex items-center justify-center shrink-0", isSelected ? "bg-cyan-500 border-cyan-500" : "border-slate-600")}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className="text-sm text-slate-300 truncate">{f.name}</span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); openIssuerPreview(f); }}
                              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="text-xs text-slate-500 text-right">
                    Selected {issuerApplySelectedIds.size} files
                  </div>
                </div>
              )}
            </div>

            {issuerApplyError && (
              <div className="text-sm text-rose-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> {issuerApplyError}
              </div>
            )}

            <NeonButton onClick={submitIssuerApplication} loading={issuerApplyWorking} className="w-full">
              Submit Application
            </NeonButton>
          </div>
        </ModalShell>
      )}

      {/* Mnemonic Setup Modal */}
      {mnemonicOpen && (
        <ModalShell title="Mnemonic Management" onClose={() => { setMnemonicOpen(false); setMnemonicWords(null); }}>
          <div className="space-y-6">
            {!mnemonicWords ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Please enter personal password to view or generate mnemonic.</p>
                <input
                  type="password"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white focus:border-cyan-500 transition-all"
                  placeholder="Enter password..."
                  value={mnemonicPassword}
                  onChange={(e) => setMnemonicPassword(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <NeonButton variant="secondary" onClick={doMnemonicView} loading={mnemonicWorking}>
                    View Existing
                  </NeonButton>
                  <NeonButton onClick={doMnemonicSetup} loading={mnemonicWorking}>
                    Generate New
                  </NeonButton>
                </div>
                {mnemonicError && <div className="text-sm text-rose-400">{mnemonicError}</div>}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {mnemonicWords.map((w, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
                      <span className="text-xs text-slate-600 block mb-1">{i + 1}</span>
                      <span className="text-sm font-mono text-cyan-400 font-bold">{w}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center">
                  <NeonButton
                    variant="ghost"
                    icon={copied ? Check : Copy}
                    onClick={() => {
                      navigator.clipboard.writeText(mnemonicWords.join(" "));
                      setMnemonicCopied(true);
                      setTimeout(() => setMnemonicCopied(false), 2000);
                    }}
                  >
                    {mnemonicCopied ? "Copied" : "Copy All"}
                  </NeonButton>
                </div>
                <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl text-amber-400 text-sm text-center">
                  Please save the mnemonic offline! Once lost, the account cannot be recovered.
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* Recover Password Modal */}
      {recoverOpen && (
        <ModalShell title="Recover/Reset Password" onClose={() => setRecoverOpen(false)}>
          <div className="space-y-6">
            {recoverOk ? (
              <div className="text-center py-8">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Recovery Successful</h3>
                <p className="text-slate-400 mb-6">Your password has been reset and the envelope has been updated.</p>
                <NeonButton onClick={() => setRecoverOpen(false)}>Close</NeonButton>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Mnemonic (12 words, space separated)</label>
                  <textarea
                    className="w-full h-24 rounded-xl bg-slate-950 border border-slate-700 p-3 text-white focus:border-cyan-500 transition-all font-mono text-sm"
                    value={recoverWordsText}
                    onChange={(e) => setRecoverWordsText(e.target.value)}
                    placeholder="apple banana cat ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Set New Password</label>
                  <input
                    type="password"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-white focus:border-cyan-500 transition-all"
                    value={recoverNewPassword}
                    onChange={(e) => setRecoverNewPassword(e.target.value)}
                  />
                </div>
                {recoverError && <div className="text-sm text-rose-400">{recoverError}</div>}
                <NeonButton onClick={doRecoverPassword} loading={recoverWorking} className="w-full">
                  Confirm Recovery
                </NeonButton>
              </>
            )}
          </div>
        </ModalShell>
      )}

      {/* Issuer File Preview Modal */}
      {issuerPreviewOpen && (
        <ModalShell title="File Preview" onClose={() => setIssuerPreviewOpen(false)}>
          <div className="flex flex-col items-center justify-center min-h-[300px]">
            {issuerPreviewLoading ? (
              <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
            ) : issuerPreviewError ? (
              <div className="text-rose-400 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                {issuerPreviewError}
              </div>
            ) : issuerPreviewPayload ? (
              <div className="w-full space-y-4">
                {issuerPreviewPayload.type?.startsWith("image/") ? (
                  <img src={issuerPreviewPayload.dataUrl} alt="Preview" className="w-full rounded-lg border border-slate-700" />
                ) : (
                  <div className="h-40 w-full bg-slate-900 flex items-center justify-center rounded-lg border border-slate-700 text-slate-500">
                    Cannot preview this file type
                  </div>
                )}
                <div className="text-center text-sm text-slate-400">
                  {issuerPreviewPayload.name}
                </div>
              </div>
            ) : null}
          </div>
        </ModalShell>
      )}

    </div>
  );
}
