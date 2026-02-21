import { 
  Gift, 
  Loader2, 
  Scan, 
  Tag, 
  Building2, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, NeonButton, StatusBadge } from "../ui/GlassKit";
import { formatAddress, categoryLabel, cn } from "../../utils/credentialUtils";

export default function PendingCredentialList({
  offerRows,
  discoveredBatchClaims,
  discoveryWorking,
  discoverBatchClaims,
  account,
  handleClaimDiscoveredBatch,
  handleRejectDiscoveredBatch,
  handleAcceptOffer,
  handleRejectOffer,
  offerSafePage,
  offerTotalPages,
  setOfferPage
}) {
  return (
    <GlassCard className="p-5 relative overflow-hidden">
       <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-400" />
            Pending Credentials
            <span className="text-xs font-normal text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded-md">
              {offerRows.length + discoveredBatchClaims.length}
            </span>
          </h3>
          <NeonButton
            variant="ghost"
            size="sm"
            onClick={discoverBatchClaims}
            disabled={!account || discoveryWorking}
            icon={discoveryWorking ? Loader2 : Scan}
            className={cn("h-7 text-xs px-2", discoveryWorking && "animate-pulse")}
          >
            {discoveryWorking ? "Scanning" : "Radar Scan"}
          </NeonButton>
       </div>

       <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
          {offerRows.length === 0 && discoveredBatchClaims.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
              No pending credentials
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {/* Merkle Claims */}
              {discoveredBatchClaims.map((b) => (
                <motion.div
                  key={`batch-${b.batchIndex}-${b.distributionCID}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors group"
                >
                   {/* Row 1: Header (Badge + Title + ID) */}
                   <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status="pending" className="px-1.5 py-0.5 text-[10px] shrink-0">Batch Issue</StatusBadge>
                      <div className="text-sm font-bold text-white truncate flex-1">{b.templateId || "Untitled Credential"}</div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        CID: {b.distributionCID.slice(0, 6)}
                      </span>
                   </div>
                   {/* Row 2: Meta */}
                   <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mb-3 items-center">
                      <div className="flex items-center gap-1 min-w-0 max-w-[40%]">
                        <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{b.templateCategory || "Batch"}</span>
                      </div>
                      <span className="w-px h-3 bg-slate-700/50"></span>
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{b.issuerName || "Unknown"}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 shrink-0 ml-auto">
                         <Scan className="w-3 h-3" />
                         {formatAddress(b.issuerAddress || "")}
                      </div>
                   </div>
                   {/* Row 3: Actions */}
                   <div className="grid grid-cols-3 gap-2">
                      <NeonButton
                        variant="primary"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => handleClaimDiscoveredBatch(b)}
                        disabled={!account}
                      >
                        Claim
                      </NeonButton>
                      <NeonButton
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700"
                        onClick={() => handleRejectDiscoveredBatch(b, false)}
                        disabled={!account}
                      >
                        Reject
                      </NeonButton>
                      <NeonButton
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                        onClick={() => handleRejectDiscoveredBatch(b, true)}
                        disabled={!account}
                      >
                        Block
                      </NeonButton>
                   </div>
                </motion.div>
              ))}

              {/* Direct Offers */}
              {offerRows.map((o) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors group"
                >
                   {/* Row 1: Header (Badge + Title + ID) */}
                   <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status="active" className="px-1.5 py-0.5 text-[10px] shrink-0">Individual Issue</StatusBadge>
                      <div className="text-sm font-bold text-white truncate flex-1">{o.title}</div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        ID: {o.id}
                      </span>
                   </div>
                   {/* Row 2: Meta */}
                   <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mb-3 items-center">
                      <div className="flex items-center gap-1 min-w-0 max-w-[40%]">
                        <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{categoryLabel(o.category)}</span>
                      </div>
                      <span className="w-px h-3 bg-slate-700/50"></span>
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{o.issuerName || "Unknown"}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 shrink-0 ml-auto">
                         <Scan className="w-3 h-3" />
                         {formatAddress(o.issuer)}
                      </div>
                   </div>
                   {/* Row 3: Actions */}
                   <div className="grid grid-cols-3 gap-2">
                      <NeonButton
                        variant="primary"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => handleAcceptOffer(o)}
                        disabled={!account}
                      >
                        Claim
                      </NeonButton>
                      <NeonButton
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700"
                        onClick={() => handleRejectOffer(o, false)}
                        disabled={!account}
                      >
                        Reject
                      </NeonButton>
                      <NeonButton
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                        onClick={() => handleRejectOffer(o, true)}
                        disabled={!account}
                      >
                        Block
                      </NeonButton>
                   </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
       </div>
       
       {/* Minimal Pagination */}
       <div className="mt-4 flex items-center justify-between border-t border-slate-800/50 pt-3">
          <span className="text-[10px] text-slate-500 font-mono">
             {offerSafePage}/{offerTotalPages}
          </span>
          <div className="flex gap-1">
            <button 
              onClick={() => setOfferPage((p) => Math.max(1, p - 1))}
              disabled={offerSafePage <= 1}
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button 
              onClick={() => setOfferPage((p) => Math.min(offerTotalPages, p + 1))}
              disabled={offerSafePage >= offerTotalPages}
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
       </div>
    </GlassCard>
  );
}
