import { env } from '../../config/env.js';

export async function sendEmail({ to, subject, html }) {
  if (!env.resendApiKey) {
    const error = new Error('RESEND_API_KEY no está configurada');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [to],
      subject,
      html,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result?.message ?? 'No fue posible enviar el correo');
    error.statusCode = 502;
    throw error;
  }

  return result;
}

export function sendTestEmail(to) {
  return sendEmail({
    to,
    subject: 'Prueba de correo - ERP Modular',
    html: '<h2>ERP Modular</h2><p>La integración con Resend funciona correctamente.</p>',
  });
}
