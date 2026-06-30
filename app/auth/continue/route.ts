import { NextResponse } from "next/server";
import { getDefaultDashboard } from "@/lib/auth/membership";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL(await getDefaultDashboard(), request.url));
}
