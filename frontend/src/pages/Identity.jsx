import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import CryptoJS from "crypto-js";
import { useTrustProtocol } from "../hooks/useTrustProtocol";
import {
  createFileId,
  decryptWithDerivedKey,
  deriveFileKey,
  encryptWithDerivedKey,
  fetchEncryptedFromPinataGateway
} from "../services/securityService";
import {
  Folder,
  File,
  FileText,
  Image as IconImage,
  Video,
  Music,
  Lock,
  Unlock,
  Plus,
  Trash2,
  MoveRight,
  Share2,
  Grid,
  List,
  Search,
  UploadCloud,
  X,
  Check,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  MoreVertical,
  CornerDownRight,
  Eye,
  FileDigit,
  HardDrive
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// =============================================================================
// Constants & Utils
// =============================================================================

const DEFAULT_CATEGORIES = [
  { id: "cat-default-id", name: "Original Documents", isDefault: true },
  { id: "cat-default-contract", name: "Contracts & Agreements", isDefault: true },
  { id: "cat-default-finance", name: "Financial Assets", isDefault: true }
];

const UNCATEGORIZED = { id: "cat-uncategorized", name: "More", isDefault: true };

const DEFAULT_CATEGORY_ALIASES = {
  "cat-default-id": ["Original Documents", "证件原件"],
  "cat-default-contract": ["Contracts & Agreements", "合同协议"],
  "cat-default-finance": ["Financial Assets", "财务资产"]
};

function defaultCategoryIdFromName(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  for (const [id, aliases] of Object.entries(DEFAULT_CATEGORY_ALIASES)) {
    if (aliases.includes(n)) return id;
  }
  return "";
}

function canonicalDefaultCategoryName(categoryId) {
  const id = String(categoryId || "");
  const aliases = DEFAULT_CATEGORY_ALIASES[id];
  return aliases?.[0] ? String(aliases[0]) : "";
}

function normalizeDefaultCategoryName(name) {
  const id = defaultCategoryIdFromName(name);
  if (!id) return String(name || "").trim();
  return canonicalDefaultCategoryName(id) || String(name || "").trim();
}

function normalizeAddressKey(addr) {
  return String(addr || "").trim().toLowerCase();
}

function requestedCategoryFromSearch(search) {
  const sp = new URLSearchParams(String(search || ""));
  return String(sp.get("category") || "").trim();
}

function mapRequestedCategoryId(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  if (v === "identity") return "cat-default-id";
  if (v === "contract") return "cat-default-contract";
  if (v === "finance") return "cat-default-finance";
  return value;
}

function safeJsonParse(text, fallback) {
  try {
    const parsed = JSON.parse(String(text || ""));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const fixed = i === 0 ? 0 : value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(fixed)} ${units[i]}`;
}

function formatTime(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function createId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function buildShareKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const tempKey = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return tempKey;
}

function getKindFromMime(mime, name) {
  const t = String(mime || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf") return "pdf";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/)) return "image";
  if (n.match(/\.(mp4|mov|webm|mkv)$/)) return "video";
  if (n.match(/\.(mp3|wav|ogg|m4a)$/)) return "audio";
  return "file";
}

// =============================================================================
// UI Components (Design System)
// =============================================================================

/**
 * 玻璃态卡片容器
 */
const GlassCard = ({ children, className = "", hoverEffect = false, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`
      relative overflow-hidden rounded-2xl border border-white/5 bg-[#12141a]/60 backdrop-blur-xl
      shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]
      ${hoverEffect ? "hover:bg-[#12141a]/80 hover:border-cyan-500/20 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)] transition-all duration-300 cursor-pointer group" : ""}
      ${className}
    `}
    onClick={onClick}
  >
    {children}
  </motion.div>
);

/**
 * 霓虹按钮
 */
const NeonButton = ({ children, onClick, disabled, variant = "cyan", className = "", icon: Icon, size = "md" }) => {
  const styles = {
    cyan: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]",
    emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    rose: "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]",
    amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    ghost: "bg-transparent text-slate-400 border border-transparent hover:bg-white/5 hover:text-slate-200"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`
        relative flex items-center justify-center gap-2 rounded-xl font-medium tracking-wide transition-all duration-300
        disabled:opacity-50 disabled:pointer-events-none disabled:grayscale outline-none
        ${styles[variant]}
        ${sizes[size]}
        ${className}
      `}
      onClick={onClick}
      disabled={disabled}
    >
      {disabled && variant === "cyan" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className={`h-4 w-4 ${size === 'sm' ? 'h-3.5 w-3.5' : ''}`} />
      ) : null}
      {children}
    </motion.button>
  );
};

/**
 * 科技感输入框
 */
const InputField = ({ label, value, onChange, placeholder, type = "text", icon: Icon, disabled, onKeyDown, autoFocus }) => (
  <div className="space-y-1.5 group">
    {label && (
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-cyan-400 transition-colors duration-300">
        {label}
      </label>
    )}
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors duration-300" />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className={`
          w-full rounded-xl border border-white/10 bg-[#0B0E14]/50 py-2.5 text-sm text-slate-200 placeholder:text-slate-700
          outline-none transition-all duration-300
          focus:border-cyan-500/50 focus:bg-cyan-950/10 focus:shadow-[0_0_20px_rgba(6,182,212,0.1)]
          disabled:opacity-50 disabled:cursor-not-allowed font-mono
          ${Icon ? "pl-10 pr-4" : "px-4"}
        `}
      />
    </div>
  </div>
);

/**
 * 通用弹窗外壳
 */
const ModalShell = ({ title, onClose, children, maxWidth = "max-w-md" }) => (
  <AnimatePresence>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className={`relative w-full ${maxWidth} overflow-hidden rounded-2xl border border-white/10 bg-[#12141a] shadow-2xl shadow-black/50`}
      >
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-5 py-4">
          <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </motion.div>
    </div>
  </AnimatePresence>
);

/**
 * 文件类型图标渲染器
 */
const FileIconRenderer = ({ kind, className = "h-6 w-6" }) => {
  switch (kind) {
    case "pdf": return <FileText className={`${className} text-rose-400`} />;
    case "image": return <IconImage className={`${className} text-purple-400`} />;
    case "video": return <Video className={`${className} text-cyan-400`} />;
    case "audio": return <Music className={`${className} text-amber-400`} />;
    default: return <File className={`${className} text-slate-400`} />;
  }
};

// =============================================================================
// Main Component
// =============================================================================

export default function Archives() {
  const { search } = useLocation();
  const {
    account,
    encryptAndUploadWithMasterSeed,
    uploadJsonToIpfs,
    fileToBase64,
    unlockMasterSeedSession,
    getMyCreditScore,
    getMyFolders,
    addCategory,
    deleteFolder,
    getMyFiles,
    addFileRecord,
    moveFiles,
    deleteFiles,
    clearSessionSeed
  } = useTrustProtocol();

  const fileInputRef = useRef(null);
  const lastActivityRef = useRef(0);

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [records, setRecords] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState("create");
  const [categoryNameDraft, setCategoryNameDraft] = useState("");
  const [categoryEditingId, setCategoryEditingId] = useState("");
  const [categorySyncing, setCategorySyncing] = useState(false);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const [selectedId, setSelectedId] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState(() => new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState(0);
  const [moveWorking, setMoveWorking] = useState(false);
  const [moveError, setMoveError] = useState("");
  const [deleteWorking, setDeleteWorking] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewPayload, setPreviewPayload] = useState(null);
  const [sessionSeedHex, setSessionSeedHex] = useState("");
  const [autoLockExpiresAt, setAutoLockExpiresAt] = useState(0);
  const [autoLockRemainSec, setAutoLockRemainSec] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateWorking, setGateWorking] = useState(false);
  const [contentOpacity, setContentOpacity] = useState(1);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareWorking, setShareWorking] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState(0);
  const [shareRemainSec, setShareRemainSec] = useState(0);
  const [shareError, setShareError] = useState("");

  const categoryById = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const requestedCategory = useMemo(() => mapRequestedCategoryId(requestedCategoryFromSearch(search)), [search]);

  const activeCategory = categoryById.get(activeCategoryId) || categories[0] || DEFAULT_CATEGORIES[0];

  const filtered = useMemo(() => {
    return records.filter((r) => r.categoryId === activeCategoryId);
  }, [records, activeCategoryId]);

  const selectedCount = selectedFileIds.size;

  function toggleFileSelect(fileId) {
    const key = String(fileId || "");
    if (!key) return;
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFileSelection() {
    setSelectedFileIds(new Set());
  }

  function toggleSelectAllInView() {
    const ids = filtered.map((r) => String(r.id));
    if (!ids.length) return;
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  const selectedRecord = useMemo(() => {
    if (!selectedId) return null;
    return records.find((r) => r.id === selectedId) || null;
  }, [records, selectedId]);

  useEffect(() => {
    setError("");
    setNotice("");
    setSelectedId("");
    setSelectedFileIds(new Set());
    setMoveOpen(false);
    setMoveTargetFolderId(0);
    setMoveWorking(false);
    setMoveError("");
    setDeleteWorking(false);
    setPreviewOpen(false);
    setPreviewPayload(null);
    setPreviewError("");
    setShareOpen(false);
    setShareUrl("");
    setShareExpiresAt(0);
    setShareRemainSec(0);
    setShareError("");
    setUploadProgress(0);
    setUploadStage("");
    setSessionSeedHex("");
    setAutoLockExpiresAt(0);
    setAutoLockRemainSec(0);
    setGateOpen(false);
    setGatePassword("");
    setGateError("");
    setGateWorking(false);
    setContentOpacity(1);
    setCategorySyncing(false);
    setCategorySubmitting(false);

    if (!account) {
      setCategories(DEFAULT_CATEGORIES);
      setActiveCategoryId(DEFAULT_CATEGORIES[0].id);
      setRecords([]);
      return;
    }

    setActiveCategoryId((prev) => {
      if (requestedCategory && DEFAULT_CATEGORIES.some((c) => c.id === requestedCategory)) return requestedCategory;
      return DEFAULT_CATEGORIES.some((c) => c.id === prev) ? prev : DEFAULT_CATEGORIES[0].id;
    });

    setCategories(DEFAULT_CATEGORIES);
    clearSessionSeed(account);
    setRecords([]);
    setGateOpen(true);
  }, [account, requestedCategory]);

  useEffect(() => {
    if (!account) return;
    return () => {
      clearSessionSeed(account);
    };
  }, [account, clearSessionSeed]);

  useEffect(() => {
    setContentOpacity(0);
    const t = window.setTimeout(() => setContentOpacity(1), 30);
    return () => window.clearTimeout(t);
  }, [activeCategoryId]);

  useEffect(() => {
    if (!shareExpiresAt) return;
    const timer = window.setInterval(() => {
      const remain = Math.max(0, shareExpiresAt - Date.now());
      const sec = Math.floor(remain / 1000);
      setShareRemainSec(sec);
      if (remain <= 0) {
        setShareUrl("");
        setShareExpiresAt(0);
        setShareError("链接已失效");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [shareExpiresAt]);

  function bumpActivity() {
    if (!account) return;
    if (!sessionSeedHex) return;
    const now = Date.now();
    if (now - lastActivityRef.current < 1200) return;
    lastActivityRef.current = now;
    const expiresAt = now + 5 * 60 * 1000;
    setAutoLockExpiresAt(expiresAt);
    setAutoLockRemainSec(5 * 60);
  }

  useEffect(() => {
    if (!account) return;
    if (!sessionSeedHex) return;
    if (!autoLockExpiresAt) return;
    const timer = window.setInterval(() => {
      const remainMs = Math.max(0, autoLockExpiresAt - Date.now());
      const sec = Math.ceil(remainMs / 1000);
      setAutoLockRemainSec(sec);
      if (remainMs <= 0) {
        clearSessionSeed(account);
        setSessionSeedHex("");
        setAutoLockExpiresAt(0);
        setAutoLockRemainSec(0);
        setPreviewOpen(false);
        setPreviewPayload(null);
        setPreviewError("");
        setShareOpen(false);
        setShareUrl("");
        setShareExpiresAt(0);
        setShareRemainSec(0);
        setShareError("");
        setGatePassword("");
        setGateError("");
        setGateWorking(false);
        setRecords([]);
        setGateOpen(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [account, autoLockExpiresAt, clearSessionSeed, sessionSeedHex]);

  function formatAutoLock(sec) {
    const s = Math.max(0, Number(sec || 0));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  }

  function encryptField(seedHex, plainText) {
    const fileId = createFileId();
    const key = deriveFileKey({ masterSeedHex: seedHex, fileId });
    const enc = encryptWithDerivedKey({ plainText: String(plainText || ""), key });
    return JSON.stringify({ scheme: "archive-field-v1", fileId, ivHex: enc.ivHex, ciphertext: enc.ciphertext });
  }

  function decryptField(seedHex, encText) {
    const env = safeJsonParse(encText, null);
    const fileId = typeof env?.fileId === "string" ? env.fileId : "";
    const ivHex = typeof env?.ivHex === "string" ? env.ivHex : "";
    const ciphertext = typeof env?.ciphertext === "string" ? env.ciphertext : "";
    if (!fileId || !ivHex || !ciphertext) return "";
    const key = deriveFileKey({ masterSeedHex: seedHex, fileId });
    return decryptWithDerivedKey({ ciphertext, ivHex, key });
  }

  function categoryIdForName(name) {
    const n = String(name || "").trim();
    if (!n) return "";
    const defaultId = defaultCategoryIdFromName(n);
    if (defaultId) return defaultId;
    if (n === UNCATEGORIZED.name) return UNCATEGORIZED.id;
    const hex = CryptoJS.SHA256(`TA_CATEGORY_V1|${n}`).toString();
    return `cat-${hex.slice(0, 12)}`;
  }

  async function hydrateCategoriesFromChain() {
    if (!account) return;
    setCategorySyncing(true);
    try {
      const folders = await getMyFolders();
      const map = new Map();
      for (const f of folders || []) {
        const n = String(f?.name || "").trim();
        const folderId = Number(f?.folderId || 0);
        if (!n || !folderId) continue;
        const id = categoryIdForName(n);
        if (!id) continue;
        if (!map.has(id)) {
          const normalizedName = normalizeDefaultCategoryName(n);
          map.set(id, { id, name: normalizedName || n, folderId, isDefault: Boolean(defaultCategoryIdFromName(n)) });
        }
      }
      for (const d of DEFAULT_CATEGORIES) {
        if (!map.has(d.id)) map.set(d.id, { ...d, folderId: DEFAULT_CATEGORIES.findIndex((x) => x.id === d.id) + 1, isDefault: true });
      }
      map.set(UNCATEGORIZED.id, { ...UNCATEGORIZED, folderId: 0 });
      const next = Array.from(map.values()).filter((c) => c.id === UNCATEGORIZED.id || c.folderId > 0);
      setCategories(next);
      setActiveCategoryId((prev) => {
        if (requestedCategory && next.some((c) => c.id === requestedCategory)) return requestedCategory;
        return next.some((c) => c.id === prev) ? prev : DEFAULT_CATEGORIES[0].id;
      });
      return next;
    } finally {
      setCategorySyncing(false);
    }
  }

  async function refreshFromChain(seedHex, categoriesOverride) {
    if (!account) return;
    const seed = typeof seedHex === "string" ? seedHex : sessionSeedHex;
    if (!seed) return;
    const nameToId = new Map();
    const folderToId = new Map();
    const sourceCats = Array.isArray(categoriesOverride) ? categoriesOverride : categories;
    for (const c of sourceCats) {
      nameToId.set(c.name, c.id);
      const aliases = DEFAULT_CATEGORY_ALIASES[String(c.id || "")];
      if (Array.isArray(aliases)) {
        for (const a of aliases) nameToId.set(String(a || ""), c.id);
      }
      if (c.folderId != null) folderToId.set(Number(c.folderId), c.id);
    }
    const rows = await getMyFiles();
    const out = [];
    for (const r of rows) {
      const name = decryptField(seed, r.nameEnc);
      let mappedId = UNCATEGORIZED.id;
      const folderId = Number(r.folderId || 0);
      if (folderId) {
        mappedId = folderToId.get(folderId) || UNCATEGORIZED.id;
      } else {
        const categoryName = decryptField(seed, r.categoryEnc);
        const normalizedCategoryName = normalizeDefaultCategoryName(categoryName);
        mappedId = nameToId.get(normalizedCategoryName) || nameToId.get(categoryName) || UNCATEGORIZED.id;
      }
      out.push({
        id: String(r.id),
        cid: String(r.cid || ""),
        categoryId: mappedId,
        folderId,
        name: String(name || "未命名"),
        mime: String(r.mime || ""),
        size: Number(r.size || 0),
        createdAt: Number(r.createdAt || 0) * 1000
      });
    }
    setRecords(out);
  }

  async function confirmGate() {
    setGateError("");
    setError("");
    setNotice("");
    if (!account) return;
    const pwd = String(gatePassword || "");
    if (!pwd) {
      setGateError("个人密码不能为空");
      return;
    }
    setGateWorking(true);
    try {
      const seedHex = await unlockMasterSeedSession({ personalPassword: pwd });
      setSessionSeedHex(seedHex);
      const expiresAt = Date.now() + 5 * 60 * 1000;
      setAutoLockExpiresAt(expiresAt);
      setAutoLockRemainSec(5 * 60);
      setGateOpen(false);
      setGatePassword("");
      setGateError("");
      setNotice("Unlocked Archives (Valid for this session)");
      const nextCats = await hydrateCategoriesFromChain();
      await refreshFromChain(seedHex, nextCats);
    } catch (e) {
      setGateError(e?.message || String(e));
    } finally {
      setGateWorking(false);
    }
  }

  function openCreateCategory() {
    setCategoryModalMode("create");
    setCategoryEditingId("");
    setCategoryNameDraft("");
    setCategoryModalOpen(true);
  }

  function openRenameCategory(cat) {
    setError("暂不支持重命名链上分类");
  }

  async function deleteCategory(cat, count) {
    setError("");
    setNotice("");
    if (!account) {
      setError("请先连接钱包");
      return;
    }
    const folderId = Number(cat?.folderId || 0);
    const pending = Boolean(cat?.pending);
    if (pending) return;
    if (!folderId) {
      setError("该分类不支持删除");
      return;
    }
    if (Boolean(cat?.isDefault) || folderId <= 3) {
      setError("默认分类无法删除");
      return;
    }
    if (Number(count || 0) > 0) {
      setError("分类下有文件，无法删除");
      return;
    }
    const ok = window.confirm(`确认删除分类「${cat?.name || ""}」？`);
    if (!ok) return;

    setCategorySubmitting(true);
    try {
      clearFileSelection();
      await deleteFolder({ folderId });
      const nextCats = await hydrateCategoriesFromChain();
      if (nextCats) await refreshFromChain(sessionSeedHex, nextCats);
      setNotice("分类已删除");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function submitCategoryModal() {
    setError("");
    const name = String(categoryNameDraft || "").trim();
    if (!name) {
      setError("分类名称不能为空");
      return;
    }
    if (categoryModalMode === "create") {
      if (!account) {
        setError("请先连接钱包");
        return;
      }
      setCategorySubmitting(true);
      const pendingId = `pending-${createId()}`;
      setCategories((prev) => {
        const base = prev.filter((c) => c.id !== pendingId);
        return [...base, { id: pendingId, name, isDefault: false, pending: true }];
      });
      setCategoryModalOpen(false);
      try {
        await addCategory({ name });
        const nextCats = await hydrateCategoriesFromChain();
        const id = categoryIdForName(name);
        if (id) setActiveCategoryId(id);
        if (nextCats) await refreshFromChain(sessionSeedHex, nextCats);
        setNotice("分类已同步上链");
      } catch (e) {
        setError(e?.message || String(e));
        setCategories((prev) => prev.filter((c) => c.id !== pendingId));
      } finally {
        setCategorySubmitting(false);
      }
      return;
    }

    const id = String(categoryEditingId || "");
    if (!id) return;
    setError("暂不支持重命名链上分类");
  }

  async function handleUploadFiles(fileList, categoryId) {
    setError("");
    setNotice("");
    if (!account) {
      setError("请先连接钱包");
      return;
    }
    if (!sessionSeedHex) {
      setError("请先解锁档案库");
      setGateOpen(true);
      return;
    }
    bumpActivity();
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage("正在加密并同步至区块链...");
    try {
      for (const file of files) {
        setUploadProgress(10);
        setUploadStage("读取文件并加密...");
        const dataUrl = await fileToBase64(file);
        setUploadProgress(35);
        setUploadStage("上传密文到 IPFS...");
        const categoryObj = categoryById.get(String(categoryId || "")) || DEFAULT_CATEGORIES[0];
        const payload = {
          kind: "archive-file-v1",
          name: file.name || "file",
          type: file.type || "",
          size: file.size || 0,
          dataUrl,
          createdAt: new Date().toISOString(),
          category: String(categoryObj?.name || DEFAULT_CATEGORIES[0].name)
        };
        const cid = await encryptAndUploadWithMasterSeed(payload);
        setUploadProgress(60);
        setUploadStage("提交链上存证交易...");
        const nameEnc = encryptField(sessionSeedHex, payload.name);
        const categoryEnc = encryptField(sessionSeedHex, payload.category);
        const createdAt = Math.floor(Date.now() / 1000);
        await addFileRecord({
          cid,
          nameEnc,
          categoryEnc,
          mime: payload.type,
          size: payload.size,
          createdAt,
          folderId: Number(categoryObj?.folderId || 0)
        });
        setUploadProgress(95);
        setUploadStage("等待链上确认...");
        await refreshFromChain(sessionSeedHex);
      }
      setUploadProgress(100);
      setUploadStage("");
      setNotice("上传完成（已加密并上链）");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setIsUploading(false);
      setIsDragging(false);
      window.setTimeout(() => {
        setUploadProgress(0);
        setUploadStage("");
      }, 400);
    }
  }

  function requestUpload() {
    fileInputRef.current?.click();
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const dt = e.dataTransfer;
    const files = dt?.files;
    if (!files || files.length === 0) return;
    bumpActivity();
    handleUploadFiles(files, activeCategoryId);
  }

  async function openPreview(rec) {
    bumpActivity();
    setSelectedId(rec?.id || "");
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewPayload(null);
    try {
      const raw = await decryptArchivePayloadByCid(rec.cid);
      setPreviewPayload(raw);
    } catch (e) {
      setPreviewError(e?.message || String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function decryptArchivePayloadByCid(cid) {
    const seedHex = sessionSeedHex;
    if (!seedHex) throw new Error("请先解锁档案库");
    const { raw, cipherText } = await fetchEncryptedFromPinataGateway(cid);
    if (!raw || typeof raw !== "object" || typeof raw.fileId !== "string" || typeof raw.ivHex !== "string") {
      if (!cipherText) throw new Error("档案格式不正确");
      throw new Error("档案格式不正确");
    }
    const key = deriveFileKey({ masterSeedHex: seedHex, fileId: raw.fileId });
    const plain = decryptWithDerivedKey({ ciphertext: String(raw.ciphertext || ""), ivHex: raw.ivHex, key });
    const parsed = safeJsonParse(plain, null);
    if (!parsed || typeof parsed !== "object" || !parsed.dataUrl) throw new Error("解密结果格式不正确");
    return parsed;
  }

  function deleteRecord(rec) {
    const id = String(rec?.id || "");
    if (!id) return;
    const ok = window.confirm("确定删除该档案的本地索引？（IPFS 上的加密内容不会被删除）");
    if (!ok) return;
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setSelectedId((prev) => (prev === id ? "" : prev));
    setNotice("档案已删除");
  }

  function openMoveModal() {
    setMoveError("");
    const activeFolderId = Number(activeCategory?.folderId || 0);
    const options = (categories || []).filter((c) => Number(c?.folderId || 0) !== activeFolderId);
    const fallback = options.length ? Number(options[0]?.folderId || 0) : 0;
    setMoveTargetFolderId(fallback);
    setMoveOpen(true);
  }

  function closeMoveModal() {
    setMoveOpen(false);
    setMoveWorking(false);
    setMoveError("");
    setMoveTargetFolderId(0);
  }

  async function confirmMoveFiles() {
    setMoveError("");
    if (!account) {
      setMoveError("请先连接钱包");
      return;
    }
    if (selectedFileIds.size === 0) {
      setMoveError("请先选择文件");
      return;
    }
    const activeFolderId = Number(activeCategory?.folderId || 0);
    const targetFolderId = Number(moveTargetFolderId || 0);
    if (targetFolderId === activeFolderId) {
      setMoveError("不能移动到当前目录");
      return;
    }

    const selected = Array.from(selectedFileIds).map((x) => String(x)).filter(Boolean);
    const selectedSet = new Set(selected);
    const backup = new Map();

    const folderToCategoryId = new Map();
    for (const c of categories || []) {
      if (c?.folderId != null) folderToCategoryId.set(Number(c.folderId), c.id);
    }
    const targetCategoryId = folderToCategoryId.get(targetFolderId) || UNCATEGORIZED.id;

    for (const r of records) {
      if (selectedSet.has(String(r.id))) {
        backup.set(String(r.id), { folderId: Number(r.folderId || 0), categoryId: r.categoryId });
      }
    }

    setMoveWorking(true);
    setNotice(`正在移动至 ${categories.find((c) => Number(c?.folderId || 0) === targetFolderId)?.name || "目标目录"}...`);
    try {
      setRecords((prev) =>
        prev.map((r) => {
          if (!selectedSet.has(String(r.id))) return r;
          return { ...r, folderId: targetFolderId, categoryId: targetCategoryId };
        })
      );
      clearFileSelection();
      bumpActivity();
      await moveFiles({ fileIds: selected.map((x) => Number(x)), targetFolderId });
      setNotice("移动成功");
      closeMoveModal();
      await refreshFromChain(sessionSeedHex);
    } catch (e) {
      setRecords((prev) =>
        prev.map((r) => {
          const b = backup.get(String(r.id));
          if (!b) return r;
          return { ...r, folderId: b.folderId, categoryId: b.categoryId };
        })
      );
      setMoveError(e?.message || String(e));
      setNotice("");
    } finally {
      setMoveWorking(false);
    }
  }

  async function confirmDeleteSelectedFiles() {
    setError("");
    setNotice("");
    if (!account) {
      setError("请先连接钱包");
      return;
    }
    const selected = Array.from(selectedFileIds).map((x) => String(x)).filter(Boolean);
    if (selected.length === 0) return;
    const ok = window.confirm(`确认删除所选 ${selected.length} 个档案？（仅删除链上索引，IPFS 上的加密内容不会被删除）`);
    if (!ok) return;

    const before = records;
    const selectedSet = new Set(selected);
    setDeleteWorking(true);
    try {
      setRecords((prev) => prev.filter((r) => !selectedSet.has(String(r.id))));
      clearFileSelection();
      bumpActivity();
      await deleteFiles({ fileIds: selected.map((x) => Number(x)) });
      setNotice("删除成功");
      await refreshFromChain(sessionSeedHex);
    } catch (e) {
      setRecords(before);
      setError(e?.message || String(e));
    } finally {
      setDeleteWorking(false);
    }
  }

  async function handleGenerateShareLink() {
    setShareError("");
    setShareUrl("");
    setShareExpiresAt(0);
    setShareRemainSec(0);
    setShareOpen(true);
  }

  async function confirmGenerateShareLink() {
    setShareError("");
    if (!selectedRecord) {
      setShareError("请先选择一个档案");
      return;
    }
    setShareWorking(true);
    try {
      bumpActivity();
      const raw = await decryptArchivePayloadByCid(selectedRecord.cid);

      const tempKey = buildShareKey();
      let ttlSec = 5 * 60;
      try {
        const score = await getMyCreditScore();
        if (Number(score?.score || 0) > 80) ttlSec = 30 * 60;
      } catch {
      }
      const plain = JSON.stringify(
        {
          scheme: "archives-share",
          name: raw.name || selectedRecord.name || "archive",
          type: raw.type || selectedRecord.mime || "",
          size: raw.size || selectedRecord.size || 0,
          dataUrl: raw.dataUrl
        },
        null,
        0
      );
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
      setShareUrl(url);
      setShareRemainSec(ttlSec);
      await navigator.clipboard.writeText(url);
    } catch (e) {
      setShareError(e?.message || String(e));
    } finally {
      setShareWorking(false);
    }
  }

  function shareCountdownText() {
    const sec = Math.max(0, Number(shareRemainSec || 0));
    const mm = Math.floor(sec / 60);
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(c.id, 0);
    for (const r of records) map.set(r.categoryId, (map.get(r.categoryId) || 0) + 1);
    return map;
  }, [categories, records]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#0B0E14] px-6 pb-6 pt-3 lg:px-12 lg:pb-12 lg:pt-6 text-slate-200 relative overflow-hidden"
      onMouseMove={bumpActivity}
      onKeyDown={bumpActivity}
      onWheel={bumpActivity}
      onClick={bumpActivity}
    >
      {/* 背景光效 */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* 顶部标题区 */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
              <ShieldCheck className="h-3.5 w-3.5" />
              Archives
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-white/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <ShieldCheck className="h-8 w-8 text-cyan-400" />
              </div>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400">
                Secure Archives
              </span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm max-w-2xl">
              Private encrypted storage on IPFS. Your master seed unlocks your personal data vault.
            </p>
          </div>

          {sessionSeedHex && (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl backdrop-blur-md">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20" />
                <div className="h-2.5 w-2.5 bg-emerald-400 rounded-full shadow-[0_0_10px_#34d399]" />
              </div>
              <div className="text-xs font-mono text-emerald-300">
                VAULT UNLOCKED · AUTO-LOCK IN {formatAutoLock(autoLockRemainSec)}
              </div>
            </div>
          )}
        </div>

        {/* 全局通知区 */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 flex items-center gap-3 text-rose-200"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </motion.div>
          )}
          {notice && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-3 text-emerald-200"
            >
              <Check className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{notice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">

          {/* 左侧边栏 - 分类导航 */}
          <GlassCard className="w-full lg:w-72 shrink-0 flex flex-col h-full">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Categories</span>
              <button
                onClick={openCreateCategory}
                disabled={!account || categorySubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                title="新建分类"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
              {categorySyncing && (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing from chain...
                </div>
              )}

              {categories.map((c) => {
                const active = c.id === activeCategoryId;
                const count = countsByCategory.get(c.id) || 0;
                const pending = Boolean(c.pending);
                const canDelete = !pending && !categorySubmitting && !c.isDefault && Number(c.folderId || 0) > 3 && Number(count || 0) === 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (!pending) {
                        clearFileSelection();
                        setActiveCategoryId(c.id);
                      }
                    }}
                    className={`
                      group flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent
                      ${active
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-100 shadow-[0_0_15px_-5px_rgba(6,182,212,0.3)]"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }
                      ${pending ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Folder className={`h-4 w-4 shrink-0 ${active ? "fill-cyan-500/20 text-cyan-400" : ""}`} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium text-sm">{c.name}</span>
                        {pending && <span className="text-[10px] text-amber-400">Confirming...</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${active ? "text-cyan-400/70" : "text-slate-600 group-hover:text-slate-500"}`}>
                        {count}
                      </span>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCategory(c, count);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* 右侧 - 档案列表区 */}
          <GlassCard className="flex-1 flex flex-col h-full relative">
            {/* 工具栏 */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">{activeCategory?.name || "Files"}</h2>
                {isUploading && (
                  <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-500/20">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-black/30 rounded-lg p-1 border border-white/5">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-4 w-px bg-white/10 mx-1" />

                <NeonButton
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerateShareLink}
                  disabled={!account || !selectedRecord}
                  icon={Share2}
                >
                  Share
                </NeonButton>

                <NeonButton
                  size="sm"
                  variant="cyan"
                  onClick={requestUpload}
                  disabled={!account || isUploading}
                  icon={UploadCloud}
                >
                  Upload
                </NeonButton>
              </div>
            </div>

            {/* 批量操作栏 (Floating) */}
            <AnimatePresence>
              {selectedCount > 0 && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#1a1d26] border border-cyan-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)] rounded-full px-4 py-2"
                >
                  <span className="text-xs font-bold text-slate-300 mr-2">{selectedCount} Selected</span>

                  <button onClick={toggleSelectAllInView} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white" title="Select All">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={openMoveModal} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white" title="Move">
                    <MoveRight className="h-4 w-4" />
                  </button>
                  <button onClick={confirmDeleteSelectedFiles} className="p-1.5 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="w-px h-3 bg-white/10 mx-1" />
                  <button onClick={clearFileSelection} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white" title="Clear">
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 进度条 */}
            <AnimatePresence>
              {(isUploading || uploadStage) && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="bg-cyan-950/20 border-b border-cyan-500/20 overflow-hidden">
                  <div className="px-5 py-2">
                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold mb-1">
                      <span className="text-cyan-400">{uploadStage}</span>
                      <span className="text-cyan-400">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="h-1 bg-black/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 文件列表区域 */}
            <div
              className="flex-1 overflow-y-auto p-5 relative custom-scrollbar"
              onDragEnter={(e) => { e.preventDefault(); if (account) setIsDragging(true); }}
              onDragOver={(e) => { e.preventDefault(); if (account) setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              style={{ opacity: contentOpacity, transition: "opacity 0.2s" }}
            >
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => handleUploadFiles(e.target.files, activeCategoryId)} />

              {/* 拖拽遮罩 */}
              <AnimatePresence>
                {isDragging && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-4 z-30 rounded-2xl border-2 border-dashed border-cyan-500/50 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center pointer-events-none"
                  >
                    <div className="flex flex-col items-center gap-4 text-cyan-400">
                      <UploadCloud className="h-16 w-16 animate-bounce" />
                      <div className="text-xl font-bold">Drop files to upload</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {filtered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <Folder className="h-10 w-10 text-slate-600" />
                  </div>
                  <p className="text-lg font-medium text-slate-400">No files in this category</p>
                  <p className="text-sm mt-1">Upload or drag files here</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((r) => {
                      const active = r.id === selectedId;
                      const kind = getKindFromMime(r.mime, r.name);
                      const checked = selectedFileIds.has(String(r.id));

                      return (
                        <motion.div
                          layout
                          key={r.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => setSelectedId(r.id)}
                          onDoubleClick={() => openPreview(r)}
                          className={`
                            relative group p-4 rounded-2xl border transition-all duration-200 cursor-pointer
                            ${active || checked
                              ? "bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                              : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
                            }
                          `}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                              <FileIconRenderer kind={kind} />
                            </div>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFileSelect(r.id)}
                                className={`
                                  w-5 h-5 rounded border border-slate-600 bg-black/50 checked:bg-cyan-500 checked:border-cyan-500 transition-all cursor-pointer
                                  ${checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                                `}
                              />
                            </div>
                          </div>

                          <h4 className="font-medium text-slate-200 truncate pr-4 mb-1" title={r.name}>{r.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                            <span>{formatBytes(r.size)}</span>
                            <span>•</span>
                            <span>{formatTime(r.createdAt).split(' ')[0]}</span>
                          </div>

                          {/* Quick Action Overlay */}
                          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); openPreview(r); }}
                              className="p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-cyan-400 hover:bg-black/80 border border-white/10"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* List Header */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5 mb-2">
                    <div className="col-span-1 text-center">Select</div>
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {filtered.map((r) => {
                      const active = r.id === selectedId;
                      const kind = getKindFromMime(r.mime, r.name);
                      const checked = selectedFileIds.has(String(r.id));

                      return (
                        <motion.div
                          layout
                          key={r.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          onClick={() => setSelectedId(r.id)}
                          className={`
                            grid grid-cols-12 gap-4 px-4 py-3 rounded-xl items-center cursor-pointer transition-colors text-sm border
                            ${active || checked
                              ? "bg-cyan-500/10 border-cyan-500/20"
                              : "bg-transparent border-transparent hover:bg-white/[0.03]"
                            }
                          `}
                        >
                          <div className="col-span-1 flex justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFileSelect(r.id)}
                              className="w-4 h-4 rounded border-slate-600 bg-black/50 checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer"
                            />
                          </div>
                          <div className="col-span-6 flex items-center gap-3 min-w-0">
                            <FileIconRenderer kind={kind} className="h-5 w-5 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className={`truncate font-medium ${active ? "text-cyan-300" : "text-slate-300"}`}>{r.name}</span>
                              <span className="text-[10px] text-slate-600">{formatTime(r.createdAt)}</span>
                            </div>
                          </div>
                          <div className="col-span-2 text-slate-500 text-xs uppercase">{kind}</div>
                          <div className="col-span-2 text-slate-500 text-xs font-mono">{formatBytes(r.size)}</div>
                          <div className="col-span-1 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); openPreview(r); }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ================= Modals ================= */}

      {/* Gate / Unlock Modal */}
      {gateOpen && (
        <ModalShell title="Security Check" onClose={() => { }} maxWidth="max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <Lock className="h-8 w-8 text-cyan-400" />
            </div>
            <p className="text-slate-400 text-sm">
              Enter your personal password to unlock the encrypted vault. Master seed is cached only for this session.
            </p>
          </div>

          <div className="space-y-6">
            <InputField
              label="Vault Password"
              type="password"
              placeholder="Enter password..."
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmGate()}
              autoFocus
            />

            {gateError && <div className="text-rose-400 text-xs text-center">{gateError}</div>}

            <div className="flex gap-3">
              <NeonButton variant="ghost" className="flex-1" onClick={() => { if (account) clearSessionSeed(account); }}>
                Reset
              </NeonButton>
              <NeonButton variant="cyan" className="flex-1" onClick={confirmGate} disabled={gateWorking || !gatePassword}>
                {gateWorking ? "Unlocking..." : "Unlock Vault"}
              </NeonButton>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Move Modal */}
      {moveOpen && (
        <ModalShell title="Move Files" onClose={closeMoveModal}>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Target Category</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition-colors"
                value={String(moveTargetFolderId)}
                onChange={(e) => setMoveTargetFolderId(Number(e.target.value))}
                disabled={moveWorking}
              >
                {categories
                  .filter((c) => Number(c?.folderId || 0) !== Number(activeCategory?.folderId || 0))
                  .map((c) => (
                    <option key={c.id} value={String(Number(c?.folderId || 0))}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {moveError && <div className="text-rose-400 text-xs">{moveError}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <NeonButton variant="ghost" onClick={closeMoveModal}>Cancel</NeonButton>
              <NeonButton variant="cyan" onClick={confirmMoveFiles} disabled={moveWorking}>
                {moveWorking ? "Moving..." : "Confirm Move"}
              </NeonButton>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Create Category Modal */}
      {categoryModalOpen && (
        <ModalShell title="New Category" onClose={() => setCategoryModalOpen(false)}>
          <div className="space-y-6">
            <InputField
              label="Category Name"
              placeholder="e.g. Financial Docs"
              value={categoryNameDraft}
              onChange={(e) => setCategoryNameDraft(e.target.value)}
              autoFocus
            />

            <div className="flex justify-end gap-3 pt-2">
              <NeonButton variant="ghost" onClick={() => setCategoryModalOpen(false)}>Cancel</NeonButton>
              <NeonButton variant="cyan" onClick={submitCategoryModal} disabled={categorySubmitting}>
                {categorySubmitting ? "Creating..." : "Create"}
              </NeonButton>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Preview Modal */}
      {previewOpen && (
        <ModalShell title="File Preview" onClose={() => { setPreviewOpen(false); setPreviewPayload(null); }} maxWidth="max-w-4xl">
          <div className="space-y-4">
            {previewLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-cyan-400 gap-4">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="text-sm font-mono animate-pulse">Decrypting content...</p>
              </div>
            )}

            {previewError && <div className="p-4 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 text-center">{previewError}</div>}

            {previewPayload && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <FileIconRenderer kind={getKindFromMime(previewPayload.type, previewPayload.name)} />
                    <div>
                      <div className="text-sm font-bold text-white">{previewPayload.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{previewPayload.type} • {formatBytes(previewPayload.size)}</div>
                    </div>
                  </div>
                  <NeonButton size="sm" variant="ghost" onClick={() => {
                    const a = document.createElement('a');
                    a.href = previewPayload.dataUrl;
                    a.download = previewPayload.name || 'download';
                    a.click();
                  }}>
                    Download
                  </NeonButton>
                </div>

                <div className="bg-black/40 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center min-h-[300px]">
                  {getKindFromMime(previewPayload.type, previewPayload.name) === "image" ? (
                    <img src={previewPayload.dataUrl} className="max-h-[70vh] w-auto object-contain" alt="preview" />
                  ) : getKindFromMime(previewPayload.type, previewPayload.name) === "pdf" ? (
                    <iframe src={previewPayload.dataUrl} className="w-full h-[70vh]" title="pdf" />
                  ) : getKindFromMime(previewPayload.type, previewPayload.name) === "video" ? (
                    <video src={previewPayload.dataUrl} controls className="max-h-[70vh] w-full" />
                  ) : getKindFromMime(previewPayload.type, previewPayload.name) === "audio" ? (
                    <audio src={previewPayload.dataUrl} controls className="w-full p-10" />
                  ) : (
                    <div className="text-slate-500">No preview available for this file type</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* Share Modal */}
      {shareOpen && (
        <ModalShell title="Secure Share" onClose={() => setShareOpen(false)}>
          <div className="space-y-6">
            {!shareUrl ? (
              <>
                <p className="text-slate-400 text-sm">
                  Generate a temporary encrypted link for external access. The content will be re-encrypted with a transient key.
                </p>
                {shareError && <div className="text-rose-400 text-xs">{shareError}</div>}
                <div className="flex justify-end gap-3">
                  <NeonButton variant="ghost" onClick={() => setShareOpen(false)}>Cancel</NeonButton>
                  <NeonButton variant="cyan" onClick={confirmGenerateShareLink} disabled={shareWorking}>
                    {shareWorking ? "Generating..." : "Generate Link"}
                  </NeonButton>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Check className="h-4 w-4" /> Link Generated
                  </div>
                  <div className="text-xs text-emerald-300/70">
                    TTL: {shareCountdownText()} (countdown starts when the link is opened).
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Share URL</label>
                  <div
                    className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-300 break-all cursor-pointer hover:bg-black/60 transition-colors"
                    onClick={() => navigator.clipboard.writeText(shareUrl)}
                  >
                    {shareUrl}
                  </div>
                </div>

                <NeonButton variant="cyan" className="w-full" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                  Copy Link
                </NeonButton>
              </>
            )}
          </div>
        </ModalShell>
      )}

    </motion.div>
  );
}
