import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTrustProtocol } from "../hooks/useTrustProtocol";
import { getTrustScore } from "../services/trustScoreService";
import { TrustReportModal } from "../components/TrustBadge";
import RechargeModal from "../components/billing/RechargeModal";
import { getWalletBalance } from "../services/trustConnectService";
import DashboardHero from "../components/dashboard/DashboardHero";
import DashboardContent from "../components/dashboard/DashboardContent";

export default function Dashboard() {
  const { account, getHistory, parseProviderError, connectWallet } = useTrustProtocol();
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [trustError, setTrustError] = useState("");
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustData, setTrustData] = useState(null);
  const [trustReportOpen, setTrustReportOpen] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError("");
      if (!account) {
        setHistory([]);
        return;
      }
      try {
        const rows = await getHistory(account);
        if (!cancelled) setHistory(rows);
      } catch (e) {
        if (!cancelled) setError(parseProviderError(e));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [account, getHistory, parseProviderError]);

  async function refreshTrust() {
    setTrustError("");
    if (!account) {
      setTrustData(null);
      return;
    }
    setTrustLoading(true);
    try {
      const res = await getTrustScore(account);
      setTrustData(res);
    } catch (e) {
      setTrustError(e?.message || String(e));
    } finally {
      setTrustLoading(false);
    }
  }

  useEffect(() => {
    refreshTrust();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  async function refreshWallet() {
    if (!account) {
      setWalletBalance(null);
      return;
    }
    setWalletLoading(true);
    try {
      const r = await getWalletBalance({ role: "USER", actorId: account });
      setWalletBalance(Number(r.balance || 0));
    } catch {
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => {
    refreshWallet();
  }, [account]);

  // Scroll Transition Logic
  const [showContent, setShowContent] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const handleWheel = (e) => {
      // If animating, ignore events to prevent jitter
      if (isAnimating) return;

      if (!showContent) {
        // In Hero Section: Scroll Down triggers transition
        if (e.deltaY > 50) { // Threshold to avoid accidental triggers
          setShowContent(true);
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 800); // Lock duration matching animation
        }
      } else {
        // In Content Section: Scroll Up AT THE TOP triggers transition
        const contentContainer = document.getElementById("dashboard-content-container");
        if (contentContainer && contentContainer.scrollTop === 0 && e.deltaY < -50) {
          setShowContent(false);
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 800);
        }
      }
    };

    window.addEventListener("wheel", handleWheel);
    return () => window.removeEventListener("wheel", handleWheel);
  }, [showContent, isAnimating]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-dark-bg text-slate-200 selection:bg-cyan-500/30">
      {/* Hero Section - Fixed Background */}
      <div className="absolute inset-0 z-0">
        <DashboardHero
          account={account}
          onConnect={connectWallet}
        />
      </div>

      {/* Content Section - Sliding Overlay */}
      <motion.div
        id="dashboard-content-container"
        initial={{ y: "100%", opacity: 0 }}
        animate={{
          y: showContent ? "0%" : "100%",
          opacity: showContent ? 1 : 0
        }}
        transition={{ type: "spring", stiffness: 60, damping: 15, mass: 1 }}
        className="absolute inset-0 z-50 overflow-hidden bg-dark-bg"
        style={{ willChange: "transform, opacity" }}
      >
        <DashboardContent
          account={account}
          trustData={trustData}
          trustLoading={trustLoading}
          refreshTrust={refreshTrust}
          walletBalance={walletBalance}
          walletLoading={walletLoading}
          refreshWallet={refreshWallet}
          setRechargeOpen={setRechargeOpen}
          history={history}
        />
      </motion.div>

      {/* Scroll Indicator (Hero Only) */}
      {!showContent && (
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 text-slate-500 cursor-pointer"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          onClick={() => setShowContent(true)}
        >
          <span className="text-xs uppercase tracking-widest">Scroll to Explore</span>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      )}

      <TrustReportModal
        open={trustReportOpen}
        onClose={() => setTrustReportOpen(false)}
        data={trustData}
      />

      <RechargeModal
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        role="USER"
      />
    </div>
  );
}
