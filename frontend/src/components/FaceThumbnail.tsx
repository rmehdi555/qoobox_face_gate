import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

import { api } from "../services/api";

export function FaceThumbnail({ imageId, alt, className }: { imageId: string | null; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .faceFileUrl(imageId)
      .then((created) => {
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        objectUrl = created;
        setUrl(created);
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageId]);

  if (!imageId || !url) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className ?? "h-10 w-10 rounded-full"}`}>
        <UserRound className="h-5 w-5" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className ?? "h-10 w-10 rounded-full object-cover"} />;
}
