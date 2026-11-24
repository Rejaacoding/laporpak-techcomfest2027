const API_BASE = '/api';

export async function initJurySession(juryToken) {
  const res = await fetch(`${API_BASE}/jury/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ juryToken }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || 'Gagal memulai sesi juri');
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
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || 'Gagal mempercepat waktu tiket');
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
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || 'Gagal mereset data demo');
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
