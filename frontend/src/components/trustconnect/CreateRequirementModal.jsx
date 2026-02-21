import { useEffect, useState } from "react";
import ModalShell from "../ModalShell";
import ToastStack, { useToastStack } from "../ToastStack";
import { createRequirement } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";
import RechargeModal from "../billing/RechargeModal";

export default function CreateRequirementModal({ open, onClose, onCreated }) {
  const { account } = useTrustProtocol();
  const toast = useToastStack();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [needRecharge, setNeedRecharge] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [secretContact, setSecretContact] = useState("");
  const [status, setStatus] = useState("OPEN");

  useEffect(() => {
    if (!open) return;
    setWorking(false);
    setError("");
    setNeedRecharge(false);
    setRechargeOpen(false);
    setTitle("");
    setDescription("");
    setSecretContact("");
    setStatus("OPEN");
  }, [open]);

  async function submit() {
    setError("");
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }
    if (!title.trim()) {
      setError("Enter a requirement title");
      return;
    }
    if (!description.trim()) {
      setError("Enter a requirement description");
      return;
    }
    if (!secretContact.trim()) {
      setError("Enter institution contact");
      return;
    }

    setWorking(true);
    try {
      const res = await createRequirement(
        { title: title.trim(), description: description.trim(), secret_contact: secretContact.trim(), status },
        { role: "INSTITUTION", actorId: account }
      );
      toast.push("Published successfully", "success");
      onCreated?.(res);
      onClose?.();
    } catch (e) {
      const msg = String(e?.message || e);
      setError(msg);
      setNeedRecharge(Number(e?.statusCode || 0) === 402 || msg.includes("余额不足"));
    } finally {
      setWorking(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <ModalShell
        title="Publish Requirement"
        onClose={() => {
          if (working) return;
          onClose?.();
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
              onClick={onClose}
              disabled={working}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.45)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.65)] disabled:opacity-60"
              onClick={submit}
              disabled={working}
            >
              {working ? "Publishing..." : "Publish"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-xs text-slate-400">Title</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={working}
              placeholder="e.g. Employment background verification"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-400">Description</label>
            <textarea
              className="min-h-28 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={working}
              placeholder="Describe required materials, scope, deadlines, etc."
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-400">Institution Contact (unlocked on approval)</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              value={secretContact}
              onChange={(e) => setSecretContact(e.target.value)}
              disabled={working}
              placeholder="e.g. HR email / WeChat / phone"
            />
            <div className="text-xs text-slate-500">This field is encrypted with AES-256-GCM before storage.</div>
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-400">Status</label>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={working}
            >
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              <div>{error}</div>
              {needRecharge ? (
                <button
                  type="button"
                  className="mt-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.45)]"
                  onClick={() => setRechargeOpen(true)}
                >
                  Top up
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </ModalShell>
      <ToastStack toasts={toast.toasts} />
      <RechargeModal open={rechargeOpen} onClose={() => setRechargeOpen(false)} role="INSTITUTION" />
    </>
  );
}
