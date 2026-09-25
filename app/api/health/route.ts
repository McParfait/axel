import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/missions";

export async function GET() {
  try {
    const status = await checkDatabase();
    return NextResponse.json({ provider: "neon", ...status });
  } catch (error) {
    return NextResponse.json(
      {
        provider: "neon",
        connected: false,
        error: error instanceof Error ? error.message : "Connexion impossible",
      },
      { status: 500 },
    );
  }
}
