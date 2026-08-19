import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";

import { FaceThumbnail } from "../components/FaceThumbnail";
import { ImageDropzone } from "../components/ImageDropzone";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { usePageTitle } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { ApiError, api } from "../services/api";
import type { Person } from "../types";

export function PersonEditorPage({ mode }: { mode: "view" | "edit" }) {
  usePageTitle(mode === "edit" ? "Edit Person" : "Person");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [person, setPerson] = useState<Person | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [deletePersonOpen, setDeletePersonOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) {
      return;
    }
    try {
      const data = await api.getPerson(id);
      setPerson(data);
      setFirstName(data.first_name);
      setLastName(data.last_name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load person");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) {
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      notify("error", "First Name and Last Name are required");
      return;
    }
    setSaving(true);
    try {
      await api.updatePerson(id, firstName.trim(), lastName.trim());
      for (const file of files) {
        await api.uploadFace(id, file);
      }
      setFiles([]);
      notify("success", "Person saved");
      await load();
    } catch (err) {
      notify("error", err instanceof ApiError ? err.message : "Unable to save person");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage() {
    if (!deleteImageId) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteFace(deleteImageId);
      notify("success", "Face image removed");
      setDeleteImageId(null);
      await load();
    } catch (err) {
      notify("error", err instanceof ApiError ? err.message : "Unable to delete image");
    } finally {
      setBusy(false);
    }
  }

  async function removePerson() {
    if (!id) {
      return;
    }
    setBusy(true);
    try {
      await api.deletePerson(id);
      notify("success", "Person deleted");
      navigate("/people");
    } catch (err) {
      notify("error", err instanceof ApiError ? err.message : "Unable to delete person");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Spinner label="Loading person..." />;
  }
  if (!person) {
    return <p className="text-sm text-rose-600">{error || "Person not found"}</p>;
  }

  const readOnly = mode === "view";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {readOnly ? `${person.first_name} ${person.last_name}` : "Edit Person"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Created At {new Date(person.created_at).toLocaleString()} · Updated At {new Date(person.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          {readOnly ? (
            <Link to={`/people/${person.id}/edit`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
              Edit Person
            </Link>
          ) : null}
          <Button variant="danger" type="button" onClick={() => setDeletePersonOpen(true)}>
            Delete Person
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <form className="space-y-5" onSubmit={onSubmit}>
          <Input label="First Name" name="first_name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={readOnly} />
          <Input label="Last Name" name="last_name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={readOnly} />

          <div>
            <p className="mb-3 text-sm font-medium text-slate-700">Face Images</p>
            {person.faces && person.faces.length > 0 ? (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {person.faces.map((face) => (
                  <div key={face.id} className="relative overflow-hidden rounded-xl border border-slate-200">
                    <FaceThumbnail imageId={face.id} alt={face.original_filename} className="h-32 w-full object-cover" />
                    {!readOnly ? (
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white"
                        onClick={() => setDeleteImageId(face.id)}
                        aria-label="Remove image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-slate-500">No face images uploaded yet.</p>
            )}
            {!readOnly ? <ImageDropzone files={files} onChange={setFiles} /> : null}
          </div>

          {!readOnly ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => navigate("/people")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Person"}
              </Button>
            </div>
          ) : null}
        </form>
      </Card>

      <ConfirmDialog
        open={deleteImageId !== null}
        title="Remove image"
        description="Delete this face image and its embedding?"
        loading={busy}
        onCancel={() => setDeleteImageId(null)}
        onConfirm={() => void removeImage()}
      />
      <ConfirmDialog
        open={deletePersonOpen}
        title="Delete Person"
        description="Delete this person and all associated face images? This cannot be undone."
        loading={busy}
        onCancel={() => setDeletePersonOpen(false)}
        onConfirm={() => void removePerson()}
      />
    </div>
  );
}
