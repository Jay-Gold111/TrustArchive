import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTrustProtocol } from "../hooks/useTrustProtocol";

function formatAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// --- Icons (SVG) ---
const Icons = {
  Dashboard: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
  ),
  TrustConnect: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
  ),
  Notary: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  Credentials: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>
  ),
  Issuer: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 21h18" /><path d="M5 21V7l8-4 8 4v14" /><path d="M17 21v-8.5a1.5 1.5 0 0 0-1.5-1.5h-7a1.5 1.5 0 0 0-1.5 1.5V21" /></svg>
  ),
  Admin: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
  ),
  Profile: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  Archives: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
  ),
  Wallet: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
  )
};

function SidebarLink({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick}>
      {({ isActive }) => (
        <div className={`group/link relative flex h-14 w-full items-center px-6 transition-all duration-300 overflow-hidden text-sm
          ${isActive ? "bg-cyan-500/[0.08] text-cyan-400" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}>

          {/* Active Accent Line */}
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] transition-transform duration-300 origin-left 
            ${isActive ? "bg-cyan-400 scale-x-100 shadow-[0_0_12px_rgba(34,211,238,0.8)]" : "bg-white/20 scale-x-0 group-hover/link:scale-x-100"}`}
          />

          {/* Active Ambient Glow */}
          <div className={`absolute inset-0 bg-gradient-to-r from-cyan-500/15 to-transparent transition-opacity duration-300 pointer-events-none
            ${isActive ? "opacity-100" : "opacity-0"}`}
          />

          <div className={`relative z-10 flex min-w-[28px] items-center justify-center transition-all duration-300 
            ${isActive ? "drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] scale-110" : "group-hover/link:translate-x-1"}`}>
            <Icon strokeWidth={isActive ? 2 : 1.5} className="h-5 w-5" />
          </div>

          <span className={`relative z-10 ml-4 whitespace-nowrap opacity-0 transition-[opacity,transform] duration-300 group-hover:block group-hover:opacity-100 group-hover:translate-x-0 -translate-x-4 hidden tracking-wide ${isActive ? "font-semibold" : "font-medium"}`}>
            {label}
          </span>
        </div>
      )}
    </NavLink>
  );
}

const ADMIN_ALLOWLIST = String(import.meta.env.VITE_ADMIN_ALLOWLIST || "")
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

export default function MainLayout() {
  const {
    account,
    connectWallet,
    isConnecting,
    isInstitution,
    securityModal,
    closeSecurityModal,
    initSecurityCenter,
    recoverMasterSeed
  } = useTrustProtocol();

  const location = useLocation();

  const [personalPassword, setPersonalPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [issuerOk, setIssuerOk] = useState(false);

  // State to temporarily block hover after clicking a link
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavClick = () => {
    setIsNavigating(true);
    // Re-enable hover after a short delay (enough time for transition to finish)
    setTimeout(() => setIsNavigating(false), 500);
  };

  useEffect(() => {
    if (securityModal?.open) {
      setPersonalPassword("");
      setModalError("");
      setIsWorking(false);
    }
  }, [securityModal?.open]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!account) {
        setIssuerOk(false);
        return;
      }
      try {
        const ok = await isInstitution(account);
        if (!cancelled) setIssuerOk(Boolean(ok));
      } catch {
        if (!cancelled) setIssuerOk(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [account, isInstitution]);

  async function handleConfirm() {
    setModalError("");
    setIsWorking(true);
    try {
      if (securityModal?.mode === "recover") {
        await recoverMasterSeed({ personalPassword });
      } else {
        await initSecurityCenter({ personalPassword });
      }
    } catch (e) {
      setModalError(e?.message || String(e));
      setIsWorking(false);
    }
  }

  const isAdmin = account ? ADMIN_ALLOWLIST.includes(String(account).toLowerCase()) : false;

  // Reduced blur class for main container
  const mainBlurClass = "transition-all duration-500 peer-hover:blur-[2px] peer-hover:brightness-75";

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 pl-20">
      {/* 
        Fixed Cyberpunk Sidebar
        If `isNavigating` is true, we force `pointer-events-none` so the sidebar instantly loses its 'hover' state 
        and collapses back to its icon-only mode.
      */}
      <aside
        className={`group peer fixed left-0 top-0 z-[60] flex h-screen w-20 flex-col border-r border-white/5 bg-[#0B0E14]/80 backdrop-blur-3xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[4px_0_24px_rgba(0,0,0,0.2)]
        ${isNavigating ? 'w-20 pointer-events-none' : 'hover:w-72'}`}
      >
        {/* Subtly glowing right edge on hover */}
        <div className="absolute top-0 bottom-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Background Overlay (Tech Grid) */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-r-2xl" />

        {/* Logo / Header Area */}
        <div className="relative z-10 flex h-24 shrink-0 items-center border-b border-white/5 px-6">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#06b6d4] to-[#4f46e5] text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)] overflow-hidden group-hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-shadow duration-500">
            {/* Shimmer overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
            <span className="relative z-10 text-xl font-black">T</span>
          </div>
          <div className="ml-4 whitespace-nowrap opacity-0 transition-[opacity,transform] duration-500 group-hover:block group-hover:opacity-100 group-hover:translate-x-0 -translate-x-4 hidden">
            <div className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">TrustArchive</div>
            <div className="text-[10px] text-cyan-400/80 uppercase tracking-[0.2em] font-medium mt-0.5">Verifiable System</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="relative z-10 flex-1 py-6 flex flex-col gap-1">
          <SidebarLink to="/" label="Dashboard" icon={Icons.Dashboard} end={true} onClick={handleNavClick} />
          <SidebarLink to="/connect/requirements" label="TrustConnect" icon={Icons.TrustConnect} onClick={handleNavClick} />
          <SidebarLink to="/notary" label="Cloud Notary" icon={Icons.Notary} onClick={handleNavClick} />
          <SidebarLink to="/credentials" label="Credential Center" icon={Icons.Credentials} onClick={handleNavClick} />
          <SidebarLink to="/archives" label="Archives" icon={Icons.Archives} onClick={handleNavClick} />
          <SidebarLink to="/profile" label="Profile" icon={Icons.Profile} onClick={handleNavClick} />
          {issuerOk ? <SidebarLink to="/issuer" label="Issuer Dashboard" icon={Icons.Issuer} onClick={handleNavClick} /> : null}
          {isAdmin ? <SidebarLink to="/admin/governance" label="Governance" icon={Icons.Admin} onClick={handleNavClick} /> : null}
        </nav>

        {/* Wallet Connection (Bottom) */}
        <div className="relative z-10 border-t border-white/5 p-4 bg-white/[0.01]">
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className={`group/btn relative flex w-full h-12 items-center rounded-xl overflow-hidden p-3 transition-colors ${isConnecting ? "cursor-wait opacity-50" : ""
              }`}
          >
            {/* Button Background & Hover */}
            <div className="absolute inset-0 bg-white/5 transition-opacity duration-300 group-hover/btn:bg-white/10" />

            <div className={`relative flex h-10 w-10 -translate-x-2 shrink-0 items-center justify-center rounded-lg bg-black/20 border border-white/10 text-cyan-400 group-hover/btn:border-cyan-500/50 group-hover/btn:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all duration-300`}>
              <Icons.Wallet className="w-5 h-5" />
            </div>
            <div className="relative ml-3 overflow-hidden whitespace-nowrap opacity-0 transition-[opacity,transform] duration-500 group-hover:block group-hover:opacity-100 group-hover:translate-x-0 -translate-x-4 hidden text-left">
              <div className="text-sm font-medium text-slate-200 group-hover/btn:text-white transition-colors">
                {account ? formatAddress(account) : "Connect Wallet"}
              </div>
              {account ? (
                <div className="text-[10px] text-emerald-400 tracking-wider uppercase mt-0.5 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_currentColor]" />
                  Connected
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 tracking-wider uppercase mt-0.5">
                  Network Disconnected
                </div>
              )}
            </div>
          </button>
        </div>
      </aside>

      <div className={["/", "/admin/governance", "/issuer", "/archives", "/notary", "/credentials", "/profile"].some(path => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)) ? `w-full ${mainBlurClass}` : `mx-auto flex max-w-6xl gap-6 px-4 py-8 ${mainBlurClass}`}>
        {/*
           Originally <aside className="w-64 shrink-0"> ... </aside> was here.
           We removed it from the flow as requested to make it fixed.
           The <main> takes up the rest.
        */}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {securityModal?.open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
              <div className="text-sm font-semibold text-slate-50">{securityModal.title || "安全中心"}</div>
              <button
                type="button"
                className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900"
                onClick={closeSecurityModal}
                disabled={isWorking}
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {securityModal.message ? <div className="text-sm text-slate-300">{securityModal.message}</div> : null}

              <div className="mt-4 grid gap-2">
                <label className="text-sm font-medium text-slate-200">个人密码</label>
                <input
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-slate-500"
                  type="password"
                  value={personalPassword}
                  onChange={(e) => setPersonalPassword(e.target.value)}
                  placeholder="用于解锁/包装 Master Seed"
                  disabled={isWorking}
                />
                <div className="text-xs text-slate-400">
                  该密码仅在本地用于解密“种子信封”，不会上传到任何服务器。
                </div>
              </div>

              {modalError ? (
                <div className="mt-4 rounded-xl border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-200">
                  {modalError}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-60"
                  onClick={closeSecurityModal}
                  disabled={isWorking}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-60"
                  onClick={handleConfirm}
                  disabled={isWorking || !personalPassword}
                >
                  {isWorking ? "处理中..." : securityModal?.mode === "recover" ? "恢复" : "初始化"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
