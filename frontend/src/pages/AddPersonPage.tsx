import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { ImageDropzone } from "../components/ImageDropzone";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { usePageTitle } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { ApiError, api } from "../services/api";

export function AddPersonPage() {
  usePageTitle("Add Person");
  const navigate = useNavigate();
  const { notify } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; images?: string }>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!firstName.trim()) {
      next.firstName = "First Name is required";
    }
    if (!lastName.trim()) {
      next.lastName = "Last Name is required";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }
    setSaving(true);
    try {
      const person = await api.createPerson(firstName.trim(), lastName.trim());
      try {
        for (const file of files) {
          await api.uploadFace(person.id, file);
        }
        notify("success", "Person saved");
      } catch (err) {
        notify(
          "error",
          `${err instanceof ApiError ? err.message : "Some images could not be uploaded"}. The person was created; you can add images from Edit Person.`,
        );
      }
      navigate(`/people/${person.id}`);
    } catch (err) {
      notify("error", err instanceof ApiError ? err.message : "Unable to save person");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Add Person</h1>
        <p className="mt-1 text-sm text-slate-500">Enter a name, then upload face images or take photos with the camera.</p>
      </div>
      <Card className="p-6">
        <form className="space-y-5" onSubmit={onSubmit}>
          <Input
            label="First Name"
            name="first_name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            error={errors.firstName}
          />
          <Input
            label="Last Name"
            name="last_name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            error={errors.lastName}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Face Images</p>
            <ImageDropzone files={files} onChange={setFiles} error={errors.images} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate("/people")}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Person"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
