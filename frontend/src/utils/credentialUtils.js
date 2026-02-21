import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const val = n / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

export function categoryLabel(c) {
  return Number(c) === 1 ? "Work/Experience" : "Academic Certification";
}

export function claimStatusLabel(s) {
  const n = Number(s);
  if (n === 1) return { label: "Approved", cls: "border-emerald-900/60 bg-emerald-950/30 text-emerald-200" };
  if (n === 2) return { label: "Rejected", cls: "border-rose-900/60 bg-rose-950/30 text-rose-200" };
  return { label: "Pending Review", cls: "border-amber-900/60 bg-amber-950/30 text-amber-200" };
}

export function isPdfLike({ name, type }) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".pdf")) return true;
  return String(type || "").toLowerCase().includes("pdf");
}

export function isImageLike({ name, type }) {
  const t = String(type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  const n = String(name || "").toLowerCase();
  return n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp") || n.endsWith(".gif");
}
