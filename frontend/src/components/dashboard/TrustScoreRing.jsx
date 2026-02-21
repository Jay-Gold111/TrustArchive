import { motion } from "framer-motion";
import { MoreVertical } from "lucide-react";

export function TrustScoreRing({ score = 0, level = "Newbie" }) {
    // Determine gradient based on level/score
    let gradientFrom = "#8B5CF6"; // Purple
    let gradientTo = "#06b6d4"; // Cyan
    let glowColor = "rgba(6, 182, 212, 0.5)";

    if (score >= 80) {
        gradientFrom = "#10B981"; // Emerald
        gradientTo = "#34D399";
        glowColor = "rgba(16, 185, 129, 0.5)";
    } else if (score < 40) {
        gradientFrom = "#f7ccccff"; // Red
        gradientTo = "#fffefeff";
        glowColor = "rgba(252, 185, 185, 0.5)";
    }

    // SVG Layout calculations
    const size = 130;
    const strokeWidth = 10;
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;

    // The ring is a 3/4 circle (270 degrees out of 360)
    const arcLength = circumference * 0.75;
    const gapLength = circumference * 0.25;

    // Progress calculation
    const progressOffset = circumference - (score / 100) * arcLength;

    return (
        <div className="w-full h-full relative group">
            {/* Ambient Hex Glow */}
            <div className={`absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-700 ease-out`} style={{ backgroundColor: gradientFrom }} />

            <div className="w-full h-full bg-[#1A1C23] rounded-2xl p-5 border border-white/5 group-hover:border-cyan-500/30 shadow-lg flex flex-col items-center relative overflow-hidden transition-colors duration-500 z-10">
                {/* Top Corner Light */}
                <div className={`absolute top-0 left-0 w-32 h-32 opacity-5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 group-hover:opacity-20 transition-all duration-700 ease-out`} style={{ backgroundColor: gradientTo }} />

                {/* Tech Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-center w-full mb-2 relative z-20">
                    <span className="text-slate-200 group-hover:text-white transition-colors duration-500 font-semibold text-sm tracking-wide">Trust Score</span>
                    <button className="text-slate-500 hover:text-white transition-colors">
                        <MoreVertical className="w-4 h-4" />
                    </button>
                </div>

                {/* Ring Container */}
                <div className="flex-1 flex flex-col items-center justify-center relative w-full -mt-1 z-20">
                    <div className="relative flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500">
                        <svg width={size} height={size} className="transform rotate-[135deg] overflow-visible">
                            <defs>
                                <linearGradient id="scoreAnimGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={gradientFrom} />
                                    <stop offset="100%" stopColor={gradientTo} />
                                </linearGradient>
                                <filter id="scoreGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>

                            {/* Track Background */}
                            <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="#2A2D35"
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={`${arcLength} ${gapLength}`}
                                strokeDashoffset="0"
                                className="group-hover:stroke-[#353945] transition-colors duration-500"
                            />

                            {/* Progress Ring */}
                            <motion.circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke="url(#scoreAnimGradient)"
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: progressOffset }}
                                transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                                filter="url(#scoreGlow)"
                                className="drop-shadow-lg"
                            />
                        </svg>

                        {/* Center Plaque (Dark Circle inside) */}
                        <div className="absolute inset-0 flex items-center justify-center transform focus:outline-none ">
                            <div className="w-[84px] h-[84px] rounded-full bg-gradient-to-br from-[#2D3039] to-[#1D1F25] shadow-inner flex flex-col items-center justify-center border border-white/5 relative z-10 group-hover:border-white/10 transition-colors duration-500">
                                <motion.span
                                    className="text-3xl font-bold tracking-tight text-white group-hover:text-cyan-50 transition-colors"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, delay: 0.7 }}
                                >
                                    {score}
                                </motion.span>
                            </div>
                        </div>
                    </div>

                    {/* Level Label */}
                    <motion.div
                        className="absolute -bottom-2 text-center"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 1.2 }}
                    >
                        <div className="text-[20px] uppercase tracking-widest text-slate-400 group-hover:text-cyan-400 font-semibold bg-[#1A1C23] px-2 transition-colors duration-500">
                            {level}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
