import { NextRequest, NextResponse } from "next/server";
import { deleteMissionDocument } from "@/lib/documents";
import { getMissionById } from "@/lib/missions";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const missionId = await deleteMissionDocument(id);
    const mission = await getMissionById(missionId);
    return NextResponse.json({ mission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suppression impossible" },
      { status: 500 },
    );
  }
}
