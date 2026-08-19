import { useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

import { useToast } from "../../hooks/useToast";

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg",
            toast.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            toast.kind === "error" && "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <p>{toast.message}</p>
          <button type="button" onClick={() => dismiss(toast.id)} className="text-current/70 hover:text-current">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · FaceGate`;
  }, [title]);
}
