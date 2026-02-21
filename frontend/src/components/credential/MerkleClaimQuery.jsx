import { ShieldCheck, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, NeonButton } from "../ui/GlassKit";

export default function MerkleClaimQuery({
  batchClaimCid,
  setBatchClaimCid,
  batchClaimWorking,
  loadBatchClaimInfo,
  batchClaimError,
  batchClaimInfo,
  setBatchClaimInfo,
  doBatchClaim,
  account
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Merkle Claim</h3>
        </div>
        <div className="text-[10px] text-slate-500">Distribution CID Query</div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full rounded-lg border border-white/10 bg-black/20 p-2 pl-3 text-xs text-slate-100 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-slate-600"
            value={batchClaimCid}
            onChange={(e) => setBatchClaimCid(e.target.value)}
            placeholder="Enter distributionCID..."
            disabled={batchClaimWorking}
          />
        </div>
        <NeonButton 
          variant="secondary" 
          size="sm"
          onClick={loadBatchClaimInfo}
          disabled={batchClaimWorking || !batchClaimCid.trim() || !account}
          loading={batchClaimWorking}
        >
          Query
        </NeonButton>
      </div>

      <AnimatePresence>
        {batchClaimError && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden">
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {batchClaimError}
            </div>
          </motion.div>
        )}

        {batchClaimInfo && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
              <div className="space-y-2 text-xs">
                 <div className="flex justify-between">
                    <span className="text-slate-500">Template ID</span>
                    <span className="text-slate-200 font-mono">{batchClaimInfo.templateId || "-"}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Institution</span>
                    <span className="text-slate-200">{batchClaimInfo.issuerName || "-"}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Root</span>
                    <span className="text-slate-200 font-mono">{String(batchClaimInfo.merkleRoot || "").slice(0, 8)}...</span>
                 </div>
              </div>
              
              <div className="mt-3 flex flex-wrap justify-end gap-2 pt-3 border-t border-white/5">
                <button onClick={() => setBatchClaimInfo(null)} disabled={batchClaimWorking} className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <NeonButton size="sm" onClick={doBatchClaim} disabled={batchClaimWorking || !account} loading={batchClaimWorking}>
                  Claim
                </NeonButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
