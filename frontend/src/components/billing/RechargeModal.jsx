import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { Wallet, RefreshCw, Sparkles, ArrowUpRight } from "lucide-react";
import { confirmRecharge, getWalletBalance } from "../../services/trustConnectService";
import { useTrustProtocol } from "../../hooks/useTrustProtocol";

const TREASURY_ABI = ["function deposit() payable"];

function formatNum(n, digits = 4) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.0000";
  return v.toFixed(digits);
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-11/12 max-h-[90vh] min-h-0 flex flex-col rounded-3xl border border-white/10 bg-[#0B0E14]/80 shadow-[0_20px_80px_rgba(6,182,212,0.15)] backdrop-blur-2xl md:w-2/3 lg:w-1/2">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">Local Chain</div>
              <div className="text-base font-semibold text-slate-50">{title}</div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function RechargeModal({ open, onClose, role = "USER" }) {
  const { account, ensureLocalhostChain, parseProviderError } = useTrustProtocol();
  const [amount, setAmount] = useState("10");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [chainEthBalance, setChainEthBalance] = useState(null);
  const [chainEthLoading, setChainEthLoading] = useState(false);

  const cfg = useMemo(() => {
    return {
      treasury: String(import.meta.env.VITE_TREASURY_ADDRESS || "").trim(),
      symbol: String(import.meta.env.VITE_TREASURY_TOKEN_SYMBOL || "ETH").trim() || "ETH"
    };
  }, []);

  async function refreshBalance() {
    if (!account) return;
    setBalanceLoading(true);
    try {
      const res = await getWalletBalance({ role, actorId: account });
      setBalance(Number(res.balance || 0));
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }

  async function refreshChainEthBalance() {
    if (!account) return;
    setChainEthLoading(true);
    try {
      await ensureLocalhostChain();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const raw = await provider.getBalance(account);
      setChainEthBalance(Number(ethers.formatEther(raw)));
    } catch {
      setChainEthBalance(null);
    } finally {
      setChainEthLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setError("");
    setTxHash("");
    refreshBalance();
    refreshChainEthBalance();
  }, [open, account]);

  async function doDeposit() {
    setError("");
    setTxHash("");
    if (!account) {
      setError("Please connect your wallet.");
      return;
    }
    if (!cfg.treasury) {
      setError("Missing VITE_TREASURY_ADDRESS (set in frontend/.env).");
      return;
    }
    const a = String(amount || "").trim();
    if (!a || Number(a) <= 0) {
      setError("Invalid recharge amount.");
      return;
    }
    setWorking(true);
    try {
      await ensureLocalhostChain();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const treasury = new ethers.Contract(cfg.treasury, TREASURY_ABI, signer);

      const value = ethers.parseEther(a);
      const tx = await treasury.deposit({ value });
      const receipt = await tx.wait();
      const h = String(receipt?.hash || tx.hash || "");
      setTxHash(h);

      try {
        await confirmRecharge(h, { role, actorId: account });
      } catch {
      }

      refreshChainEthBalance();
      refreshBalance();
      for (const delay of [3000, 6000, 9000, 12000, 15000, 20000]) {
        setTimeout(() => {
          refreshBalance();
        }, delay);
      }
    } catch (e) {
      setError(parseProviderError(e));
    } finally {
      setWorking(false);
    }
  }

  if (!open) return null;

  return (
    <ModalShell
      title="Account Recharge"
      onClose={() => {
        if (working) return;
        onClose?.();
      }}
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-xs text-cyan-300/70">
            <Wallet className="h-3.5 w-3.5" />
            Wallet Address
          </div>
          <div className="mt-2 break-all text-sm text-slate-100">{account || "-"}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-400">On-chain ETH Balance</div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10 disabled:opacity-60"
              onClick={refreshChainEthBalance}
              disabled={chainEthLoading || !account}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${chainEthLoading ? "animate-spin" : ""}`} />
              {chainEthLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-50 tabular-nums">
            {chainEthBalance == null ? "-" : `${formatNum(chainEthBalance)} ETH`}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-400">Off-chain Balance</div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10 disabled:opacity-60"
              onClick={refreshBalance}
              disabled={balanceLoading || !account}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${balanceLoading ? "animate-spin" : ""}`} />
              {balanceLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-50 tabular-nums">
            {balance == null ? "-" : `${formatNum(balance)} ${cfg.symbol}`}
          </div>
          <div className="mt-2 text-xs text-slate-400">Balance sync may take a short delay after on-chain confirmation.</div>
        </div>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-slate-100">Recharge Amount</div>
          <input
            type="number"
            min={0}
            step="0.0001"
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/40"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={working}
          />
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:shadow-[0_0_25px_rgba(56,189,248,0.6)] disabled:opacity-60"
            onClick={doDeposit}
            disabled={working || !account}
          >
            <ArrowUpRight className="h-4 w-4" />
            {working ? "Processing..." : `Recharge ${cfg.symbol}`}
          </button>
          {txHash ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              Deposit submitted: <span className="break-all">{txHash}</span>
            </div>
          ) : null}
        </div>

        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}
      </div>
    </ModalShell>
  );
}
