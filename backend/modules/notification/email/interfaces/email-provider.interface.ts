import { SemanticFailureCategory } from "./semantic-failure.enum";

export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  metadata?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  provider: string;
  providerMessageId?: string;
  failureCategory?: SemanticFailureCategory;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
