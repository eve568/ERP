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


function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function sendCustomerWelcomeEmail({ to, customerName, companyName }) {
  const safeCustomerName = escapeHtml(customerName);
  const safeCompanyName = escapeHtml(companyName || 'nuestra empresa');

  return sendEmail({
    to,
    subject: `Registro confirmado - ${companyName || 'ERP Modular'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2>¡Bienvenido, ${safeCustomerName}!</h2>
        <p>Tu registro como cliente de <strong>${safeCompanyName}</strong> se realizó correctamente.</p>
        <p>Ya formas parte de nuestros clientes y tus datos quedaron registrados en nuestro sistema.</p>
        <p style="margin-top:28px">Gracias por confiar en nosotros.</p>
        <p style="color:#6b7280;font-size:13px">Este es un mensaje automático; no es necesario responderlo.</p>
      </div>
    `,
  });
}
