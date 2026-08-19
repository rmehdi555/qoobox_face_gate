import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

type Preview = { id: string; file: File; url: string };

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
};

export function ImageDropzone({ files, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previews]);

  function sync(next: File[]) {
    setPreviews((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.url));
      return next.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
      }));
    });
    onChange(next);
  }

  function addFiles(list: FileList | null) {
    if (!list) {
      return;
    }
    const incoming = Array.from(list).filter((file) => file.type.startsWith("image/"));
    sync([...files, ...incoming]);
  }

  function remove(index: number) {
    sync(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
        className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40"
      >
        <Upload className="mb-2 h-6 w-6 text-brand-600" />
        <span className="text-sm font-medium text-slate-800">Upload Images</span>
        <span className="mt-1 text-xs text-slate-500">JPG, JPEG, PNG, or WEBP. Drag and drop or click to browse.</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {previews.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {previews.map((item, index) => (
            <div key={item.id} className="relative overflow-hidden rounded-xl border border-slate-200">
              <img src={item.url} alt={item.file.name} className="h-28 w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
