import { 
  FileUp, 
  Building2, 
  Tag, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FolderOpen, 
  Send 
} from "lucide-react";
import { GlassCard, GlassSelect, GlassInput, NeonButton } from "../ui/GlassKit";
import { formatAddress, formatBytes, isPdfLike, cn } from "../../utils/credentialUtils";

export default function CredentialClaimForm({
  institutions = [],
  claimInstitution,
  setClaimInstitution,
  claimCategory,
  setClaimCategory,
  claimTitle,
  setClaimTitle,
  claimFile,
  setClaimFile,
  claimFileError,
  setClaimFileError,
  handleClaimSubmit,
  isClaimSubmitting,
  openArchivePick,
  account
}) {
  return (
    <GlassCard className="p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <FileUp className="w-32 h-32 text-cyan-500" />
      </div>
      <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
        <FileUp className="w-5 h-5 text-cyan-400" />
        Initiate Claim <span className="text-sm font-normal text-slate-400">(Instant Encrypted Upload)</span>
      </h2>
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" /> Institution
            </label>
            <GlassSelect
              icon={Building2}
              value={claimInstitution}
              onChange={(e) => setClaimInstitution(e.target.value)}
              disabled={!account || isClaimSubmitting}
            >
              <option value="" className="bg-slate-900 text-slate-300">Select an institution</option>
              {institutions.map((i) => (
                <option key={i.address} value={i.address} className="bg-slate-900 text-slate-300">
                  {i.name} ({formatAddress(i.address)})
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-500" /> Category
            </label>
            <GlassSelect
              icon={Tag}
              value={claimCategory}
              onChange={(e) => setClaimCategory(Number(e.target.value))}
              disabled={!account || isClaimSubmitting}
            >
              <option value={0} className="bg-slate-900 text-slate-300">Academic Certification</option>
              <option value={1} className="bg-slate-900 text-slate-300">Work/Experience</option>
            </GlassSelect>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" /> Credential Title
          </label>
          <GlassInput
            icon={FileText}
            value={claimTitle}
            onChange={(e) => setClaimTitle(e.target.value)}
            placeholder="e.g., Degree Certificate / Labor Contract / Internship Proof"
            disabled={!account || isClaimSubmitting}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-500" /> File for Review (PDF/Image)
          </label>
          <div className="relative group/upload h-32">
            <input
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setClaimFileError("");
                if (!f) {
                  setClaimFile(null);
                  return;
                }
                const isImg = String(f.type || "").startsWith("image/");
                const isPdf = isPdfLike({ name: f.name, type: f.type });
                if (!isImg && !isPdf) {
                  setClaimFile(null);
                  setClaimFileError("Only support image or PDF");
                  return;
                }
                setClaimFile(f);
              }}
              disabled={!account || isClaimSubmitting}
            />
            <div className={cn(
              "absolute inset-0 w-full h-full rounded-xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-3 transition-all group-hover/upload:border-cyan-500/50 group-hover/upload:bg-white/10",
              claimFileError && "border-rose-500/50 bg-rose-950/10"
            )}>
              {claimFile ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                  <div className="text-sm text-slate-200 font-medium">{claimFile.name}</div>
                  <div className="text-xs text-slate-400">{formatBytes(claimFile.size)}</div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-500 group-hover/upload:text-cyan-400 transition-colors" />
                  <div className="text-sm text-slate-400 group-hover/upload:text-slate-300">
                    Click to upload or drag file here
                  </div>
                  <div className="text-xs text-slate-600">Supports PDF, JPG, PNG</div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-between items-start mt-2">
            <div>
              {claimFileError ? <div className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {claimFileError}</div> : null}
            </div>
            <button
              type="button"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors z-20 relative"
              onClick={openArchivePick}
              disabled={!account || isClaimSubmitting}
            >
              <FolderOpen className="w-3 h-3" /> Select from Archive
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-slate-800/50">
          <NeonButton
            variant="primary"
            size="lg"
            onClick={handleClaimSubmit}
            disabled={!account || isClaimSubmitting || !claimInstitution || !claimTitle.trim() || !claimFile}
            loading={isClaimSubmitting}
            icon={Send}
            className="w-full sm:w-auto"
          >
            {isClaimSubmitting ? "Encrypting & Uploading..." : "Submit Claim"}
          </NeonButton>
        </div>
      </div>
    </GlassCard>
  );
}
