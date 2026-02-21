import { useEffect, useMemo, useState } from "react";
import { useTrustProtocol } from "../hooks/useTrustProtocol";
import { ethers } from "ethers";
import { getPlatformRevenue, markRevenueWithdraw } from "../services/trustConnectService";
import {
  Wallet,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  Search,
  Building2,
  Activity,
  Loader2,
  Copy,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// 管理员白名单地址配置
const ADMIN_ALLOWLIST = String(import.meta.env.VITE_ADMIN_ALLOWLIST || "")
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

/**
 * 格式化钱包地址
 * @param {string} addr - 完整钱包地址
 * @returns {string} - 格式化后的地址 (0x1234...5678)
 */
function formatAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// -----------------------------------------------------------------------------
// UI Components (Local) - 生产级视觉组件库
// -----------------------------------------------------------------------------

/**
 * 基础骨架屏组件
 * @description 用于构建加载占位符，通过 animate-pulse 实现呼吸效果
 */
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />
);

/**
 * 列表行骨架屏
 * @description 专门用于模拟列表数据的加载状态，提升等待体验
 */
const ListRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/5 mb-3">
    <Skeleton className="h-12 w-12 rounded-full shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
    <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
  </div>
);

/**
 * 增强版玻璃态卡片 - 核心容器组件
 * @description 采用 backdrop-blur 实现毛玻璃效果，叠加渐变边框与光影
 */
const GlassCard = ({ children, className = "", hoverEffect = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className={`
      relative overflow-hidden rounded-3xl border border-white/5 bg-[#12141a]/80 backdrop-blur-2xl
      shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_8px_32px_-8px_rgba(0,0,0,0.5)]
      ${hoverEffect ? "hover:border-cyan-500/20 hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.15)] transition-all duration-500 group" : ""}
      ${className}
    `}
  >
    {/* 顶部高光装饰线 */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
    <div className="relative z-10">{children}</div>
  </motion.div>
);

/**
 * 霓虹按钮 - 核心交互组件
 * @description 支持多种语义化变体 (variant)，内置 Loading 状态与微交互动画
 */
const NeonButton = ({ children, onClick, disabled, variant = "cyan", className = "", icon: Icon }) => {
  const styles = {
    cyan: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]",
    emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]",
    rose: "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]",
    amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    ghost: "bg-transparent text-slate-400 border border-transparent hover:bg-white/5 hover:text-slate-200"
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`
        relative flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide transition-all duration-300
        disabled:opacity-50 disabled:pointer-events-none disabled:grayscale
        ${styles[variant]}
        ${className}
      `}
      onClick={onClick}
      disabled={disabled}
    >
      {disabled && variant === "cyan" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      {children}
    </motion.button>
  );
};

/**
 * 状态徽章 - 视觉反馈组件
 * @description 用于显示状态标签，带有相应颜色的指示点和辉光
 */
const StatusBadge = ({ status, text }) => {
  const styles = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    error: "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]",
    neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20"
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'pending' ? 'animate-pulse bg-amber-400' : status === 'success' ? 'bg-emerald-400' : status === 'error' ? 'bg-rose-400' : 'bg-slate-400'}`} />
      {text}
    </span>
  );
};

/**
 * 科技感输入框 - 表单组件
 * @description 定制的 Input 组件，包含浮动标签、图标和聚焦动效
 */
const InputField = ({ label, value, onChange, placeholder, type = "text", icon: Icon, disabled }) => (
  <div className="space-y-2 group">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-cyan-400 transition-colors duration-300">
      {label}
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors duration-300" />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full rounded-xl border border-white/10 bg-[#0B0E14]/50 py-3 text-sm text-slate-200 placeholder:text-slate-700
          outline-none transition-all duration-300
          focus:border-cyan-500/50 focus:bg-cyan-950/10 focus:shadow-[0_0_20px_rgba(6,182,212,0.1)]
          disabled:opacity-50 disabled:cursor-not-allowed font-mono
          ${Icon ? "pl-10 pr-4" : "px-4"}
        `}
      />
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Main Logic & Page - 页面主逻辑
// -----------------------------------------------------------------------------

export default function AdminGovernance() {
  // 核心业务 Hook - 保持原有逻辑不变
  const {
    account,
    authorizeInstitution,
    revokeInstitution,
    listInstitutions,
    getIssuerApplications,
    approveIssuer,
    rejectIssuer,
    ensureLocalhostChain,
    parseProviderError
  } = useTrustProtocol();

  // 状态管理 - 保持原有 State 结构
  const [error, setError] = useState("");
  const [institutionAddress, setInstitutionAddress] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appInspectOpen, setAppInspectOpen] = useState(false);
  const [appInspectError, setAppInspectError] = useState("");
  const [appInspect, setAppInspect] = useState(null);
  const [appInspectPayload, setAppInspectPayload] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // 财库相关状态
  const treasuryAddress = String(import.meta.env.VITE_TREASURY_ADDRESS || "").trim();
  const [revenueBalance, setRevenueBalance] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [withdrawTo, setWithdrawTo] = useState(String(import.meta.env.VITE_ADMIN_WITHDRAW_TO || "").trim());
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [withdrawWorking, setWithdrawWorking] = useState(false);
  const [withdrawTx, setWithdrawTx] = useState("");
  const [pendingWithdrawMark, setPendingWithdrawMark] = useState(null);

  // IPFS 网关解析
  function ipfsUrl(cid) {
    const c = String(cid || "").trim();
    if (!c) return "";
    const g = import.meta.env.VITE_PINATA_GATEWAY;
    if (g) return `https://${g}/ipfs/${c}`;
    return `https://gateway.pinata.cloud/ipfs/${c}`;
  }

  // 权限校验
  const isAdmin = useMemo(
    () => (account ? ADMIN_ALLOWLIST.includes(String(account).toLowerCase()) : false),
    [account]
  );

  // 数据刷新逻辑
  async function refresh() {
    setError("");
    setIsLoading(true);
    try {
      const list = await listInstitutions();
      setRows(list);
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshApplications() {
    setError("");
    setAppsLoading(true);
    try {
      const list = await getIssuerApplications();
      setApps(list);
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setAppsLoading(false);
    }
  }

  async function refreshRevenue() {
    if (!account) {
      setRevenueBalance(null);
      return;
    }
    setRevenueLoading(true);
    try {
      const res = await getPlatformRevenue({ role: "ADMIN", actorId: account });
      setRevenueBalance(Number(res.balance || 0));
    } catch (e) {
      setRevenueBalance(null);
      setError(String(e?.message || e));
    } finally {
      setRevenueLoading(false);
    }
  }

  // 提现逻辑
  async function withdrawRevenue() {
    setError("");
    setWithdrawTx("");
    setPendingWithdrawMark(null);
    if (!account) return;
    if (!treasuryAddress) {
      setError("缺少 VITE_TREASURY_ADDRESS（请在 frontend/.env 配置）");
      return;
    }
    const to = String(withdrawTo || "").trim();
    const amt = String(withdrawAmount || "").trim();
    if (!to) {
      setError("提现地址不能为空");
      return;
    }
    if (!ethers.isAddress(to)) {
      setError("提现地址无效");
      return;
    }
    if (!amt || Number(amt) <= 0) {
      setError("提现数量无效");
      return;
    }
    const withdrawN = Number(amt);
    if (revenueBalance != null && Number.isFinite(withdrawN) && withdrawN - 1e-9 > Number(revenueBalance || 0)) {
      setError("可提现收益不足");
      return;
    }
    setWithdrawWorking(true);
    try {
      await ensureLocalhostChain();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const withdrawWei = ethers.parseEther(amt);
      const treasuryBalance = await provider.getBalance(treasuryAddress);
      if (withdrawWei > treasuryBalance) {
        setError(`Treasury 合约余额不足（当前 ${ethers.formatEther(treasuryBalance)} ETH）`);
        return;
      }
      const signer = await provider.getSigner();
      const treasury = new ethers.Contract(treasuryAddress, ["function withdrawRevenue(address to, uint256 amount)"], signer);
      const tx = await treasury.withdrawRevenue(to, withdrawWei);
      const receipt = await tx.wait();
      setWithdrawTx(String(receipt?.hash || tx.hash || ""));
      try {
        await markRevenueWithdraw(withdrawN, { role: "ADMIN", actorId: account });
      } catch (e) {
        setPendingWithdrawMark({ amount: withdrawN });
        setError(`链上已提现，但记账失败：${String(e?.message || e)}。可点击“重试记账”修正可提现收益。`);
      }
      setTimeout(() => {
        refreshRevenue();
      }, 1000);
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setWithdrawWorking(false);
    }
  }

  async function retryMarkWithdraw() {
    setError("");
    if (!account) return;
    const n = Number(pendingWithdrawMark?.amount || 0);
    if (!Number.isFinite(n) || n <= 0) return;
    setWithdrawWorking(true);
    try {
      await markRevenueWithdraw(n, { role: "ADMIN", actorId: account });
      setPendingWithdrawMark(null);
      await refreshRevenue();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setWithdrawWorking(false);
    }
  }

  // 初始化副作用
  useEffect(() => {
    if (!account || !isAdmin) return;
    refresh();
    refreshApplications();
    refreshRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, isAdmin]);

  // 操作处理函数
  async function handleAuthorize() {
    setError("");
    setIsSubmitting(true);
    try {
      await authorizeInstitution({ institutionAddress, institutionName });
      setInstitutionAddress("");
      setInstitutionName("");
      await refresh();
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(addr) {
    setError("");
    setIsSubmitting(true);
    try {
      await revokeInstitution({ institutionAddress: addr });
      await refresh();
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestore(row) {
    setError("");
    const addr = String(row?.address || "").trim();
    const name = String(row?.name || "").trim();
    if (!addr) return;
    if (!name) {
      setInstitutionAddress(addr);
      setInstitutionName("");
      setError("请在右侧填写机构名称后点击 Authorize Access 以恢复活跃状态");
      return;
    }
    setIsSubmitting(true);
    try {
      await authorizeInstitution({ institutionAddress: addr, institutionName: name });
      await refresh();
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openInspect(app) {
    setAppInspect(app || null);
    setAppInspectOpen(true);
    setAppInspectError("");
    setAppInspectPayload(null);
    setRejectReason("");
    try {
      const cid = String(app?.metadataCID || "").trim();
      if (!cid) throw new Error("缺少 metadataCID");
      const res = await fetch(ipfsUrl(cid));
      if (!res.ok) throw new Error("拉取 metadata 失败");
      const json = await res.json();
      setAppInspectPayload(json);
    } catch (e) {
      setAppInspectError(String(e?.message || e));
    }
  }

  async function handleApproveIssuer(app) {
    setError("");
    setIsSubmitting(true);
    try {
      const applicant = String(app?.applicant || "").trim();
      if (!applicant) throw new Error("缺少 applicant");
      const cid = String(app?.metadataCID || "").trim();
      if (cid) {
        try {
          const res = await fetch(ipfsUrl(cid));
          if (res.ok) {
            const json = await res.json();
            const name = String(json?.issuerName || "").trim();
            if (name) {
              await authorizeInstitution({ institutionAddress: applicant, institutionName: name });
            }
          }
        } catch {
        }
      }
      await approveIssuer({ applicant });
      await Promise.all([refresh(), refreshApplications()]);
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectIssuer(applicant) {
    setError("");
    setIsSubmitting(true);
    try {
      await rejectIssuer({ applicant, reason: rejectReason });
      setAppInspectOpen(false);
      await refreshApplications();
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render Logic - 渲染视图
  // ---------------------------------------------------------------------------

  // 未连接钱包状态
  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E14] p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)] pointer-events-none" />
        <GlassCard className="max-w-md w-full p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-900/50 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <ShieldCheck className="h-10 w-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Admin Governance</h1>
          <p className="text-slate-400 mb-8">Please connect your wallet to access the administration panel.</p>
        </GlassCard>
      </div>
    );
  }

  // 无权限状态 (403)
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E14] p-6">
        <GlassCard className="max-w-md w-full p-10 text-center border-rose-500/20">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-900/20 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <AlertTriangle className="h-10 w-10 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">403 Forbidden</h1>
          <p className="text-slate-400 mb-6">Access Restricted. Your address is not on the admin allowlist.</p>
          <div className="font-mono text-xs text-rose-300 bg-rose-950/30 px-4 py-2 rounded-lg border border-rose-500/10 break-all">
            {account}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-[#0B0E14] px-6 pb-6 pt-3 lg:px-12 lg:pb-12 lg:pt-6 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* 全局背景光斑特效 */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* 头部区域 & 错误提示 */}
        <div className="lg:col-span-12 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
                <ShieldCheck className="h-3.5 w-3.5" />
                Governance
              </div>
              <h1 className="text-4xl font-bold tracking-tight flex items-center gap-4 text-white">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <ShieldCheck className="h-8 w-8 text-cyan-400" />
                </div>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400">
                  Governance Console
                </span>
              </h1>
              <p className="mt-2 text-slate-400 font-light tracking-wide ml-16">
                Manage platform institutions, authorizations, and treasury.
              </p>
            </motion.div>

            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <NeonButton
                onClick={() => {
                  refresh();
                  refreshApplications();
                  refreshRevenue();
                }}
                disabled={isLoading || appsLoading || isSubmitting || revenueLoading || withdrawWorking}
                icon={RefreshCw}
                variant="cyan"
                className="px-6 py-3"
              >
                {isLoading ? "Syncing Network..." : "Synchronize Data"}
              </NeonButton>
            </motion.div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 flex items-center gap-3"
              >
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                <span className="text-sm text-rose-200 font-mono">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================= 左侧 (8格) ================= */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* 1. 财库部分 (Treasury Section) */}
          <GlassCard className="p-1 relative group" hoverEffect={true}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />

            <div className="bg-[#0B0E14]/60 backdrop-blur-xl rounded-xl p-5 border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <Wallet className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">Treasury & Revenue</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="uppercase tracking-wider">Contract</span>
                      <span className="font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">{formatAddress(treasuryAddress)}</span>
                      <a href={`https://etherscan.io/address/${treasuryAddress}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3 hover:text-cyan-400 cursor-pointer transition-colors" />
                      </a>
                    </div>
                  </div>
                </div>
                <button onClick={refreshRevenue} disabled={revenueLoading} className="text-slate-500 hover:text-cyan-400 transition-colors">
                  <RefreshCw className={`h-4 w-4 ${revenueLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="grid gap-10 lg:grid-cols-2">
                {/* 余额显示 */}
                <div className="relative flex flex-col justify-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-8 overflow-hidden group/treasury">
                  {/* 动态光晕 */}
                  <div className="absolute -inset-10 bg-cyan-500/20 blur-[60px] opacity-0 group-hover/treasury:opacity-100 transition-opacity duration-700" />

                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Building2 className="h-24 w-24 text-white transform rotate-12 translate-x-4 translate-y-[-10px]" />
                  </div>
                  <div className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2 relative z-10">
                    <Activity className="h-3 w-3 text-emerald-400" />
                    Withdrawable Revenue
                  </div>
                  <div className="relative z-10">
                    <div className="text-6xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-white tracking-tighter drop-shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse">
                      {revenueBalance == null ? "---" : `${Number(revenueBalance || 0).toFixed(4)}`}
                      <span className="text-2xl text-slate-600 ml-3 font-light">ETH</span>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-3 text-xs text-slate-500 bg-black/20 w-fit px-3 py-1.5 rounded-full border border-white/5 relative z-10">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    Real-time accumulation from protocol fees
                  </div>
                </div>

                {/* 提现表单 */}
                <div className="flex flex-col gap-6 justify-center">
                  <div className="space-y-5">
                    <InputField
                      label="Recipient Address"
                      icon={Wallet}
                      value={withdrawTo}
                      onChange={(e) => setWithdrawTo(e.target.value)}
                      placeholder="0x..."
                      disabled={withdrawWorking}
                    />
                    <InputField
                      label="Amount (ETH)"
                      type="number"
                      icon={Download}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={withdrawWorking}
                    />
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <NeonButton
                      variant="cyan"
                      onClick={withdrawRevenue}
                      disabled={withdrawWorking || !treasuryAddress}
                      className="flex-1 py-3 hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all duration-300"
                      icon={withdrawWorking ? RefreshCw : ArrowRight}
                    >
                      {withdrawWorking ? "Processing Withdrawal..." : "Withdraw Funds"}
                    </NeonButton>

                    {pendingWithdrawMark && (
                      <NeonButton
                        variant="amber"
                        onClick={retryMarkWithdraw}
                        disabled={withdrawWorking}
                      >
                        Retry Record
                      </NeonButton>
                    )}
                  </div>

                  <AnimatePresence>
                    {withdrawTx && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono break-all flex items-start gap-2"
                      >
                        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>Tx: {withdrawTx}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* 2. 已授权列表 (Authorized Institutions) */}
          <GlassCard className="p-8" hoverEffect={true}>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
              <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              </div>
              Authorized Institutions
            </h2>
            <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar min-h-0">
              {isLoading ? (
                // 加载状态：显示 3 个骨架屏
                <>
                  <ListRowSkeleton />
                  <ListRowSkeleton />
                  <ListRowSkeleton />
                </>
              ) : rows.length === 0 ? (
                // 空状态
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl bg-white/5">
                  <div className="text-slate-500 text-sm">No authorized institutions found.</div>
                </div>
              ) : (
                // 数据列表
                rows.map((r) => (
                  <motion.div
                    key={r.address}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:scale-[1.01] hover:bg-white/[0.04] hover:border-cyan-500/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-white/10 text-white font-bold text-xl shadow-lg">
                        {r.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white text-lg">{r.name || "Unnamed"}</span>
                          {r.isActive ? (
                            <StatusBadge status="success" text="Active" />
                          ) : (
                            <StatusBadge status="neutral" text="Inactive" />
                          )}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-500 group-hover:text-cyan-400 transition-colors cursor-pointer">
                          {r.address}
                        </div>
                      </div>
                    </div>

                    {r.isActive ? (
                      <NeonButton
                        variant="rose"
                        onClick={() => handleRevoke(r.address)}
                        disabled={isSubmitting}
                        className="text-xs hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-all active:scale-90"
                        icon={XCircle}
                      >
                        Revoke
                      </NeonButton>
                    ) : (
                      <NeonButton
                        variant="emerald"
                        onClick={() => handleRestore(r)}
                        disabled={isSubmitting}
                        className="text-xs hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/50 transition-all active:scale-90"
                        icon={RefreshCw}
                      >
                        Restore
                      </NeonButton>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* ================= 右侧 (4格) ================= */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* 3. 授权表单 (Authorize Institution) */}
          <GlassCard className="p-8 h-fit" hoverEffect={true}>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
              <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                <UserCheck className="h-5 w-5 text-emerald-400" />
              </div>
              Authorize Institution
            </h2>
            <div className="space-y-6">
              <InputField
                label="Wallet Address"
                icon={Wallet}
                value={institutionAddress}
                onChange={(e) => setInstitutionAddress(e.target.value)}
                placeholder="0x..."
                disabled={isSubmitting}
              />
              <InputField
                label="Institution Name"
                icon={Building2}
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. Acme Corp"
                disabled={isSubmitting}
              />
              <div className="pt-2">
                <NeonButton
                  variant="emerald"
                  onClick={handleAuthorize}
                  disabled={isSubmitting || !institutionAddress.trim() || !institutionName.trim()}
                  className="w-full py-3"
                  icon={ShieldCheck}
                >
                  {isSubmitting ? "Processing..." : "Authorize Access"}
                </NeonButton>
              </div>
            </div>
          </GlassCard>

          {/* 4. 待办申请 (Pending Applications) */}
          <GlassCard className="p-8" hoverEffect={true}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
                  <FileText className="h-5 w-5 text-amber-400" />
                </div>
                Pending Apps
              </h2>
              <div className="text-xs text-slate-500 font-mono">
                Total: {apps.length}
              </div>
            </div>

            <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar min-h-0">
              <AnimatePresence mode="popLayout">
                {appsLoading ? (
                  // 加载状态
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ListRowSkeleton />
                    <ListRowSkeleton />
                  </motion.div>
                ) : apps.length === 0 ? (
                  // 空状态
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 border border-dashed border-white/10 rounded-xl bg-white/5"
                  >
                    <div className="text-slate-500 text-sm">No pending applications.</div>
                  </motion.div>
                ) : (
                  // 申请列表
                  apps.map((a) => (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="group relative rounded-xl border border-white/5 bg-white/5 p-5 hover:border-cyan-500/30 hover:bg-white/10 transition-all duration-300"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 justify-between">
                            <span className="text-white font-medium tracking-wide">#{a.id}</span>
                            {a.status === 0 ? (
                              <StatusBadge status="pending" text="Pending" />
                            ) : a.status === 1 ? (
                              <StatusBadge status="success" text="Approved" />
                            ) : (
                              <StatusBadge status="error" text="Rejected" />
                            )}
                          </div>
                          <div className="flex flex-col gap-2 text-xs font-mono text-slate-500">
                            <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded border border-white/5 w-fit">
                              <UserCheck className="h-3 w-3 text-slate-400" />
                              {formatAddress(a.applicant)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <NeonButton
                            variant="ghost"
                            onClick={() => openInspect(a)}
                            disabled={isSubmitting}
                            icon={Search}
                            className="text-xs px-2 py-1.5"
                          >
                            Inspect
                          </NeonButton>
                          <NeonButton
                            variant="emerald"
                            onClick={() => handleApproveIssuer(a)}
                            disabled={isSubmitting || a.status !== 0}
                            icon={CheckCircle}
                            className="text-xs px-2 py-1.5"
                          >
                            Approve
                          </NeonButton>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </GlassCard>

        </div>

      </div>

      {/* 4. 详情审查弹窗 (Inspect Modal) */}
      <AnimatePresence>
        {appInspectOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl border border-white/10 bg-[#131823] shadow-2xl shadow-black/50 overflow-hidden"
            >
              {/* 弹窗头部 */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 p-6 bg-white/5">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">Application Review</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span className="bg-white/10 px-1.5 py-0.5 rounded">ID: #{appInspect?.id}</span>
                    <span className="text-slate-600">|</span>
                    <span>Applicant: {formatAddress(appInspect?.applicant)}</span>
                  </div>
                </div>
                <button
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  onClick={() => setAppInspectOpen(false)}
                  disabled={isSubmitting}
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {/* 弹窗内容 */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {appInspectError ? (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200 flex gap-2 items-center">
                    <AlertTriangle className="h-4 w-4" />
                    {appInspectError}
                  </div>
                ) : null}

                {appInspectPayload ? (
                  <>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-6">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Organization Info</div>
                          <div className="text-2xl font-bold text-white mb-1">{appInspectPayload.issuerName || "-"}</div>
                          <div className="text-sm text-slate-400">
                            Submitted: {appInspectPayload.submittedAt ? new Date(appInspectPayload.submittedAt).toLocaleString() : "-"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">Metadata JSON</div>
                          <div className="grid gap-2">
                            {(Object.entries(appInspectPayload || {})
                              .filter(([k]) => k !== "documents")
                              .filter(([, v]) => v == null || ["string", "number", "boolean"].includes(typeof v))
                              .slice(0, 10)
                              .map(([k, v]) => (
                                <div
                                  key={k}
                                  className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-black/20 px-3 py-2"
                                >
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    {k}
                                  </div>
                                  <div className="text-xs font-mono text-slate-200 text-right break-all">
                                    {String(v)}
                                  </div>
                                </div>
                              )))}
                          </div>
                          <details className="mt-4 rounded-xl border border-white/5 bg-black/20">
                            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">
                              View Raw JSON
                            </summary>
                            <div className="px-3 pb-3">
                              <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto">
                                {JSON.stringify(appInspectPayload, null, 2)}
                              </pre>
                            </div>
                          </details>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 h-full">
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">Attached Documents</div>
                        <div className="space-y-3">
                          {(appInspectPayload.documents || []).length === 0 ? (
                            <div className="text-sm text-slate-500 italic text-center py-10">No documents attached</div>
                          ) : (
                            (appInspectPayload.documents || []).map((d, idx) => (
                              <a
                                key={`${d.shareUrl || idx}`}
                                className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-white/5 hover:border-cyan-500/30 transition-all group"
                                href={d.shareUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                                    <FileText className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="text-sm text-slate-200 font-bold group-hover:text-cyan-300 transition-colors">{d.name || `Document ${idx + 1}`}</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{d.category || "General"}</div>
                                  </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400 -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all" />
                              </a>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mt-2">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">Review Decision</div>
                      <textarea
                        className="w-full min-h-[100px] rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white placeholder:text-slate-600 outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 transition-all mb-6 resize-none"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Enter rejection reason if applicable..."
                        disabled={isSubmitting}
                      />
                      <div className="flex items-center justify-end gap-4">
                        <NeonButton
                          variant="rose"
                          onClick={() => handleRejectIssuer(appInspect?.applicant)}
                          disabled={isSubmitting || appInspect?.status !== 0}
                          icon={XCircle}
                        >
                          Reject Application
                        </NeonButton>
                        <NeonButton
                          variant="emerald"
                          onClick={() => handleApproveIssuer(appInspect)}
                          disabled={isSubmitting || appInspect?.status !== 0}
                          icon={CheckCircle}
                        >
                          Approve Application
                        </NeonButton>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCw className="h-10 w-10 text-cyan-500 animate-spin mb-4" />
                    <div className="text-slate-400 animate-pulse">Decrypting secure metadata from IPFS...</div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
