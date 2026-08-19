import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Search, Trash2, Eye } from "lucide-react";

import { FaceThumbnail } from "../components/FaceThumbnail";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { usePageTitle } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { ApiError, api } from "../services/api";
import type { Person } from "../types";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function PeoplePage() {
  usePageTitle("People");
  const { notify } = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load(term?: string) {
    setError("");
    try {
      const data = await api.listPeople(term);
      setPeople(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load people");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredHint = useMemo(() => (search.trim() ? `Results for “${search.trim()}”` : ""), [search]);

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    try {
      await api.deletePerson(pendingDelete.id);
      notify("success", "Person deleted");
      setPendingDelete(null);
      await load(search.trim() || undefined);
    } catch (err) {
      notify("error", err instanceof ApiError ? err.message : "Unable to delete person");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">People</h1>
          <p className="mt-1 text-sm text-slate-500">Manage registered people and their face images.</p>
        </div>
        <Link to="/people/new" className="rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700">
          Add Person
        </Link>
      </div>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          void load(search.trim() || undefined);
        }}
      >
        <div className="flex-1">
          <Input
            name="search"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>
      {filteredHint ? <p className="text-xs text-slate-500">{filteredHint}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading ? (
        <Spinner label="Loading people..." />
      ) : people.length === 0 ? (
        <EmptyState
          title="No people yet"
          description="Register the first person and upload face images to enable live recognition."
          action={
            <Link to="/people/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
              Add Person
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">First Name</th>
                  <th className="px-4 py-3">Last Name</th>
                  <th className="px-4 py-3">Face Images</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <FaceThumbnail imageId={person.thumbnail_id} alt={`${person.first_name} ${person.last_name}`} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{person.first_name}</td>
                    <td className="px-4 py-3 text-slate-700">{person.last_name}</td>
                    <td className="px-4 py-3 text-slate-600">{person.face_count}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(person.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/people/${person.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="View">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link to={`/people/${person.id}/edit`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                          title="Delete"
                          onClick={() => setPendingDelete(person)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Person"
        description={`Delete ${pendingDelete?.first_name ?? ""} ${pendingDelete?.last_name ?? ""} and all associated face images? This cannot be undone.`}
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
