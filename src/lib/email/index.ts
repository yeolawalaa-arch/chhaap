import { env } from "@/lib/config/env";

/**
 * Transactional email.
 *
 * The console driver is the default and prints the full message — including OTP
 * codes and reset links — to the server log. That is correct for local
 * development, and `integrationStatus()` reports email as not live so the UI
 * can tell the user their code is in the terminal rather than their inbox.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDriver {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

class ConsoleDriver implements EmailDriver {
  readonly name = "console";
  async send(message: EmailMessage): Promise<void> {
    console.log(
      [
        "",
        "┌─ email ────────────────────────────────────────────────",
        `│ to:      ${message.to}`,
        `│ subject: ${message.subject}`,
        "├────────────────────────────────────────────────────────",
        ...message.text.split("\n").map((l) => `│ ${l}`),
        "└────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}

class ResendDriver implements EmailDriver {
  readonly name = "resend";
  constructor(private apiKey: string) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }
}

/**
 * SMTP is declared but not implemented — sending it properly needs a mail
 * library, and shipping a broken driver would be worse than an explicit error.
 * The integration point is here for whoever needs it.
 */
class SmtpDriver implements EmailDriver {
  readonly name = "smtp";
  async send(): Promise<void> {
    throw new Error(
      "The SMTP driver is not implemented. Install nodemailer and complete src/lib/email/index.ts, " +
        "or use EMAIL_PROVIDER=resend.",
    );
  }
}

let driver: EmailDriver | null = null;

export function emailDriver(): EmailDriver {
  if (driver) return driver;
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      driver = env.RESEND_API_KEY ? new ResendDriver(env.RESEND_API_KEY) : new ConsoleDriver();
      break;
    case "smtp":
      driver = new SmtpDriver();
      break;
    default:
      driver = new ConsoleDriver();
  }
  return driver;
}

/** Send that never throws into a request path — delivery is best-effort. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    await emailDriver().send(message);
    return true;
  } catch (err) {
    console.error("[email] send failed:", (err as Error).message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const wrap = (title: string, body: string) =>
  `${title}\n${"─".repeat(title.length)}\n\n${body}\n\n— ${env.APP_NAME}`;

export const templates = {
  otp: (code: string) => ({
    subject: `${code} is your ${env.APP_NAME} sign-in code`,
    text: wrap(
      "Your sign-in code",
      `Enter this code to sign in:\n\n    ${code}\n\nIt expires in 10 minutes.\nIf you didn't ask for this, you can ignore this email.`,
    ),
  }),

  passwordReset: (url: string) => ({
    subject: `Reset your ${env.APP_NAME} password`,
    text: wrap(
      "Reset your password",
      `Open this link to choose a new password:\n\n${url}\n\nIt expires in 1 hour and can only be used once.\nIf you didn't ask for this, nothing has changed and you can ignore this email.`,
    ),
  }),

  verifyEmail: (url: string) => ({
    subject: `Confirm your email for ${env.APP_NAME}`,
    text: wrap("Confirm your email", `Open this link to confirm your address:\n\n${url}\n\nIt expires in 24 hours.`),
  }),

  welcome: (name: string) => ({
    subject: `Welcome to ${env.APP_NAME}`,
    text: wrap(
      `Welcome, ${name}`,
      `Your account is ready.\n\nStart by creating your first brand — you'll answer a few questions about your business and get a complete identity: logo, colours, type, and every asset you need to open.\n\n${env.APP_URL}/create`,
    ),
  }),
};
