import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Images, Mic, ScanFace, Users } from "lucide-react";

import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { usePageTitle } from "../components/ui/Toast";
import { api, ApiError } from "../services/api";
import type { DashboardStats } from "../types";

export function DashboardPage() {
  usePageTitle("Dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unable to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Spinner label="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Overview of registered people and recognition status.</p>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Users} label="Total People" value={stats?.total_people ?? 0} />
        <StatCard icon={Images} label="Total Face Images" value={stats?.total_face_images ?? 0} />
        <StatCard
          icon={ScanFace}
          label="Recognition System Status"
          value={stats?.model_loaded ? "Ready" : "Unavailable"}
          hint={
            stats
              ? `CPU · Threshold ${stats.threshold} · ${stats.registered_embeddings} embeddings`
              : undefined
          }
        />
      </div>
      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/people/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Add Person
          </Link>
          <Link to="/people" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            View People
          </Link>
          <Link to="/live" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Camera className="h-4 w-4" />
            Live Recognition
          </Link>
          <Link to="/speech" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Mic className="h-4 w-4" />
            Speech to Text
          </Link>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-brand-50 p-2 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
