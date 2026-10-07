import { env } from '../config/env.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export async function sendEmail({ to, subject, html, text }) {
  if (!env.resendApiKey) {
    const error = new Error('RESEND_API_KEY no está configurada');
    error.statusCode = 503;
    throw error;
  }

  const recipients = Array.isArray(to) ? to : [to];
  if (!recipients.length || recipients.some((recipient) => !recipient)) {
    const error = new Error('Se requiere al menos un destinatario');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: recipients,
      subject,
      html,
      ...(text ? { text } : {}),
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result.message || 'Resend rechazó el envío del correo');
    error.statusCode = response.status >= 500 ? 502 : 400;
    error.details = {
      provider: 'resend',
      providerStatus: response.status,
      providerError: result.name || result.message || 'unknown_error',
    };
    throw error;
  }

  return { id: result.id, provider: 'resend' };
}
