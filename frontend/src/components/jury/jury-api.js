const API_BASE = '/api';

function extractApiError(json, fallback) {
  if (typeof json?.error?.message === 'string') return json.error.message;
  if (typeof json?.message === 'string') return json.message;
  if (typeof json?.error === 'string') return json.error;
  return fallback;
}

export async function initJurySession(juryToken) {
  const res = await fetch(`${API_BASE}/jury/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ juryToken }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractApiError(json, 'Gagal memulai sesi juri'));
  }
  return json?.data || json;
}

export async function simulateTicketTime({ ticketId, shiftHours, sessionToken }) {
  const res = await fetch(`${API_BASE}/jury/tickets/${encodeURIComponent(ticketId)}/simulate-time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jury-token': sessionToken,
    },
    body: JSON.stringify({ shiftHours: Number(shiftHours) }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractApiError(json, 'Gagal mempercepat waktu tiket'));
  }
  return json?.data || json;
}

export async function resetDemoDatabase(sessionToken) {
  const res = await fetch(`${API_BASE}/jury/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jury-token': sessionToken,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractApiError(json, 'Gagal mereset data demo'));
  }
  return json?.data || json;
}

export async function fetchSampleManifest() {
  const res = await fetch('/samples/manifest.json');
  if (!res.ok) {
    throw new Error('Gagal memuat manifest foto sampel');
  }
  return res.json();
}
