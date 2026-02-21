import { useCallback, useMemo, useState } from "react";

function toneCls(tone) {
  if (tone === "success") return "border-emerald-900/60 bg-emerald-950/60 text-emerald-100";
  if (tone === "error") return "border-rose-900/60 bg-rose-950/60 text-rose-100";
  if (tone === "warning") return "border-amber-900/60 bg-amber-950/60 text-amber-100";
  return "border-slate-800 bg-slate-950/60 text-slate-100";
}

export function useToastStack() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, tone = "info", ttlMs = 2200) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message: String(message || ""), tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, Math.max(800, Number(ttlMs || 0)));
  }, []);

  const api = useMemo(() => ({ toasts, push }), [toasts, push]);
  return api;
}

export default function ToastStack({ toasts }) {
  if (!Array.isArray(toasts) || toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[60] grid gap-2">
      {toasts.slice(-4).map((t) => (
        <div key={t.id} className={`w-80 rounded-xl border px-3 py-2 text-sm shadow-lg ${toneCls(t.tone)}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

