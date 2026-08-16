import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Typed application errors. API routes throw these; `handleRoute` converts them
 * into a consistent JSON envelope so the client toast layer can rely on a
 * single shape: `{ error: { code, message, fields? } }`.
 */

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "quota_exceeded"
  | "upgrade_required"
  | "provider_unavailable"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  quota_exceeded: 402,
  upgrade_required: 402,
  provider_unavailable: 503,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { fields?: Record<string, string>; meta?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fields = opts.fields;
    this.meta = opts.meta;
  }

  get status() {
    return STATUS[this.code];
  }
}

export const badRequest = (m: string, fields?: Record<string, string>) =>
  new AppError("bad_request", m, { fields });
export const unauthorized = (m = "Please sign in to continue.") => new AppError("unauthorized", m);
export const forbidden = (m = "You do not have access to this resource.") =>
  new AppError("forbidden", m);
export const notFound = (m = "Not found.") => new AppError("not_found", m);
export const conflict = (m: string) => new AppError("conflict", m);
export const rateLimited = (m: string, retryAfter?: number) =>
  new AppError("rate_limited", m, { meta: { retryAfter } });
export const quotaExceeded = (m: string, meta?: Record<string, unknown>) =>
  new AppError("quota_exceeded", m, { meta });

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const res = NextResponse.json(
      { error: { code: err.code, message: err.message, fields: err.fields, ...err.meta } },
      { status: err.status },
    );
    const retryAfter = err.meta?.retryAfter;
    if (typeof retryAfter === "number") res.headers.set("Retry-After", String(retryAfter));
    return res;
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".") || "_"] = issue.message;
    return NextResponse.json(
      { error: { code: "bad_request", message: "Please check the highlighted fields.", fields } },
      { status: 400 },
    );
  }

  // A database that is unreachable or has no schema is an operator problem, not
  // a user one. Saying "something went wrong" sends people to retry a form that
  // cannot possibly succeed, so name the actual cause instead.
  const message = err instanceof Error ? err.message : "";
  const isDbDown =
    /Can't reach database server|ECONNREFUSED|ENOTFOUND|Environment variable not found: DATABASE_URL/i.test(message) ||
    // What Prisma actually says when DATABASE_URL is unset: it validates the
    // datasource before attempting a connection, so the failure surfaces as a
    // protocol complaint rather than a missing-variable error.
    /the URL must start with the protocol|Invalid `prisma\..+` invocation/i.test(message);
  const isSchemaMissing = /does not exist in the current database|relation ".+" does not exist|P2021/i.test(message);

  if (isDbDown || isSchemaMissing) {
    console.error("[database]", message);
    return NextResponse.json(
      {
        error: {
          code: "provider_unavailable",
          message: isSchemaMissing
            ? "The database is connected but has no schema yet. Migrations need to be run to finish setup."
            : "No database is connected to this deployment yet, so accounts are unavailable. Browsing and brand previews still work.",
        },
      },
      { status: 503 },
    );
  }

  console.error("[unhandled]", err);
  return NextResponse.json(
    { error: { code: "internal", message: "Something went wrong on our side." } },
    { status: 500 },
  );
}

/** Wraps a route handler so every throw becomes a well-formed error envelope. */
export function handleRoute<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
