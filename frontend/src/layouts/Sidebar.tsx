import { NavLink } from "react-router-dom";
import { Camera, LayoutDashboard, LogOut, ScanFace, Users } from "lucide-react";
import clsx from "clsx";

import { useAuth } from "../hooks/useAuth";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/people", label: "People", icon: Users },
  { to: "/people/new", label: "Add Person", icon: ScanFace },
  { to: "/live", label: "Live Recognition", icon: Camera },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <aside className="flex h-full w-72 flex-col bg-slate-950 text-slate-200">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <ScanFace className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">FaceGate</p>
          <p className="text-xs text-slate-400">Face recognition admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/" || link.to === "/people"}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate px-2 text-xs text-slate-400">{user?.email}</p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
