"use client";

/**
 * Browser API client.
 *
 * One place that knows the server's error envelope, so every caller gets a
 * typed `ApiError` with field-level messages instead of hand-parsing responses.
 */

export interface ApiErrorPayload {
  code: string;
  message: string;
  fields?: Record<string, string>;
  upgrade?: boolean;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly status: number;
  readonly payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || "Something went wrong.");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code || "internal";
    this.fields = payload.fields ?? {};
    this.payload = payload;
  }

  /** True when the fix is to upgrade the plan, so the UI can offer that. */
  get needsUpgrade(): boolean {
    return this.code === "quota_exceeded" || this.code === "upgrade_required" || !!this.payload.upgrade;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, {
      code: "network",
      message: "Could not reach the server. Check your connection and try again.",
    });
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!isJson) {
    if (!res.ok) {
      throw new ApiError(res.status, { code: "internal", message: `Request failed (${res.status}).` });
    }
    return (await res.text()) as T;
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? { code: "internal", message: "Something went wrong." });
  }

  return json as T;
}

export const api = {
  get: <T,>(url: string) => request<T>(url),
  post: <T,>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T,>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T,>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T,>(url: string) => request<T>(url, { method: "DELETE" }),
};

/** Human message for any thrown value, for toast display. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
