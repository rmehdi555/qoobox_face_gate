import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Camera, ChevronDown, LayoutDashboard, LogOut, Mic, ScanFace, Settings, Users, Video } from "lucide-react";
import clsx from "clsx";

import { useAuth } from "../hooks/useAuth";

const primaryLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/session", label: "Live Session", icon: Video, end: false },
];

const settingsLinks = [
  { to: "/people", label: "People", icon: Users, end: true },
  { to: "/people/new", label: "Add Person", icon: ScanFace, end: false },
  { to: "/live", label: "Live Recognition", icon: Camera, end: false },
  { to: "/speech", label: "Speech to Text", icon: Mic, end: false },
];

function isSettingsPath(pathname: string): boolean {
  return (
    pathname === "/people" ||
    pathname.startsWith("/people/") ||
    pathname === "/live" ||
    pathname === "/speech"
  );
}

function navClass(isActive: boolean) {
  return clsx(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
    isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const settingsActive = isSettingsPath(location.pathname);
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  useEffect(() => {
    if (settingsActive) {
      setSettingsOpen(true);
    }
  }, [settingsActive]);

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
        {primaryLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) => navClass(isActive)}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}

        <div>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className={clsx(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              settingsActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
            aria-expanded={settingsOpen}
          >
            <Settings className="h-4 w-4" />
            <span className="flex-1 text-left">Settings</span>
            <ChevronDown className={clsx("h-4 w-4 transition", settingsOpen && "rotate-180")} />
          </button>
          {settingsOpen ? (
            <div className="mt-1 space-y-1 border-l border-white/10 pl-3 ml-4">
              {settingsLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={onNavigate}
                  className={({ isActive }) => navClass(isActive)}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>
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
