import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { Sidebar } from "./Sidebar";

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <div className="hidden lg:block lg:h-screen lg:sticky lg:top-0">
        <Sidebar />
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <span className="font-semibold text-slate-900">FaceGate</span>
          <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg p-2 text-slate-700">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
