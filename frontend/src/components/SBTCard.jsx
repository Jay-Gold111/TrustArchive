import { useMemo } from "react";
import { GlassCard, NeonButton, StatusBadge, cn } from "./ui/GlassKit";
import { ExternalLink, Download, Eye, Archive, ShieldCheck } from "lucide-react";

export default function SBTCard({
  title,
  subtitle,
  imageUrl,
  leading,
  onTitleClick,
  tags,
  primaryAction,
  secondaryAction,
  metaLines
}) {
  const safeTags = useMemo(() => (Array.isArray(tags) ? tags.filter(Boolean) : []), [tags]);
  const safeMeta = useMemo(() => (Array.isArray(metaLines) ? metaLines.filter(Boolean) : []), [metaLines]);

  return (
    <GlassCard className="p-4 group hover:border-cyan-500/30 transition-all duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4 flex-1">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/50 shadow-inner group-hover:border-cyan-500/30 transition-colors">
            {imageUrl ? (
              <img className="h-full w-full object-cover" src={imageUrl} alt="" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-800/50 text-slate-600">
                <ShieldCheck className="h-8 w-8 opacity-20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {leading ? <div className="shrink-0">{leading}</div> : null}
              {onTitleClick ? (
                <button
                  type="button"
                  className="truncate text-left text-base font-bold text-slate-50 hover:text-cyan-400 transition-colors"
                  onClick={onTitleClick}
                >
                  {title || "Untitled SBT"}
                </button>
              ) : (
                <div className="truncate text-base font-bold text-slate-50">{title || "Untitled SBT"}</div>
              )}
            </div>
            
            {subtitle && (
              <div className="mb-2 truncate text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                {subtitle}
              </div>
            )}
            
            {safeTags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {safeTags.map((t) => {
                  let status = "neutral";
                  if (t.tone === "warning") status = "warning";
                  if (t.tone === "danger") status = "error";
                  if (t.tone === "success") status = "success";
                  if (t.tone === "info") status = "info";
                  
                  return (
                    <StatusBadge key={t.label} status={status}>
                      {t.label}
                    </StatusBadge>
                  );
                })}
              </div>
            )}
            
            {safeMeta.length > 0 && (
              <div className="grid gap-1 text-xs text-slate-500 group-hover:text-slate-400 transition-colors font-mono">
                {safeMeta.map((m, i) => (
                  <div key={i} className="truncate flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-cyan-500/50 transition-colors" />
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          {secondaryAction && (
            <NeonButton
              variant="ghost"
              size="sm"
              className="text-xs w-full sm:w-auto justify-center"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </NeonButton>
          )}
          
          {primaryAction && (
            <NeonButton
              variant={primaryAction.tone === "danger" ? "danger" : "primary"}
              size="sm"
              className="text-xs w-full sm:w-auto justify-center shadow-lg shadow-purple-900/20"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              icon={primaryAction.label.includes("查看") ? Eye : primaryAction.label.includes("领取") ? Download : undefined}
            >
              {primaryAction.label}
            </NeonButton>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
