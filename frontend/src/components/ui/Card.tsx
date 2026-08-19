import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-2xl border border-slate-200 bg-white shadow-card", className)}>{children}</div>;
}
