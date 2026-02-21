import { motion } from "framer-motion";

export default function ModalShell({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0"
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative flex w-full max-h-[90vh] min-h-0 max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/60 to-slate-950/90 shadow-[0_20px_80px_-30px_rgba(56,189,248,0.35)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-slate-50">{title}</div>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="border-t border-white/10 bg-white/5 p-4">{footer}</div> : null}
      </motion.div>
    </div>
  );
}
