import type {
  EmailMessage,
  EmailService,
  OrderConfirmationEmailInput,
  PasswordResetEmailInput,
} from "./types";

class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      console.info("Email suppressed because no production provider is configured", {
        toDomain: message.to.split("@")[1] ?? "unknown",
        subject: message.subject,
      });
      return;
    }
    console.info("[development email preview]", {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

class ResendEmailService implements EmailService {
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<void> {
    const fromName = process.env.EMAIL_FROM_NAME ?? "JYS";
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    if (!fromAddress) throw new Error("EMAIL_FROM_ADDRESS is required for Resend");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the request (${response.status})`);
  }
}

export function getEmailService(): EmailService {
  if (process.env.EMAIL_PROVIDER === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    return new ResendEmailService(apiKey);
  }
  return new ConsoleEmailService();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const safeName = escapeHtml(input.recipientName);
  const safeUrl = escapeHtml(input.resetUrl);
  await getEmailService().send({
    to: input.to,
    subject: "Reset your JYS password | إعادة تعيين كلمة مرور JYS",
    text: `Hello ${input.recipientName}, reset your password using this link (valid for one hour): ${input.resetUrl}`,
    html: `<p>Hello ${safeName},</p><p><a href="${safeUrl}">Reset your password</a>. This link expires in one hour.</p>`,
  });
}

export async function sendOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): Promise<void> {
  await getEmailService().send({
    to: input.to,
    subject: `JYS order ${input.orderNumber} received`,
    text: `Hello ${input.recipientName}, your order ${input.orderNumber} was received. Total: ${input.total} ${input.currency}. Payment is cash.`,
    html: `<p>Hello ${escapeHtml(input.recipientName)},</p><p>Your order <strong>${escapeHtml(input.orderNumber)}</strong> was received.</p><p>Total: ${escapeHtml(input.total)} ${escapeHtml(input.currency)}. Payment is cash.</p>`,
  });
}

export type { EmailMessage, EmailService } from "./types";
