export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export type PasswordResetEmailInput = {
  to: string;
  recipientName: string;
  resetUrl: string;
};

export type OrderConfirmationEmailInput = {
  to: string;
  recipientName: string;
  orderNumber: string;
  total: string;
  currency: string;
};

