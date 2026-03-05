"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase/client";
import { TriangleAlert, Volume2, VolumeX } from "lucide-react";

type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  expirationDate: any | null; // can be string | Timestamp | Date
};

const SNOOZE_MS = 5000;

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function isLowStock(p: Product) {
  return safeNum(p.quantity) <= safeNum(p.minStock);
}

// ===== Expiry helpers =====
const EXPIRY_WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseExpiryMs(v: any): number | null {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate().getTime(); // Firestore Timestamp
  if (v instanceof Date) return v.getTime();
  const d = new Date(String(v));
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function toExpiryDisplay(v: any): string | null {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  const t = d.getTime();
  return Number.isFinite(t) ? d.toISOString() : String(v);
}

function daysUntilExpiry(p: Product): number | null {
  const ms = parseExpiryMs(p.expirationDate);
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / DAY_MS);
}

function isExpiringSoon(p: Product) {
  const d = daysUntilExpiry(p);
  return d !== null && d >= 0 && d <= EXPIRY_WARNING_DAYS;
}

// ===== Speech helpers (MAN voice) =====
function pickMaleVoice(all: SpeechSynthesisVoice[]) {
  const lower = (s: string) => s.toLowerCase();
  const preferred = all.find((v) =>
    [
      "daniel",
      "alex",
      "fred",
      "male",
      "google uk english male",
      "microsoft david",
      "microsoft mark",
    ].some((k) => lower(v.name).includes(k)),
  );

  return (
    preferred ||
    all.find((v) => (v.lang || "").toLowerCase().startsWith("en")) ||
    null
  );
}

function speakOnce(text: string, voice: SpeechSynthesisVoice | null) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 1;
  u.pitch = 0.85;
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export default function LowStockGlobalAlert() {
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Product[]>([]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const maleVoice = useMemo(() => pickMaleVoice(voices), [voices]);

  const [open, setOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const lowSpeakIntervalRef = useRef<number | null>(null);
  const expSpeakIntervalRef = useRef<number | null>(null);

  const lowKeyRef = useRef<string>("");
  const expKeyRef = useRef<string>("");

  // client-side email dedupe (extra safety; server also dedupes)
  const lastLowEmailKeyRef = useRef<string>("");
  const lastExpEmailKeyRef = useRef<string>("");

  const snoozedUntilRef = useRef<number>(0);
  const snoozeTimerRef = useRef<number | null>(null);

  // ✅ helper: send alert to server (server sends email to OWNER_EMAIL)
  async function sendOwnerAlert(payload: any) {
    try {
      const u = auth.currentUser;
      if (!u) return;

      const bearer = await u.getIdToken();
      await fetch("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Failed to send owner alert:", err);
    }
  }

  // Load voices once
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Subscribe
  useEffect(() => {
    let unsubProducts: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setRows([]);
        setOpen(false);
        setExpOpen(false);
        stopAllVoice();
        clearSnoozeTimer();
        setReady(true);
        if (unsubProducts) unsubProducts();
        unsubProducts = null;
        return;
      }

      const qy = query(
        collection(db, "products"),
        orderBy("updatedAt", "desc"),
      );
      unsubProducts = onSnapshot(
        qy,
        (snap) => {
          const data: Product[] = snap.docs.map((d) => {
            const v = d.data() as any;
            return {
              id: d.id,
              name: String(v.name ?? ""),
              category: String(v.category ?? "Uncategorized"),
              quantity: safeNum(v.quantity),
              minStock: safeNum(v.minStock),
              expirationDate: v.expirationDate ?? null,
            };
          });
          setRows(data);
          setReady(true);
        },
        () => setReady(true),
      );
    });

    return () => {
      unsubAuth();
      if (unsubProducts) unsubProducts();
      stopAllVoice();
      clearSnoozeTimer();
    };
  }, []);

  const lowStockItems = useMemo(() => {
    return rows
      .filter((p) => isLowStock(p))
      .sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));
  }, [rows]);

  const expiringItems = useMemo(() => {
    return rows
      .filter((p) => isExpiringSoon(p))
      .sort((a, b) => {
        const da = daysUntilExpiry(a) ?? 999999;
        const db = daysUntilExpiry(b) ?? 999999;
        return da - db;
      });
  }, [rows]);

  function stopLowVoice() {
    if (lowSpeakIntervalRef.current) {
      window.clearInterval(lowSpeakIntervalRef.current);
      lowSpeakIntervalRef.current = null;
    }
  }

  function stopExpVoice() {
    if (expSpeakIntervalRef.current) {
      window.clearInterval(expSpeakIntervalRef.current);
      expSpeakIntervalRef.current = null;
    }
  }

  function stopAllVoice() {
    stopLowVoice();
    stopExpVoice();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function startLowVoice(text: string) {
    stopLowVoice();
    if (muted) return;
    speakOnce(text, maleVoice);
    lowSpeakIntervalRef.current = window.setInterval(() => {
      speakOnce(text, maleVoice);
    }, 12000);
  }

  function startExpVoice(text: string) {
    stopExpVoice();
    if (muted) return;
    speakOnce(text, maleVoice);
    expSpeakIntervalRef.current = window.setInterval(() => {
      speakOnce(text, maleVoice);
    }, 15000);
  }

  function clearSnoozeTimer() {
    if (snoozeTimerRef.current) {
      window.clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }
  }

  function snoozeAndResume() {
    stopAllVoice();
    setOpen(false);

    const until = Date.now() + SNOOZE_MS;
    snoozedUntilRef.current = until;

    clearSnoozeTimer();
    snoozeTimerRef.current = window.setTimeout(() => {
      if (lowStockItems.length > 0) {
        setOpen(true);
        const top3 = lowStockItems.slice(0, 3);
        const spoken = `Warning. Low stock detected. ${top3
          .map((p) => `${p.name} in ${p.category}`)
          .join(", ")}. Please restock.`;
        startLowVoice(spoken);
      }
    }, SNOOZE_MS);
  }

  useEffect(() => {
    if (muted) stopAllVoice();
  }, [muted]);

  // ✅ EXPIRY (email + voice) — includes product names in message
  useEffect(() => {
    (async () => {
      if (!ready) return;

      const key = expiringItems
        .map((x) => `${x.id}:${parseExpiryMs(x.expirationDate) ?? ""}`)
        .join("|");

      if (!key) {
        expKeyRef.current = "";
        setExpOpen(false);
        stopExpVoice();
        return;
      }

      if (Date.now() < snoozedUntilRef.current) return;

      if (key !== expKeyRef.current) {
        expKeyRef.current = key;
        setExpOpen(true);

        if (lastExpEmailKeyRef.current !== key) {
          lastExpEmailKeyRef.current = key;

          const expNames = expiringItems
            .slice(0, 6)
            .map((p) => p.name)
            .filter(Boolean);

          const expNamesText =
            expNames.length > 0
              ? `Top items: ${expNames.join(", ")}${
                  expiringItems.length > 6
                    ? ` (+${expiringItems.length - 6} more)`
                    : ""
                }.`
              : "";

          await sendOwnerAlert({
            type: "expiring",
            dedupeKey: key,
            title: "Expiration Warning (14 Days)",
            message: `Heads up! ${
              expiringItems.length
            } item(s) are nearing expiration (within ${EXPIRY_WARNING_DAYS} days). ${expNamesText}`,
            items: expiringItems.slice(0, 10).map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              daysLeft: daysUntilExpiry(p),
              expirationDate: toExpiryDisplay(p.expirationDate),
            })),
          });
        }

        const top3 = expiringItems.slice(0, 3);
        const spoken = `Reminder. Some products are nearing expiration. ${top3
          .map((p) => {
            const d = daysUntilExpiry(p);
            return `${p.name} in ${p.category}${
              typeof d === "number" ? `, ${d} days left` : ""
            }`;
          })
          .join(", ")}. Please check expiration dates.`;

        startExpVoice(spoken);
      }
    })();
  }, [ready, expiringItems]);

  // ✅ LOW STOCK (email + voice) — includes product names in message
  useEffect(() => {
    (async () => {
      if (!ready) return;

      const key = lowStockItems
        .map((x) => `${x.id}:${x.quantity}:${x.minStock}`)
        .join("|");

      if (!key) {
        lowKeyRef.current = "";
        setOpen(false);
        stopLowVoice();
        clearSnoozeTimer();
        return;
      }

      if (Date.now() < snoozedUntilRef.current) return;

      if (key !== lowKeyRef.current) {
        lowKeyRef.current = key;
        setOpen(true);

        if (lastLowEmailKeyRef.current !== key) {
          lastLowEmailKeyRef.current = key;

          const productNames = lowStockItems
            .slice(0, 6)
            .map((p) => p.name)
            .filter(Boolean);

          const namesText =
            productNames.length > 0
              ? `Top items: ${productNames.join(", ")}${
                  lowStockItems.length > 6
                    ? ` (+${lowStockItems.length - 6} more)`
                    : ""
                }.`
              : "";

          await sendOwnerAlert({
            type: "low_stock",
            dedupeKey: key,
            title: "Low Stock Alert",
            message: `Action needed: ${
              lowStockItems.length
            } item(s) are below the minimum stock level. ${namesText}`,
            items: lowStockItems.slice(0, 10).map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              quantity: p.quantity,
              minStock: p.minStock,
            })),
          });
        }

        const top3 = lowStockItems.slice(0, 3);
        const spoken = `Warning. Low stock detected. ${top3
          .map((p) => `${p.name} in ${p.category}`)
          .join(", ")}. Please restock.`;

        startLowVoice(spoken);
      }
    })();
  }, [ready, lowStockItems]);

  if (!ready || (lowStockItems.length === 0 && expiringItems.length === 0))
    return null;

  // push red down if yellow is open
  const redTopClass = expOpen ? "top-[84px]" : "top-3";

  return (
    <>
      {/* Yellow banner */}
      {expOpen && expiringItems.length > 0 ? (
        <div className="fixed top-3 left-0 right-0 z-9999 px-3 pointer-events-none">
          <div className="mx-auto max-w-4xl rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 shadow-sm pointer-events-auto">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-yellow-700">
                <TriangleAlert className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-yellow-800">
                  Expiring Soon
                </div>
                <div className="text-xs text-yellow-800/80 mt-0.5">
                  {expiringItems.length} item(s) will expire within 2 weeks.
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {expiringItems.slice(0, 6).map((p) => {
                    const d = daysUntilExpiry(p);
                    return (
                      <span
                        key={p.id}
                        className="text-xs rounded-full bg-white border border-yellow-200 px-2 py-1 text-yellow-900"
                      >
                        {p.category} • {p.name}
                        {typeof d === "number" ? ` • ${d}d` : ""}
                      </span>
                    );
                  })}
                  {expiringItems.length > 6 ? (
                    <span className="text-xs text-yellow-800/80">
                      +{expiringItems.length - 6} more
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className="h-9 px-3 rounded-xl border border-yellow-200 bg-white hover:bg-yellow-100 active:scale-[0.98] transition inline-flex items-center gap-2 text-xs text-yellow-900"
                >
                  {muted ? (
                    <>
                      <VolumeX className="w-4 h-4" /> Muted
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" /> Voice On
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExpOpen(false);
                    stopExpVoice();
                  }}
                  className="h-9 px-3 rounded-xl border border-yellow-200 bg-white hover:bg-yellow-100 active:scale-[0.98] transition inline-flex items-center gap-2 text-xs text-yellow-900"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Red banner */}
      {open && lowStockItems.length > 0 ? (
        <div
          className={`fixed ${redTopClass} left-0 right-0 z-9999 px-3 pointer-events-none`}
        >
          <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm pointer-events-auto">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-red-600">
                <TriangleAlert className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-red-700">
                  Low Stock Alert
                </div>
                <div className="text-xs text-red-700/80 mt-0.5">
                  {lowStockItems.length} item(s) are low. Please restock.
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {lowStockItems.slice(0, 6).map((p) => (
                    <span
                      key={p.id}
                      className="text-xs rounded-full bg-white border border-red-200 px-2 py-1 text-red-700"
                    >
                      {p.category} • {p.name}
                    </span>
                  ))}
                  {lowStockItems.length > 6 ? (
                    <span className="text-xs text-red-700/80">
                      +{lowStockItems.length - 6} more
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className="h-9 px-3 rounded-xl border border-red-200 bg-white hover:bg-red-100 active:scale-[0.98] transition inline-flex items-center gap-2 text-xs text-red-700"
                >
                  {muted ? (
                    <>
                      <VolumeX className="w-4 h-4" /> Muted
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" /> Voice On
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={snoozeAndResume}
                  className="h-9 px-3 rounded-xl bg-primary hover:bg-hover text-white active:scale-[0.98] transition text-xs"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
