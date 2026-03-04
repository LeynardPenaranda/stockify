"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "danger" | "info" | "warning";

export type ToastOptions = {
  message: string;
  type?: ToastType; // default: info
  description?: string;
  duration?: number; // ms, default 5000
};

type ToastItem = {
  id: string;
  message: string;
  description: string;
  type: ToastType;
  duration: number;
  exiting: boolean;
};

const DEFAULT_DURATION = 4500;
const EXIT_ANIM_MS = 220;

const TOAST_STYLES: Record<
  ToastType,
  {
    wrap: string;
    accent: string;
    icon: string;
    title: string;
    desc: string;
    close: string;
  }
> = {
  success: {
    wrap: "bg-white border-black/10",
    accent: "bg-emerald-500",
    icon: "text-emerald-600",
    title: "text-gray-900",
    desc: "text-gray-600",
    close: "text-gray-500 hover:text-gray-800",
  },
  danger: {
    wrap: "bg-white border-black/10",
    accent: "bg-red-500",
    icon: "text-red-600",
    title: "text-gray-900",
    desc: "text-gray-600",
    close: "text-gray-500 hover:text-gray-800",
  },
  info: {
    wrap: "bg-white border-black/10",
    accent: "bg-blue-500",
    icon: "text-blue-600",
    title: "text-gray-900",
    desc: "text-gray-600",
    close: "text-gray-500 hover:text-gray-800",
  },
  warning: {
    wrap: "bg-white border-black/10",
    accent: "bg-amber-500",
    icon: "text-amber-600",
    title: "text-gray-900",
    desc: "text-gray-600",
    close: "text-gray-500 hover:text-gray-800",
  },
};

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const beginRemove = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      if (timersRef.current[id]) {
        window.clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
    }, EXIT_ANIM_MS);
  }, []);

  const showToast = useCallback(
    (opts: ToastOptions) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const duration = opts.duration ?? DEFAULT_DURATION;

      const item: ToastItem = {
        id,
        message: opts.message,
        description: opts.description ?? "",
        type: opts.type ?? "info",
        duration,
        exiting: false,
      };

      setToasts((prev) => [item, ...prev].slice(0, 3));

      timersRef.current[id] = window.setTimeout(
        () => beginRemove(id),
        duration,
      );
    },
    [beginRemove],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Viewport */}
      <div className="fixed left-1/2 top-5 z-9999 -translate-x-1/2 w-[92vw] max-w-sm space-y-3">
        {toasts.map((t) => {
          const s = TOAST_STYLES[t.type];

          return (
            <div
              key={t.id}
              role="status"
              className={[
                "relative overflow-hidden rounded-2xl border shadow-lg",
                s.wrap,
                "transition-all duration-200 ease-out",
                t.exiting
                  ? "opacity-0 -translate-y-2"
                  : "opacity-100 translate-y-0",
              ].join(" ")}
            >
              {/* left accent */}
              <div
                className={`absolute left-0 top-0 h-full w-1.5 ${s.accent}`}
              />

              <div className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5">
                  <ToastIcon type={t.type} className={s.icon} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${s.title} truncate`}>
                    {t.message}
                  </div>
                  {t.description ? (
                    <div className={`text-xs mt-1 leading-snug ${s.desc}`}>
                      {t.description}
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => beginRemove(t.id)}
                  className={[
                    "p-1 rounded-lg transition",
                    "hover:bg-black/5 active:scale-95",
                    s.close,
                  ].join(" ")}
                  aria-label="Close"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

function ToastIcon({
  type,
  className,
}: {
  type: ToastType;
  className?: string;
}) {
  const cls = `h-5 w-5 ${className ?? ""}`;
  if (type === "success") return <CheckCircle2 className={cls} />;
  if (type === "danger") return <XCircle className={cls} />;
  if (type === "warning") return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider />");
  return ctx;
}
