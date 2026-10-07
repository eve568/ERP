function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusLabel(status) {
  return status === 'ACTIVE' ? 'Activo' : 'Inactivo';
}

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX');
}

function rowsHtml(customers) {
  return customers.map((customer) => `
    <tr>
      <td>${escapeHtml(customer.name)}</td>
      <td>${escapeHtml(customer.taxId || '')}</td>
      <td>${escapeHtml(customer.email || '')}</td>
      <td>${escapeHtml(customer.phone || '')}</td>
      <td>${escapeHtml(statusLabel(customer.status))}</td>
      <td>${escapeHtml(dateLabel(customer.createdAt))}</td>
    </tr>`).join('');
}

function reportTable(customers) {
  return `
    <table>
      <thead><tr><th>Nombre</th><th>RFC</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th>Registro</th></tr></thead>
      <tbody>${rowsHtml(customers)}</tbody>
    </table>`;
}

export function exportCustomersExcel(customers) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('La exportación a Excel está disponible en la versión web.');
  }
  const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body>${reportTable(customers)}</body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clientes-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function openCustomerPdfWindow() {
  if (typeof window === 'undefined') {
    throw new Error('La exportación a PDF está disponible en la versión web.');
  }
  const report = window.open('', '_blank');
  if (!report) throw new Error('Permite ventanas emergentes para generar el PDF.');
  report.document.write('<!doctype html><html><body style="font-family:Arial;padding:28px">Preparando reporte...</body></html>');
  report.document.close();
  return report;
}

export function exportCustomersPdf(customers, report) {
  if (!report || report.closed) {
    throw new Error('No fue posible abrir el reporte. Permite ventanas emergentes.');
  }

  const generatedAt = new Date().toLocaleString('es-MX');
  report.document.write(`<!doctype html>
  <html><head><meta charset="UTF-8"><title>Reporte de clientes</title>
  <style>
    body{font-family:Arial,sans-serif;color:#172033;padding:28px}
    h1{margin:0 0 6px;font-size:24px}.meta{color:#667085;margin-bottom:22px;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #d0d5dd;padding:7px;text-align:left;vertical-align:top}
    th{background:#f2f4f7} @page{size:landscape;margin:12mm}
  </style></head><body>
  <h1>Reporte de clientes</h1>
  <div class="meta">Generado: ${escapeHtml(generatedAt)} · Total: ${customers.length}</div>
  ${reportTable(customers)}
  <script>window.onload=()=>{window.print();};<\/script>
  </body></html>`);
  report.document.close();
}
