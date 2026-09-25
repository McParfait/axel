import { NextRequest, NextResponse } from "next/server";
import { getCurrentMission, listTenants, resetMission } from "@/lib/missions";

export async function GET(request: NextRequest) {
  const tenant = request.nextUrl.searchParams.get("tenant") ?? "PID-CI";
  try {
    const [tenants, mission] = await Promise.all([
      listTenants(),
      getCurrentMission(tenant),
    ]);
    return NextResponse.json({ tenants, mission, tenant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lecture impossible" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { tenant?: string };
  try {
    const mission = await resetMission(body.tenant ?? "PID-CI");
    return NextResponse.json({ mission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Création impossible" },
      { status: 500 },
    );
  }
}
