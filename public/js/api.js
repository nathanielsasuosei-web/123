/** Thin fetch wrapper: JSON in/out, cookies sent automatically, readable errors. */
export async function api(path, { method = 'GET', body, form } = {}) {
  const options = { method, credentials: 'same-origin', headers: {} };
  if (form) {
    options.body = form; // FormData: the browser sets the multipart boundary
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(path, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const error = new Error((data && data.error) || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Pesewas → "GHS 50.00" */
export const money = (pesewas, currency = 'GHS') => `${currency} ${(Number(pesewas) / 100).toFixed(2)}`;

export const dateTime = (value) => {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T') + (String(value).includes('T') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.classList.add('leave'), 3800);
  setTimeout(() => el.remove(), 4300);
}
