const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatCurrency(value) {
  const number = toNumber(value);

  if (number === null) {
    return null;
  }

  const fixed = Math.abs(number).toFixed(2);
  const [whole, decimals] = fixed.split('.');
  const grouped = whole.replace(THOUSANDS, ',');

  return `${number < 0 ? '-' : ''}$${grouped}.${decimals}`;
}

export function formatInteger(value) {
  const number = toNumber(value);

  if (number === null) {
    return null;
  }

  const whole = Math.trunc(Math.abs(number)).toString();

  return `${number < 0 ? '-' : ''}${whole.replace(THOUSANDS, ',')}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${formatDate(date)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatRelativeTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `hace ${days} d`;

  return formatDate(date);
}

export function formatPercent(value) {
  const number = toNumber(value);

  if (number === null) {
    return null;
  }

  return `${Math.round(number)}%`;
}
