import { NextRequest, NextResponse } from "next/server";
import { isDocumentKind, uploadMissionDocument } from "@/lib/documents";
import { getMissionById } from "@/lib/missions";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (!isDocumentKind(kind)) {
    return NextResponse.json({ error: "Type de pièce inconnu." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }

  try {
    await uploadMissionDocument(id, kind, file);
    const mission = await getMissionById(id);
    return NextResponse.json({ mission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload impossible" },
      { status: 500 },
    );
  }
}
