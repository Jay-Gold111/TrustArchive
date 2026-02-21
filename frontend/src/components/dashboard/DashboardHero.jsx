import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronDown, CloudLightning, ShieldAlert, Wallet } from "lucide-react";
import Web3Background from "./Web3Background";
import { NeonButton } from "../ui/GlassKit";

export default function DashboardHero({ account, onConnect }) {
    // Wave Path Animation
    const wavePath = "M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V46.25c47.13,22.2,103.13,32.17,158.44,32.66C216.5,79.28,271,69.18,321.39,56.44Z";

    return (
        <div className="relative h-screen w-full overflow-hidden bg-dark-bg font-sans">

            {/* Background Layer with 3D Effect - Absolute Right */}
            <div className="absolute top-0 right-0 w-full h-full z-0 pointer-events-none">
                <Web3Background />
            </div>

            {/* Angle / Wave Separator */}
            <div className="absolute top-0 left-0 w-[45%] h-full z-10 pointer-events-none">
                <div className="absolute top-0 right-[-1px] w-32 h-full bg-gradient-to-r from-dark-bg to-transparent" />
            </div>

            {/* Dynamic Silky Wave Separator */}
            <div className="absolute top-0 bottom-0 left-0 w-full md:w-[75%] z-10 pointer-events-none overflow-visible transform -rotate-[20deg] origin-top-left scale-[1.5] translate-y-[20%] -translate-x-[55%]">
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


            {/* Content Layer */}
            <div className="relative z-20 container mx-auto h-full px-6 flex flex-col justify-center">
                <div className="max-w-xl space-y-8">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 px-3 py-1 text-xs text-cyan-400 backdrop-blur-md"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        Security Protocol Active
                    </motion.div>

                    {/* Title / Description */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-white mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                            Own Your Data. <br />
                            <span className="bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]">
                                Prove Your Truth.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            A sovereign vault for encrypted archives,
                        </p>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            verifiable credentials, and trust that lives on-chain.
                        </p>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col sm:flex-row gap-4"
                    >
                        <Link to="/notary/create">
                            <NeonButton
                                variant="danger"
                                className="w-full sm:w-auto h-12 px-8 text-base shadow-[0_0_30px_rgba(244,63,94,0.4)] hover:shadow-[0_0_40px_rgba(244,63,94,0.6)] animate-pulse-slow"
                                icon={ShieldAlert}
                            >
                                Emergency Notary
                            </NeonButton>
                        </Link>

                        <NeonButton
                            variant="primary"
                            className="w-full sm:w-auto h-12 px-8 text-base bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:border-cyan-500/50"
                            icon={Wallet}
                            onClick={onConnect}
                        >
                            {account ? "Wallet Connected" : "Connect Wallet"}
                        </NeonButton>
                    </motion.div>
                </div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-slate-500"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                <span className="text-xs uppercase tracking-widest">Scroll to Explore</span>
                <ChevronDown className="w-5 h-5" />
            </motion.div>
        </div>
    );
}
