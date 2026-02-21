import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
    ShieldCheck,
    FileText,
    Award,
    User,
    Archive,
    RefreshCw,
    Wallet,
    ArrowRight
} from "lucide-react";
import { GlassCard, NeonButton } from "../ui/GlassKit";
import { TrustScoreRing } from "./TrustScoreRing";

const getTheme = (colorUrl) => {
    if (colorUrl.includes("cyan")) return { bg: "bg-cyan-500", textHover: "group-hover:text-cyan-400", textMuted: "text-cyan-500/50", borderHover: "group-hover:border-cyan-500/50" };
    if (colorUrl.includes("purple")) return { bg: "bg-purple-500", textHover: "group-hover:text-purple-400", textMuted: "text-purple-500/50", borderHover: "group-hover:border-purple-500/50" };
    if (colorUrl.includes("emerald")) return { bg: "bg-emerald-500", textHover: "group-hover:text-emerald-400", textMuted: "text-emerald-500/50", borderHover: "group-hover:border-emerald-500/50" };
    if (colorUrl.includes("amber")) return { bg: "bg-amber-500", textHover: "group-hover:text-amber-400", textMuted: "text-amber-500/50", borderHover: "group-hover:border-amber-500/50" };
    return { bg: "bg-cyan-500", textHover: "group-hover:text-cyan-400", textMuted: "text-cyan-500/50", borderHover: "group-hover:border-cyan-500/50" };
};

const NavCard = ({ to, title, description, icon: Icon, color }) => {
    const theme = getTheme(color);
    return (
        <Link to={to} className="block group relative w-full h-full">
            {/* Hover Ambient Glow */}
            <div className={`absolute -inset-0.5 rounded-2xl ${theme.bg} opacity-0 group-hover:opacity-20 blur-xl transition-all duration-700 ease-out`} />

            {/* Main Card Container */}
            <div className={`relative z-10 h-full p-8 bg-white/[0.03] backdrop-blur-3xl rounded-2xl border border-white/10 ${theme.borderHover} group-hover:bg-white/[0.06] overflow-hidden flex flex-col justify-between transition-all duration-500 group-hover:-translate-y-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)]`}>

                {/* Top Right Radial Gradient for depth */}
                <div className={`absolute top-0 right-0 w-32 h-32 ${theme.bg} opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-all duration-700 ease-out`} />

                {/* Tech Grid Background (Subtle) */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="relative z-20">
                    {/* Icon Container */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-white/[0.03] border border-white/10 ${theme.borderHover} transition-all duration-500 relative overflow-hidden group-hover:bg-white/[0.05]`}>
                        <div className={`absolute inset-0 ${theme.bg} opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-md`} />
                        <Icon strokeWidth={1.5} className={`w-6 h-6 text-slate-300 ${theme.textHover} transition-colors duration-500 relative z-10`} />
                    </div>

                    {/* Text Content */}
                    <h3 className={`text-xl font-bold text-slate-100 ${theme.textHover} flex items-center gap-2 transition-colors duration-500 tracking-wide`}>
                        {title}
                    </h3>
                    <p className="mt-4 text-sm text-slate-400 group-hover:text-slate-300 transition-colors duration-500 leading-relaxed font-light">
                        {description}
                    </p>
                </div>

                {/* Bottom Tech/Web3 Accent line */}
                <div className="relative z-20 mt-10 flex items-center gap-3">
                    <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${theme.textMuted} ${theme.textHover} transition-colors duration-500`}>
                        Launch App
                    </span>
                    <div className="flex-1 h-px bg-white/5 relative overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 w-8 ${theme.bg} opacity-0 group-hover:opacity-100 -translate-x-full group-hover:translate-x-[500%] transition-transform duration-1000 ease-in-out`} />
                        <div className={`absolute inset-y-0 left-0 h-full ${theme.bg} opacity-50 w-0 group-hover:w-full transition-all duration-700 ease-out`} />
                    </div>
                    <ArrowRight className={`w-4 h-4 ${theme.textMuted} opacity-0 -translate-x-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0 ${theme.textHover}`} />
                </div>
            </div>
        </Link>
    );
};

export default function DashboardContent({
    account,
    trustData,
    trustLoading,
    refreshTrust,
    walletBalance,
    walletLoading,
    refreshWallet,
    setRechargeOpen
}) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="relative z-20 h-full bg-dark-bg/95 backdrop-blur-3xl py-10 flex flex-col justify-center">

            {/* Dynamic Silky Wave Separator */}
            <div className="absolute top-0 bottom-0 left-0 w-full md:w-[100%] z-0 pointer-events-none overflow-hidden transform -rotate-[90deg] origin-top-left scale-[1.8] translate-y-[245%] -translate-x-[0%]">
                <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="waveGradient" x1="0%" y1="50%" x2="100%" y2="50%">
                            <stop offset="0%" stopColor="#0B0E14" stopOpacity="0.98" />
                            <stop offset="60%" stopColor="#0B0E14" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.1" />
                        </linearGradient>
                        <linearGradient id="rimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="transparent" />
                            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.8" />
                        </linearGradient>
                        <mask id="fadeMask">
                            <linearGradient id="fadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="white" stopOpacity="1" />
                                <stop offset="80%" stopColor="white" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="black" stopOpacity="0" />
                            </linearGradient>
                            <rect x="0" y="0" width="100%" height="100%" fill="url(#fadeGrad)" />
                        </mask>
                    </defs>

                    {/* Layer 0: Animated Floating Particles for Data Flow Feel */}
                    <g mask="url(#fadeMask)">
                        {[...Array(20)].map((_, i) => (
                            <motion.circle
                                key={i}
                                r={Math.random() * 0.5 + 0.2}
                                fill="#00F0FF"
                                initial={{
                                    cx: Math.random() * 60,
                                    cy: Math.random() * 100,
                                    opacity: Math.random() * 0.5 + 0.2,
                                }}
                                animate={{
                                    cy: [null, Math.random() * 100],
                                    opacity: [null, Math.random() * 0.5 + 0.2],
                                }}
                                transition={{
                                    duration: Math.random() * 10 + 10,
                                    repeat: Infinity,
                                    ease: "linear",
                                    repeatType: "mirror"
                                }}
                            />
                        ))}
                    </g>

                    {/* Layer 1: Main Dark Glass Body */}
                    <motion.path
                        fill="url(#waveGradient)"
                        initial={{ d: "M0 0 L60 0 C75 20 45 40 65 60 C80 80 55 90 65 100 L0 100 Z" }}
                        animate={{
                            d: [
                                "M0 0 L60 0 C75 20 45 40 65 60 C80 80 55 90 65 100 L0 100 Z",
                                "M0 0 L65 0 C55 25 75 45 55 65 C40 85 70 90 60 100 L0 100 Z",
                                "M0 0 L58 0 C70 15 50 35 70 55 C85 75 50 95 65 100 L0 100 Z",
                                "M0 0 L60 0 C75 20 45 40 65 60 C80 80 55 90 65 100 L0 100 Z"
                            ]
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Layer 2: Sharp Neon Rim Light */}
                    <motion.path
                        fill="none"
                        stroke="url(#rimGradient)"
                        strokeWidth="0.8"
                        initial={{ d: "M60 0 C75 20 45 40 65 60 C80 80 55 90 65 100" }}
                        animate={{
                            d: [
                                "M60 0 C75 20 45 40 65 60 C80 80 55 90 65 100",
                                "M65 0 C55 25 75 45 55 65 C40 85 70 90 60 100",
                                "M58 0 C70 15 50 35 70 55 C85 75 50 95 65 100",
                                "M60 0 C75 20 45 40 65 60 C80 80 55 90 65 100"
                            ]
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                        style={{ filter: "drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))" }}
                    />

                    {/* Layer 3: Secondary "Ghost" Wave for Depth */}
                    <motion.path
                        fill="url(#rimGradient)"
                        initial={{ d: "M0 0 L55 0 C65 25 40 45 60 65 C70 85 50 95 55 100 L0 100 Z" }}
                        animate={{
                            d: [
                                "M0 0 L55 0 C65 25 40 45 60 65 C70 85 50 95 55 100 L0 100 Z",
                                "M0 0 L60 0 C50 20 70 40 50 60 C35 80 65 90 55 100 L0 100 Z",
                                "M0 0 L55 0 C65 25 40 45 60 65 C70 85 50 95 55 100 L0 100 Z"
                            ]
                        }}
                        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="opacity-10 mix-blend-color-dodge"
                    />
                </svg>
            </div>

            <div className="container mx-auto px-6 lg:px-12">

                {/* Stats Section */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-100px" }}
                    className="flex flex-col md:flex-row items-stretch gap-6 mb-16"
                >
                    {/* Left Side: Welcome and Network Status */}
                    <motion.div variants={item} className="flex-1 flex flex-col justify-center">
                        <div className="mb-2">
                            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                                Welcome Back,
                            </h2>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-mono text-lg font-medium">
                                    {account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : "Traveler"}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3">
                            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                                Your decentralized identity hub. Manage credentials, view trust scores, and interact securely on-chain.
                            </p>

                            {/* Network Status Indicator */}
                            <div className="flex items-center gap-3 mt-2">
                                <div className="relative flex items-center justify-center w-3 h-3">
                                    <div className="absolute inset-0 bg-emerald-500 rounded-full blur-sm opacity-50 animate-pulse" />
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full relative z-10 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                </div>
                                <span className="text-xs uppercase tracking-widest text-emerald-400/80 font-semibold">
                                    Trust Protocol: Online
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Side: Trust Score & Balance Panel */}
                    <div className="flex flex-col md:flex-row gap-6 shrink-0">
                        {/* Trust Score Panel - Square */}
                        <motion.div variants={item} className="w-full md:w-48 shrink-0 aspect-square">
                            {trustData?.ok ? (
                                <TrustScoreRing
                                    level={trustData.trustLevel}
                                    score={trustData.totalScore ?? 70}
                                />
                            ) : (
                                <div className="w-full h-full bg-[#1A1C23] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center shadow-lg">
                                    <ShieldCheck className="w-8 h-8 text-slate-600 mb-3" />
                                    <div className="text-slate-500 font-mono text-xs border border-slate-800 rounded-lg px-3 py-1.5 mt-2">
                                        {account ? "Not Synced" : "Connect Wallet"}
                                    </div>
                                    <button
                                        onClick={refreshTrust}
                                        disabled={trustLoading || !account}
                                        className="px-3 py-1.5 mt-3 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-xs"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${trustLoading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>
                            )}
                        </motion.div>

                        {/* Balance Panel */}
                        <motion.div variants={item} className="w-full md:w-80 shrink-0 relative group">
                            {/* Ambient Glow */}
                            <div className="absolute -inset-0.5 rounded-2xl bg-purple-500 opacity-0 group-hover:opacity-20 blur-xl transition-all duration-700 ease-out" />

                            <GlassCard className="p-6 h-full flex flex-col justify-between relative z-10 overflow-hidden border border-white/5 group-hover:border-purple-500/30 transition-colors duration-500">
                                {/* Radial Flare */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-all duration-700 ease-out" />

                                {/* Tech Grid */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                                <div className="flex items-start justify-between relative z-20">
                                    <div>
                                        <div className="text-sm text-slate-400 mb-1 group-hover:text-purple-300 transition-colors duration-500">Token Balance</div>
                                        <div className="text-3xl font-mono text-white tracking-tight">
                                            {walletBalance == null ? (
                                                <span className="text-slate-600">-</span>
                                            ) : (
                                                walletBalance.toFixed(4)
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors duration-500">
                                        <Wallet className="text-purple-400 w-6 h-6" />
                                    </div>
                                </div>

                                <div className="mt-6 flex gap-3 relative z-20">
                                    <NeonButton
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 h-10 text-xs border border-white/5 group-hover:border-purple-500/30 font-medium tracking-wide"
                                        onClick={refreshWallet}
                                        loading={walletLoading}
                                        disabled={!account}
                                    >
                                        Refresh
                                    </NeonButton>
                                    <NeonButton
                                        variant="secondary"
                                        size="sm"
                                        className="flex-1 h-10 text-xs font-medium tracking-wide shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-shadow"
                                        onClick={() => setRechargeOpen(true)}
                                        disabled={!account}
                                    >
                                        Deposit
                                    </NeonButton>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </div>
                </motion.div>


                {/* Navigation Grid */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                >
                    <div className="flex items-center gap-4 mb-10">
                        <div className="relative">
                            <span className="absolute -inset-1 rounded-full bg-cyan-500/30 blur-sm" />
                            <span className="relative block w-1.5 h-8 bg-cyan-400 rounded-full" />
                        </div>
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                            Explore Ecosystem
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div variants={item}>
                            <NavCard
                                to="/notary"
                                title="Cloud Notary"
                                description="Create, view and verify on-chain notarized documents with permanent storage."
                                icon={FileText}
                                color="bg-cyan-500"
                            />
                        </motion.div>

                        <motion.div variants={item}>
                            <NavCard
                                to="/credentials"
                                title="Credential Center"
                                description="Manage your Verifiable Credentials (VCs) and claims."
                                icon={Award}
                                color="bg-purple-500"
                            />
                        </motion.div>

                        <motion.div variants={item}>
                            <NavCard
                                to="/connect/manage"
                                title="TrustConnect"
                                description="Connect with other users and organizations based on trust scores."
                                icon={ShieldCheck} // Reusing ShieldCheck or a better icon
                                color="bg-emerald-500"
                            />
                        </motion.div>

                        <motion.div variants={item}>
                            <NavCard
                                to="/archives"
                                title="Personal Archives"
                                description="View your historical data and identity archives."
                                icon={Archive}
                                color="bg-amber-500"
                            />
                        </motion.div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
