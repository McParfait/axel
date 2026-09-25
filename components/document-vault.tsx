"use client";

import type { DocumentDTO, DocumentKind } from "@/lib/documents";
import { FileText, Image as ImageIcon, PenLine, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

const KIND_META: Record<
  DocumentKind,
  { label: string; accept: string; capture?: boolean }
> = {
  loading_note: {
    label: "Bon de chargement",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
  },
  delivery_note: {
    label: "Bon de livraison",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
  },
  signature_driver: {
    label: "Signature chauffeur",
    accept: "image/png,image/jpeg",
    capture: true,
  },
  signature_receiver: {
    label: "Signature réceptionnaire",
    accept: "image/png,image/jpeg",
    capture: true,
  },
  gauge_photo: {
    label: "Photo de jauge",
    accept: "image/jpeg,image/png,image/webp",
  },
  other: {
    label: "Autre pièce",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
  },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function SignaturePad({
  disabled,
  onCapture,
}: {
  disabled?: boolean;
  onCapture: (file: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = point(event);
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = point(event);
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#001529";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stop = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `signature-${Date.now()}.png`, { type: "image/png" }));
      clear();
    }, "image/png");
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        width={520}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerLeave={stop}
      />
      <div className="signature-actions">
        <button type="button" className="button button-ghost" onClick={clear} disabled={disabled}>
          Effacer
        </button>
        <button type="button" className="button button-secondary" onClick={save} disabled={disabled}>
          Enregistrer la signature
        </button>
      </div>
    </div>
  );
}

export function DocumentVault({
  missionId,
  documents,
  kinds,
  disabled,
  onMission,
}: {
  missionId: string;
  documents: DocumentDTO[];
  kinds: DocumentKind[];
  disabled?: boolean;
  onMission: (mission: unknown) => void;
}) {
  const [kind, setKind] = useState<DocumentKind>(kinds[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendFile = async (file: File, selectedKind = kind) => {
    if (!missionId) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("kind", selectedKind);
      form.append("file", file);
      const response = await fetch(`/api/missions/${missionId}/documents`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload refusé");
      onMission(payload.mission);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Suppression refusée");
      onMission(payload.mission);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suppression impossible");
    } finally {
      setBusy(false);
    }
  };

  const visible = documents.filter((document) => kinds.includes(document.kind));
  const meta = KIND_META[kind];

  return (
    <section className="document-vault">
      <div className="compartment-title">
        <div>
          <strong>Pièces de mission</strong>
          <span>Stockées sur Vercel Blob et liées à cette mission Neon</span>
        </div>
      </div>
      <div className="document-controls">
        <label>
          Type de pièce
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as DocumentKind)}
            disabled={disabled || busy}
          >
            {kinds.map((item) => (
              <option key={item} value={item}>
                {KIND_META[item].label}
              </option>
            ))}
          </select>
        </label>
        <label className="file-button">
          <Upload size={16} />
          {busy ? "Envoi…" : "Ajouter un fichier"}
          <input
            type="file"
            accept={meta.accept}
            disabled={disabled || busy || !missionId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void sendFile(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {kind.startsWith("signature_") && (
        <SignaturePad
          disabled={disabled || busy || !missionId}
          onCapture={(file) => void sendFile(file, kind)}
        />
      )}
      {error && <p className="document-error">{error}</p>}
      <ul className="document-list">
        {visible.length === 0 && (
          <li className="document-empty">Aucune pièce pour le moment.</li>
        )}
        {visible.map((document) => (
          <li key={document.id}>
            <span className="doc-icon">
              {document.contentType.startsWith("image/") ? (
                <ImageIcon size={16} />
              ) : document.kind.startsWith("signature_") ? (
                <PenLine size={16} />
              ) : (
                <FileText size={16} />
              )}
            </span>
            <div>
              <a href={document.url} target="_blank" rel="noreferrer">
                {document.fileName}
              </a>
              <small>
                {KIND_META[document.kind].label} · {formatSize(document.sizeBytes)}
              </small>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Supprimer la pièce"
              disabled={busy}
              onClick={() => void remove(document.id)}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
