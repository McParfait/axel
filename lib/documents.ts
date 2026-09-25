import { del, put } from "@vercel/blob";
import { prisma } from "./prisma";

export type DocumentKind =
  | "loading_note"
  | "delivery_note"
  | "signature_driver"
  | "signature_receiver"
  | "gauge_photo"
  | "other";

export type DocumentDTO = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
};

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const MAX_BYTES = 4_000_000;

const KIND_LABEL: Record<DocumentKind, string> = {
  loading_note: "Bon de chargement",
  delivery_note: "Bon de livraison",
  signature_driver: "Signature chauffeur",
  signature_receiver: "Signature réceptionnaire",
  gauge_photo: "Photo de jauge",
  other: "Pièce jointe",
};

const KINDS = new Set<DocumentKind>([
  "loading_note",
  "delivery_note",
  "signature_driver",
  "signature_receiver",
  "gauge_photo",
  "other",
]);

export function isDocumentKind(value: string): value is DocumentKind {
  return KINDS.has(value as DocumentKind);
}

export function serializeDocuments(
  documents: {
    id: string;
    kind: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    blobUrl: string;
    createdAt: Date;
  }[],
): DocumentDTO[] {
  return documents.map((document) => ({
    id: document.id,
    kind: document.kind as DocumentKind,
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    url: document.blobUrl,
    createdAt: document.createdAt.toISOString(),
  }));
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "piece";
}

export async function uploadMissionDocument(
  missionId: string,
  kind: DocumentKind,
  file: File,
) {
  if (!file.size) throw new Error("Fichier vide.");
  if (file.size > MAX_BYTES) {
    throw new Error("Fichier trop volumineux (4 Mo maximum).");
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Format accepté : PDF, JPG, PNG ou WEBP.");
  }

  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    select: { id: true, tenantId: true, code: true },
  });

  const pathname = `profuel/${mission.tenantId}/${mission.code}/${kind}/${Date.now()}-${safeName(file.name)}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });

  await prisma.missionDocument.create({
    data: {
      missionId,
      kind,
      fileName: file.name || `${kind}.bin`,
      contentType,
      sizeBytes: file.size,
      blobUrl: blob.url,
      pathname: blob.pathname,
    },
  });

  await prisma.missionEvent.create({
    data: {
      missionId,
      type: "document_uploaded",
      label: `${KIND_LABEL[kind]} enregistré`,
      detail: file.name || pathname,
      status: "done",
    },
  });
}

export async function deleteMissionDocument(documentId: string) {
  const document = await prisma.missionDocument.findUniqueOrThrow({
    where: { id: documentId },
  });
  await del(document.blobUrl);
  await prisma.missionDocument.delete({ where: { id: documentId } });
  return document.missionId;
}
