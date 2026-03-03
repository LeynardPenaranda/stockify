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
};

const SNOOZE_MS = 5000; //  change to 60000 for 1 minute

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function isLowStock(p: Product) {
  return safeNum(p.quantity) <= safeNum(p.minStock);
}

// --- Speech helpers (MAN voice) ---
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
  window.speechSynthesis.cancel();
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
  const [muted, setMuted] = useState(false);

  // voice repeat control
  const speakIntervalRef = useRef<number | null>(null);

  // used to detect changes in low stock set
  const lowKeyRef = useRef<string>("");

  //  snooze control
  const snoozedUntilRef = useRef<number>(0);
  const snoozeTimerRef = useRef<number | null>(null);

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

  // Subscribe to products only when logged in
  useEffect(() => {
    let unsubProducts: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setRows([]);
        setOpen(false);
        stopVoice();
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
      stopVoice();
      clearSnoozeTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowStockItems = useMemo(() => {
    return rows
      .filter((p) => isLowStock(p))
      .sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));
  }, [rows]);

  function stopVoice() {
    if (speakIntervalRef.current) {
      window.clearInterval(speakIntervalRef.current);
      speakIntervalRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function startVoice(text: string) {
    stopVoice();
    if (muted) return;

    speakOnce(text, maleVoice);
    speakIntervalRef.current = window.setInterval(() => {
      speakOnce(text, maleVoice);
    }, 12000);
  }

  function clearSnoozeTimer() {
    if (snoozeTimerRef.current) {
      window.clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }
  }

  function snoozeAndResume() {
    // stop now
    stopVoice();
    setOpen(false);

    // set snooze window
    const until = Date.now() + SNOOZE_MS;
    snoozedUntilRef.current = until;

    clearSnoozeTimer();
    snoozeTimerRef.current = window.setTimeout(() => {
      // only reopen if still low stock
      if (lowStockItems.length > 0) {
        setOpen(true);

        const top3 = lowStockItems.slice(0, 3);
        const spoken = `Warning. Low stock detected. ${top3
          .map((p) => `${p.name} in ${p.category}`)
          .join(", ")}. Please restock.`;

        startVoice(spoken);
      }
    }, SNOOZE_MS);
  }

  // Muted toggled on: stop voice immediately
  useEffect(() => {
    if (muted) stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // Auto open + speak when low stock changes (but respect snooze)
  useEffect(() => {
    if (!ready) return;

    const key = lowStockItems
      .map((x) => `${x.id}:${x.quantity}:${x.minStock}`)
      .join("|");

    // none low
    if (!key) {
      lowKeyRef.current = "";
      setOpen(false);
      stopVoice();
      clearSnoozeTimer();
      return;
    }

    // during snooze: do not reopen / speak
    if (Date.now() < snoozedUntilRef.current) return;

    // new / changed set
    if (key !== lowKeyRef.current) {
      lowKeyRef.current = key;
      setOpen(true);

      const top3 = lowStockItems.slice(0, 3);
      const spoken = `Warning. Low stock detected. ${top3
        .map((p) => `${p.name} in ${p.category}`)
        .join(", ")}. Please restock.`;

      startVoice(spoken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lowStockItems]);

  // nothing to show
  if (!ready || lowStockItems.length === 0) return null;

  return open ? (
    <div className="fixed top-3 left-0 right-0 z-9999 px-3">
      <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-red-600">
            <TriangleAlert className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-red-700">Low Stock Alert</div>
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

            {/*  Stop = snooze then auto resume */}
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
  ) : null;
}
