import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";

export default function ModeToggleButton() {
  const { account, isInstitution } = useTrustProtocol();
  const [issuerOk, setIssuerOk] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!account) {
        if (!cancelled) setIssuerOk(false);
        return;
      }
      try {
        const ok = await isInstitution(account);
        if (!cancelled) setIssuerOk(Boolean(ok));
      } catch {
        if (!cancelled) setIssuerOk(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [account, isInstitution]);

  const isManage = useMemo(() => String(loc.pathname || "").startsWith("/connect/manage"), [loc.pathname]);
  const label = isManage ? "Switch to User" : "Switch to Institution";

  const disabled = useMemo(() => {
    if (isManage) return false;
    return !issuerOk;
  }, [isManage, issuerOk]);

  const hint = useMemo(() => {
    if (!account) return "Please connect your wallet first";
    if (!isManage && !issuerOk) return "Current address is not an institution";
    return "";
  }, [account, isManage, issuerOk]);

  function go() {
    if (disabled) return;
    nav(isManage ? "/connect/requirements" : "/connect/manage");
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_18px_rgba(56,189,248,0.35)] disabled:opacity-50"
      title={hint}
      onClick={go}
      disabled={disabled}
      aria-label={label}
    >
      {label}
    </motion.button>
  );
}
