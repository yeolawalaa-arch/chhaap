import { NextResponse } from "next/server";
import { handleRoute, quotaExceeded } from "@/lib/http/errors";
import { briefSchema } from "@/lib/http/schemas";
import { z } from "zod";
import { generateDirections } from "@/lib/brand/engine";
import { serializeGuestSpec } from "@/lib/brand/guest-serialize";
import { RULES, clientIp, consume, enforce } from "@/lib/security/rate-limit";
import type { BrandBrief } from "@/types/brand";

/**
 * Guest brand generation — no account, no persistence.
 *
 * The Brand Brain is a pure function of the brief: no database read, no write,
 * no external call. That makes an anonymous version of the core product
 * genuinely possible rather than a crippled teaser — everything a signed-in
 * user sees at the direction stage is computed here identically.
 *
 * Nothing is stored. The client holds the result, which is also why this cannot
 * leak between visitors.
 */

export const POST = handleRoute(async (req: Request) => {
  // The only abuse surface is CPU, so the limit is per IP and deliberately
  // generous enough for real evaluation. Falls back to an in-process counter
  // when the database is unavailable.
  await enforce(RULES.aiGenerate, `guest:${clientIp(req)}`);

  // The client sends a fresh salt when the visitor asks for different options.
  // Guest results are not persisted, so the salt is the only thing that can
  // make a re-roll differ.
  const body = briefSchema.extend({ salt: z.string().max(40).optional() }).parse(await req.json());
  const { salt, ...briefFields } = body;
  const brief = briefFields as BrandBrief;

  // Free generations without an account are capped the same way the signed-in
  // Free plan is (10), so evaluating the product never requires more than a
  // guest allowance's worth of taste-testing — past that, an account is the
  // next step, same as it is for a signed-in user out of monthly quota. Checked
  // after body validation so a malformed request never burns a real unit.
  const quota = await consume(RULES.guestGenerate, `guest-lifetime:${clientIp(req)}`);
  if (!quota.allowed) {
    throw quotaExceeded(
      `You've used all ${RULES.guestGenerate.limit} free generations. Create a free account for more, every month.`,
      { limit: RULES.guestGenerate.limit, upgrade: true },
    );
  }
  const directions = generateDirections({ brief, count: 6, salt: salt ?? "" });

  return NextResponse.json({
    remaining: quota.remaining,
    directions: directions.map((direction) => ({
      id: direction.id,
      label: direction.label,
      summary: direction.summary,
      score: direction.score,
      strategy: direction.strategy,
      ...serializeGuestSpec(direction.spec),
    })),
  });
});
