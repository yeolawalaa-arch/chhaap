import { z } from "zod";

/**
 * Validates a `BrandIdentitySpec` arriving from an untrusted guest client.
 *
 * Guest routes (export, alternatives) receive the spec in the request body
 * rather than loading it from a row, because a guest brand exists only in the
 * browser tab that generated it — there is no server-side record to load it
 * from. That means the spec is attacker-controlled and must be validated
 * structurally before it reaches a renderer, exactly like any other user input
 * at a trust boundary.
 *
 * Shared between /api/try/export and /api/try/alternatives so the two never
 * drift into accepting different shapes of the same object.
 */
export const guestSpecSchema = z.object({
  directionId: z.string().max(60),
  name: z.string().min(1).max(60),
  descriptor: z.string().max(80).optional(),
  localName: z.string().max(80).optional(),
  language: z.string().max(12),
  script: z.string().max(20),
  palette: z.record(
    z.string().max(20),
    z.object({
      role: z.string().max(20),
      name: z.string().max(40),
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      rgb: z.array(z.number()).length(3),
      cmyk: z.array(z.number()).length(4),
      meaning: z.string().max(600).optional(),
    }),
  ),
  typography: z.object({
    display: z.object({
      family: z.string().max(60),
      weight: z.number().int().min(100).max(900),
      letterSpacing: z.number().min(-0.5).max(1),
      transform: z.enum(["none", "uppercase", "lowercase"]),
    }),
    body: z.object({
      family: z.string().max(60),
      weight: z.number().int().min(100).max(900),
      letterSpacing: z.number().min(-0.5).max(1),
      transform: z.enum(["none", "uppercase", "lowercase"]),
    }),
    local: z
      .object({
        family: z.string().max(60),
        weight: z.number().int().min(100).max(900),
        letterSpacing: z.number().min(-0.5).max(1),
        transform: z.enum(["none", "uppercase", "lowercase"]),
      })
      .optional(),
    scaleRatio: z.number().min(1).max(3),
  }),
  mark: z.object({
    style: z.string().max(30),
    glyph: z.string().max(40).optional(),
    initials: z.string().max(4).optional(),
    enclosure: z.string().max(30),
    strokeWeight: z.number().min(1).max(30),
    fillStyle: z.string().max(20),
    symmetry: z.number().int().min(2).max(12),
    cornerRadius: z.number().min(0).max(50),
    inset: z.number().min(0.1).max(1),
  }),
  patterns: z
    .array(
      z.object({
        kind: z.string().max(30),
        scale: z.number().min(0.1).max(5),
        opacity: z.number().min(0).max(1),
        colors: z.array(z.string().max(20)).max(4),
      }),
    )
    .max(6),
  layout: z.object({
    clearSpace: z.number().min(0).max(4),
    radius: z.number().min(0).max(60),
    unit: z.number().min(1).max(64),
    borderWidth: z.number().min(0).max(20),
  }),
  lockup: z.enum(["stacked", "horizontal", "badge"]),
});

/** Loose validation for the strategy blob — used for the guidelines PDF only. */
export const guestStrategySchema = z.record(z.string(), z.unknown());
