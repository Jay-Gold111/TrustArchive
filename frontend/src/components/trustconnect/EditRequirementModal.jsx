import { useEffect, useState } from "react";
import ModalShell from "../ModalShell";
import ToastStack, { useToastStack } from "../ToastStack";
import { updateRequirement } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";

export default function EditRequirementModal({ open, onClose, requirement, onUpdated }) {
  const { account } = useTrustProtocol();
  const toast = useToastStack();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [secretContact, setSecretContact] = useState("");
  const [status, setStatus] = useState("OPEN");

  useEffect(() => {
    if (!open) return;
    setWorking(false);
    setError("");
    setTitle(String(requirement?.title || ""));
    setDescription(String(requirement?.description || ""));
    setSecretContact("");
    setStatus(String(requirement?.status || "OPEN").toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN");
  }, [open, requirement?.id]);

  async function submit() {
    setError("");
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }
    const id = Number(requirement?.id || 0);
    if (!id) {
      setError("Missing requirement id");
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

    const payload = { title: title.trim(), description: description.trim(), status };
    if (secretContact.trim()) payload.secret_contact = secretContact.trim();

    setWorking(true);
    try {
      const res = await updateRequirement(id, payload, { role: "INSTITUTION", actorId: account });
      toast.push("Changes saved", "success");
      onUpdated?.(res.item);
      onClose?.();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setWorking(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <ModalShell
        title="Edit Requirement"
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
              {working ? "Saving..." : "Save"}
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
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-400">Description</label>
            <textarea
              className="min-h-28 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={working}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-slate-400">Institution Contact (optional; leave blank to keep)</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-500/30"
              value={secretContact}
              onChange={(e) => setSecretContact(e.target.value)}
              disabled={working}
              placeholder="Leave blank to keep existing contact"
            />
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

          {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
        </div>
      </ModalShell>
      <ToastStack toasts={toast.toasts} />
    </>
  );
}
