import React, { useEffect, useState } from 'react';
import {
  initJurySession,
  simulateTicketTime,
  resetDemoDatabase,
  fetchSampleManifest,
} from './jury-api.js';
import { dispatchJuryEvent, JURY_ROLE_KEY, JURY_TOKEN_KEY } from '../../services/api.js';

const PRESET_LOCATIONS = [
  { label: 'Alun-Alun Sidoarjo', lat: -7.4461, lng: 112.7181 },
  { label: 'Jl. Ahmad Yani Sidoarjo', lat: -7.4418, lng: 112.7195 },
  { label: 'Taman Bungkul Surabaya', lat: -7.2914, lng: 112.7398 },
];

export default function JuryPanel({
  onRoleChange,
  onSimulatedGpsChange,
  onSimulatedCapture,
  onDemoReset,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(JURY_TOKEN_KEY) || '');
  const [availableRoles, setAvailableRoles] = useState([
    'WARGA_PELAPOR',
    'WARGA_VALIDATOR',
    'WARGA_VALIDATOR_2',
    'WARGA_BARU',
    'ADMIN_DISHUB',
    'ADMIN_DPU',
    'ADMIN_DLH',
    'ADMIN_SATPOLPP',
  ]);
  const [activeRole, setActiveRole] = useState(
    () => sessionStorage.getItem(JURY_ROLE_KEY) || 'WARGA_PELAPOR'
  );

  const [lat, setLat] = useState(-7.4461);
  const [lng, setLng] = useState(112.7181);

  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState('/samples/jalan_berlubang.webp');

  const [ticketId, setTicketId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('jury_token');

    async function bootstrap() {
      if (urlToken) {
        try {
          setLoading(true);
          setErrorMsg('');
          const session = await initJurySession(urlToken);
          const token = session.token || session.sessionToken || urlToken;
          const initialRole = sessionStorage.getItem(JURY_ROLE_KEY) || 'WARGA_PELAPOR';
          sessionStorage.setItem(JURY_TOKEN_KEY, token);
          sessionStorage.setItem(JURY_ROLE_KEY, initialRole);
          setSessionToken(token);
          if (Array.isArray(session.availableRoles) && session.availableRoles.length > 0) {
            setAvailableRoles(session.availableRoles);
          }
          if (onRoleChange) {
            await Promise.resolve(onRoleChange(initialRole, token)).catch(() => {});
          }
          setStatusMsg('Mode Simulasi Juri aktif.');
        } catch (err) {
          setErrorMsg(err.message);
        } finally {
          setLoading(false);
        }
      }

      try {
        const manifest = await fetchSampleManifest();
        const list = Array.isArray(manifest?.samples) ? manifest.samples : [];
        setSamples(list);
        if (list.length > 0) {
          setSelectedSample(list[0].file || list[0].path || '');
        }
      } catch {
        // Manifest opsional jika belum tersedia di dev lokal
      }
    }

    bootstrap();
  }, []);

  if (!sessionToken) return null;

  async function handleRoleSwitch(nextRole) {
    setActiveRole(nextRole);
    sessionStorage.setItem(JURY_ROLE_KEY, nextRole);
    setErrorMsg('');
    try {
      if (onRoleChange) await Promise.resolve(onRoleChange(nextRole, sessionToken));
      setStatusMsg(`Peran aktif diubah ke: ${nextRole}`);
    } catch (err) {
      setErrorMsg(err?.message || 'Gagal mengganti peran simulasi.');
    }
  }

  function handleApplyGps(nextLat = lat, nextLng = lng) {
    const coords = {
      lat: Number(nextLat),
      lng: Number(nextLng),
      accuracyMeters: 10,
      isSimulated: true,
    };
    setLat(coords.lat);
    setLng(coords.lng);
    setStatusMsg(`GPS simulasi disetel: ${coords.lat}, ${coords.lng}`);
    dispatchJuryEvent('gps', coords);
    if (onSimulatedGpsChange) onSimulatedGpsChange(coords);
  }

  function handleSimulateCapture() {
    if (!selectedSample) {
      setErrorMsg('Pilih foto sampel terlebih dahulu.');
      return;
    }
    const detail = {
      samplePath: selectedSample,
      isDemoData: true,
      lat: Number(lat),
      lng: Number(lng),
      sessionToken,
    };
    setErrorMsg('');
    setStatusMsg(`Simulasi jepret memakai: ${selectedSample}`);
    dispatchJuryEvent('capture', detail);
    if (onSimulatedCapture) {
      onSimulatedCapture(detail);
    }
  }

  async function handleShiftTime(hours) {
    if (!ticketId.trim()) {
      setErrorMsg('Masukkan ID Tiket Demo terlebih dahulu.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await simulateTicketTime({
        ticketId: ticketId.trim(),
        shiftHours: hours,
        sessionToken,
      });
      setStatusMsg(`Tiket ${res.code || ticketId} dipercepat +${hours} jam (Status: ${res.status}).`);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetDemo() {
    if (!window.confirm('Reset seluruh data demo (isDemoData: true) dan bersihkan cache Redis?')) {
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      await resetDemoDatabase(sessionToken);
      setStatusMsg('Data demo berhasil di-reset ke kondisi awal.');
      dispatchJuryEvent('reset', {});
      if (onDemoReset) onDemoReset();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[92vw] rounded-xl border border-neutral-300 bg-white shadow-xl text-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-900 px-3 py-2 text-white rounded-t-xl">
        <span className="text-xs font-semibold tracking-wide">PANEL SIMULASI JURI (5 ALAT)</span>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="text-xs text-neutral-300 hover:text-white"
        >
          {isOpen ? 'Tutup' : 'Buka'}
        </button>
      </div>

      {isOpen && (
        <div className="max-h-[75vh] overflow-y-auto p-3 space-y-3 text-xs">
          {statusMsg && (
            <div className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-emerald-800">
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div className="rounded bg-red-50 border border-red-200 px-2.5 py-1.5 text-red-700">
              {errorMsg}
            </div>
          )}

          {/* 1. Role Switcher */}
          <div>
            <label className="block font-semibold mb-1">1. Ganti Peran (Role Switcher)</label>
            <select
              value={activeRole}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 bg-white"
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* 2. GPS Simulator */}
          <div>
            <label className="block font-semibold mb-1">2. Simulator GPS</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {PRESET_LOCATIONS.map((loc) => (
                <button
                  key={loc.label}
                  type="button"
                  onClick={() => handleApplyGps(loc.lat, loc.lng)}
                  className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-100"
                >
                  {loc.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-1/2 rounded border border-neutral-300 px-2 py-1"
                placeholder="Lat"
              />
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-1/2 rounded border border-neutral-300 px-2 py-1"
                placeholder="Lng"
              />
            </div>
            <button
              type="button"
              onClick={() => handleApplyGps()}
              className="mt-1.5 w-full rounded bg-neutral-800 py-1 text-white hover:bg-neutral-700"
            >
              Terapkan Koordinat GPS
            </button>
          </div>

          {/* 3. Simulasi Jepret Kamera */}
          <div>
            <label className="block font-semibold mb-1">3. Simulasi Jepret Kamera</label>
            <select
              value={selectedSample}
              onChange={(e) => setSelectedSample(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 bg-white mb-1.5"
            >
              {samples.length === 0 ? (
                <option value="/samples/jalan_berlubang.webp">Jalan Berlubang (Sampel)</option>
              ) : (
                samples.map((s) => (
                  <option key={s.id || s.file} value={s.file || s.path}>
                    {s.label || s.id || s.file}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleSimulateCapture}
              className="w-full rounded bg-neutral-800 py-1 text-white hover:bg-neutral-700"
            >
              Gunakan Foto Sampel Ini
            </button>
          </div>

          {/* 4. Percepat Waktu (+25j / +49j) */}
          <div>
            <label className="block font-semibold mb-1">4. Percepat Waktu SLA Tiket Demo</label>
            <input
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="ID Tiket Demo (mis. seed-tkt-04)"
              className="w-full rounded border border-neutral-300 px-2 py-1 mb-1.5"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleShiftTime(25)}
                className="w-1/2 rounded bg-amber-600 py-1 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                +25 Jam
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleShiftTime(49)}
                className="w-1/2 rounded bg-orange-600 py-1 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                +49 Jam
              </button>
            </div>
          </div>

          {/* 5. Reset Demo */}
          <div className="pt-1 border-t border-neutral-200">
            <button
              type="button"
              disabled={loading}
              onClick={handleResetDemo}
              className="w-full rounded bg-red-600 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              5. Reset Data Demo (Isolasi isDemoData)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
