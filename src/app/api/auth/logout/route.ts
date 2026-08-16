import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { destroySession } from "@/lib/auth/session";

export const POST = handleRoute(async () => {
  await destroySession();
  return NextResponse.json({ ok: true, redirect: "/" });
});
