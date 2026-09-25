import { NextRequest, NextResponse } from "next/server";
import {
  arriveAtStation,
  certifyLoading,
  closeMission,
  saveCompartments,
  saveReceipts,
  simulateLoss,
} from "@/lib/missions";

const actions = {
  certify: certifyLoading,
  "simulate-loss": simulateLoss,
  arrive: arriveAtStation,
  close: closeMission,
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    action: keyof typeof actions | "compartments" | "receipts";
    litres?: number[];
  };

  try {
    if (body.action === "compartments") {
      const mission = await saveCompartments(id, body.litres ?? []);
      return NextResponse.json({ mission });
    }
    if (body.action === "receipts") {
      const mission = await saveReceipts(id, body.litres ?? []);
      return NextResponse.json({ mission });
    }
    const run = actions[body.action];
    if (!run) {
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
    const mission = await run(id);
    return NextResponse.json({ mission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mise à jour impossible" },
      { status: 500 },
    );
  }
}
