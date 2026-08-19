import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; kind: "success" | "error"; message: string };

type ToastContextValue = {
  toasts: Toast[];
  notify: (kind: Toast["kind"], message: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);
  return createElement(ToastContext.Provider, { value }, children);
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
