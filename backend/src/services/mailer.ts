import nodemailer from 'nodemailer';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const sentMessages: { to: string; subject: string; text: string }[] = [];

export async function sendMail(input: { to: string; subject: string; text: string }) {
  const env = getEnv();
  if (env.NODE_ENV === 'test') {
    sentMessages.push(input);
    return;
  }

  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    throw new ApiError(503, "L'envoi d'e-mail n'est pas configuré sur le serveur", 'EMAIL_NOT_CONFIGURED');
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  try {
    await transport.sendMail({
      from: senderAddress(env.SMTP_FROM, env.SMTP_USER),
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch {
    throw new ApiError(502, "L'e-mail n'a pas pu être envoyé", 'EMAIL_FAILED');
  }
}

function senderAddress(from: string, user: string) {
  const label = from.trim();
  if (label.includes('@')) return label;
  if (user.includes('@')) return `"${label.replace(/"/g, '') || 'MediCare'}" <${user}>`;
  return label;
}
