"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Play,
  Square,
  RotateCcw,
  Save,
  RefreshCw,
  Database,
  Wifi,
  WifiOff,
  Sliders,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface MachineOption {
  id: number;
  code: string;
  model: string | null;
  tonnage: number;
  isActive: boolean;
}

interface PartOption {
  id: number;
  partNo: string;
  name: string;
  isActive: boolean;
}

interface CountItem {
  in: number;
  out: number;
}

interface VisionStatus {
  model_loaded: boolean;
  loading: boolean;
  running: boolean;
  fps: number;
  resolution: string;
  counts: Record<string, CountItem>;
  total: number;
  error: string | null;
  config: {
    camera_source: string | number;
    model: string;
    imgsz: number;
    confidence: number;
    line_position: number;
    line_orientation: "horizontal" | "vertical";
    custom_classes: string[];
  };
}

interface CounterDbRow {
  id: number;
  sessionId: string;
  itemLabel: string;
  countIn: number;
  countOut: number;
  totalQty: number;
  machineCode: string | null;
  partNo: string | null;
  partName: string | null;
  operatorName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PartCounterViewProps {
  machinesList: MachineOption[];
  partsList: PartOption[];
}

function makeSessionId() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CNT-${stamp}-${rand}`;
}

export default function PartCounterView({
  machinesList,
  partsList,
}: PartCounterViewProps) {
  const [serverUrl, setServerUrl] = useState("http://localhost:8000");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<VisionStatus | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Form & kontrol
  const [cameraSource, setCameraSource] = useState("0");
  const [modelName, setModelName] = useState("yolov8n.pt");
  const [imgsz, setImgsz] = useState("640");
  const [customClassesText, setCustomClassesText] = useState("pen, marker, bottle, cup, box");
  const [lineOrientation, setLineOrientation] = useState<"horizontal" | "vertical">("vertical");
  const [linePosition, setLinePosition] = useState(0.5);
  const [confidence, setConfidence] = useState(0.25);
  const [configInitialized, setConfigInitialized] = useState(false);

  // Konteks Master Data & Auto-Save DB
  const [sessionId, setSessionId] = useState<string>(() => makeSessionId());
  const [selectedMachineCode, setSelectedMachineCode] = useState("");
  const [selectedPartNo, setSelectedPartNo] = useState("");
  const [notes, setNotes] = useState("");
  const [autoSave, setAutoSave] = useState(true);
  const [savingDb, setSavingDb] = useState(false);
  const [lastSavedText, setLastSavedText] = useState<string | null>(null);
  const [dbLogs, setDbLogs] = useState<CounterDbRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [streamKey, setStreamKey] = useState(1);

  const lastSavedSignatureRef = useRef<string>("");
  const savingLockRef = useRef(false);

  useEffect(() => {
    const savedUrl = window.localStorage.getItem("partCounterPythonUrl");
    if (savedUrl) {
      queueMicrotask(() => setServerUrl(savedUrl));
    }
  }, []);

  const fetchDbLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/part-counter", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDbLogs(json.data);
      }
    } catch (err) {
      console.error("Gagal load log DB:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/part-counter", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success && Array.isArray(json.data)) {
          setDbLogs(json.data);
        }
      })
      .catch((err) => console.error("Gagal load log DB:", err));
    return () => {
      mounted = false;
    };
  }, []);

  const saveCountsToDb = useCallback(
    async (countsToSave: Record<string, CountItem>, force = false) => {
      const entries = Object.entries(countsToSave).filter(
        ([, v]) => (v?.in || 0) + (v?.out || 0) > 0
      );
      if (entries.length === 0) return;

      const selectedPart = partsList.find((p) => p.partNo === selectedPartNo);
      const payload = {
        sessionId,
        machineCode: selectedMachineCode || null,
        partNo: selectedPartNo || null,
        partName: selectedPart?.name || null,
        notes: notes || null,
        counts: countsToSave,
      };

      const signature = JSON.stringify(payload);
      if (!force && signature === lastSavedSignatureRef.current) return;
      if (savingLockRef.current) return;

      savingLockRef.current = true;
      setSavingDb(true);
      try {
        const res = await fetch("/api/part-counter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          lastSavedSignatureRef.current = signature;
          const timeStr = new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          setLastSavedText(`Tersimpan ke DB (${timeStr})`);
          fetchDbLogs();
        }
      } catch (err) {
        console.error("Gagal simpan ke DB:", err);
      } finally {
        savingLockRef.current = false;
        setSavingDb(false);
      }
    },
    [sessionId, selectedMachineCode, selectedPartNo, notes, partsList, fetchDbLogs]
  );

  // Polling status Python server
  useEffect(() => {
    let active = true;
    const cleanUrl = serverUrl.replace(/\/+$/, "");

    const poll = async () => {
      try {
        const res = await fetch(`${cleanUrl}/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as VisionStatus;
        if (!active) return;

        setConnected(true);
        setStatus(data);
        setServerError(data.error);

        if (!configInitialized && data.config) {
          setCameraSource(String(data.config.camera_source ?? 0));
          setModelName(data.config.model || "yolov8n.pt");
          setImgsz(String(data.config.imgsz || 640));
          setLineOrientation(data.config.line_orientation || "vertical");
          setLinePosition(data.config.line_position ?? 0.5);
          setConfidence(data.config.confidence ?? 0.25);
          if (Array.isArray(data.config.custom_classes) && data.config.custom_classes.length > 0) {
            setCustomClassesText(data.config.custom_classes.join(", "));
          }
          setConfigInitialized(true);
        }

        if (autoSave && data.counts && data.total > 0) {
          saveCountsToDb(data.counts, false);
        }
      } catch {
        if (!active) return;
        setConnected(false);
      }
    };

    poll();
    const timer = setInterval(poll, 700);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [serverUrl, configInitialized, autoSave, saveCountsToDb]);

  const callPython = async (endpoint: string, body?: object) => {
    const cleanUrl = serverUrl.replace(/\/+$/, "");
    try {
      const res = await fetch(`${cleanUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok && json.message) {
        setServerError(json.message);
      } else if (json.status) {
        setStatus(json.status);
        setServerError(json.status.error || null);
      }
      return json;
    } catch {
      setConnected(false);
      setServerError("Tidak dapat terhubung ke Python Vision Server.");
      return null;
    }
  };

  const handleStart = async () => {
    setServerError(null);
    await callPython("/start", { camera_source: cameraSource });
    setStreamKey((k) => k + 1);
  };

  const handleStop = async () => {
    await callPython("/stop");
  };

  const handleReset = async () => {
    await callPython("/reset");
    setSessionId(makeSessionId());
    lastSavedSignatureRef.current = "";
    setLastSavedText(null);
  };

  const handlePushConfig = async (patch: Record<string, unknown>) => {
    await callPython("/config", patch);
  };

  const handleDeleteLog = async (id: number) => {
    try {
      const res = await fetch(`/api/part-counter?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchDbLogs();
      }
    } catch (err) {
      console.error("Gagal hapus log:", err);
    }
  };

  const cleanUrl = serverUrl.replace(/\/+$/, "");
  const counts = status?.counts || {};
  const countEntries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  const activeMachines = machinesList.filter((m) => m.isActive);
  const activeParts = partsList.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-sky-100 text-sky-700 shrink-0">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">Counter Part Conveyor (Kamera AI)</h1>
              {connected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Wifi className="w-3.5 h-3.5" />
                  Python Terhubung
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  <WifiOff className="w-3.5 h-3.5" />
                  Python Offline
                </span>
              )}
              {status?.running && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  LIVE ({status.fps} FPS)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sesi: <span className="font-mono font-semibold text-slate-700">{sessionId}</span>
              {lastSavedText && (
                <span className="ml-3 inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {lastSavedText}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Python Server URL */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Server Python:</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => {
              setServerUrl(e.target.value);
              window.localStorage.setItem("partCounterPythonUrl", e.target.value);
              setConfigInitialized(false);
            }}
            className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50 text-slate-800 w-52"
          />
          <button
            onClick={() => setStreamKey((k) => k + 1)}
            title="Refresh Stream"
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Python Vision Server belum aktif di {cleanUrl}</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Jalankan <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">run_web_server.bat</code> di folder{" "}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">conveyor_counter</code> agar kamera dan AI mulai mengirim feed ke halaman ini.
            </p>
          </div>
        </div>
      )}

      {serverError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-medium">
          Peringatan Server Python: {serverError}
        </div>
      )}

      {/* Main Grid: Video Feed + Control & Counter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kiri: Kamera Live + Konteks Master Data */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-sky-400">CAMERA STREAM</span>
              <span className="font-mono text-slate-400">
                Resolusi: {status?.resolution || "--"} | Model: {status?.config?.model || modelName}
              </span>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center relative">
              {connected ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={streamKey}
                  src={`${cleanUrl}/video_feed?k=${streamKey}`}
                  alt="Conveyor Camera Feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400 px-6">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">Menunggu koneksi Python Vision Server...</p>
                </div>
              )}
            </div>
          </div>

          {/* Pilih Mesin & Part dari Master Data */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-600" />
                Identitas Produksi & Penyimpanan Database
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600"
                />
                Auto-Save Setiap Barang Terhitung
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mesin (Master Data)</label>
                <select
                  value={selectedMachineCode}
                  onChange={(e) => setSelectedMachineCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="">-- Umum / Tanpa Mesin --</option>
                  {activeMachines.map((m) => (
                    <option key={m.id} value={m.code}>
                      {m.code} {m.model ? `(${m.model})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Part (Master Data)</label>
                <select
                  value={selectedPartNo}
                  onChange={(e) => setSelectedPartNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="">-- Sesuai Label Kamera --</option>
                  {activeParts.map((p) => (
                    <option key={p.id} value={p.partNo}>
                      {p.partNo} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan (Opsional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Line Conveyor 1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Kanan: Kontrol Sensor & Tabel Hitungan Live */}
        <div className="lg:col-span-5 space-y-4">
          {/* Kontrol Kamera & Garis */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              Kontrol Sensor & AI
            </h2>

            <div className="flex gap-2">
              <input
                type="text"
                value={cameraSource}
                onChange={(e) => setCameraSource(e.target.value)}
                placeholder="0 atau rtsp://..."
                className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg text-slate-800"
              />
              <button
                onClick={handleStart}
                disabled={!connected || status?.running || !status?.model_loaded}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" /> Start
              </button>
              <button
                onClick={handleStop}
                disabled={!connected || !status?.running}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Model AI</label>
                <select
                  value={modelName}
                  onChange={(e) => {
                    setModelName(e.target.value);
                    handlePushConfig({ model: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="yolov8s-worldv2.pt">yolov8s-worldv2.pt (Custom/Kecil)</option>
                  <option value="yolov8n.pt">yolov8n.pt (Cepat/COCO)</option>
                  <option value="yolov8s.pt">yolov8s.pt (Akurat/COCO)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Resolusi AI (imgsz)</label>
                <select
                  value={imgsz}
                  onChange={(e) => {
                    setImgsz(e.target.value);
                    handlePushConfig({ imgsz: Number(e.target.value) });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="640">640 (Cepat)</option>
                  <option value="960">960 (Objek Kecil)</option>
                  <option value="1280">1280 (Sangat Kecil)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Daftar Barang (untuk YOLO-World, pisah koma)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customClassesText}
                  onChange={(e) => setCustomClassesText(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-800"
                />
                <button
                  onClick={() => handlePushConfig({ custom_classes: customClassesText })}
                  disabled={!connected}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  Set
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                  <span>Garis: {Math.round(linePosition * 100)}%</span>
                  <div className="flex gap-2">
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={lineOrientation === "horizontal"}
                        onChange={() => {
                          setLineOrientation("horizontal");
                          handlePushConfig({ line_orientation: "horizontal" });
                        }}
                      />
                      H
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={lineOrientation === "vertical"}
                        onChange={() => {
                          setLineOrientation("vertical");
                          handlePushConfig({ line_orientation: "vertical" });
                        }}
                      />
                      V
                    </label>
                  </div>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={linePosition}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLinePosition(val);
                    handlePushConfig({ line_position: val });
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Confidence: {Math.round(confidence * 100)}%
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  value={confidence}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setConfidence(val);
                    handlePushConfig({ confidence: val });
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Hasil Hitungan Live */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Hitungan Real-Time</h2>
              <span className="text-2xl font-extrabold font-mono text-emerald-600">
                {status?.total ?? 0} pcs
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2">Label Kamera</th>
                    <th className="px-3 py-2 text-center">Masuk</th>
                    <th className="px-3 py-2 text-center">Keluar</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {countEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                        Belum ada barang melewati garis hitung.
                      </td>
                    </tr>
                  ) : (
                    countEntries.map(([label, val]) => {
                      const cIn = val?.in || 0;
                      const cOut = val?.out || 0;
                      return (
                        <tr key={label} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-semibold text-slate-800">{label}</td>
                          <td className="px-3 py-2 text-center font-mono text-emerald-700">{cIn}</td>
                          <td className="px-3 py-2 text-center font-mono text-amber-700">{cOut}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                            {cIn + cOut}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={!connected}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset & Sesi Baru
              </button>
              <button
                onClick={() => saveCountsToDb(counts, true)}
                disabled={savingDb || (status?.total ?? 0) === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> {savingDb ? "Menyimpan..." : "Simpan Sekarang"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Tersimpan di Database */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            Riwayat Tersimpan di Database (`PartCounterLog`)
          </h2>
          <button
            onClick={fetchDbLogs}
            disabled={loadingLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-2">Update Terakhir</th>
                <th className="px-3 py-2">Sesi</th>
                <th className="px-3 py-2">Mesin</th>
                <th className="px-3 py-2">Part Master</th>
                <th className="px-3 py-2">Label Kamera</th>
                <th className="px-3 py-2 text-center">Masuk</th>
                <th className="px-3 py-2 text-center">Keluar</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Operator</th>
                <th className="px-3 py-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dbLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-5 text-center text-slate-400">
                    Belum ada data hitungan tersimpan di database.
                  </td>
                </tr>
              ) : (
                dbLogs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">
                      {new Date(row.updatedAt).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">{row.sessionId}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{row.machineCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.partNo ? `${row.partNo}${row.partName ? ` — ${row.partName}` : ""}` : "-"}
                    </td>
                    <td className="px-3 py-2 font-bold text-sky-700">{row.itemLabel}</td>
                    <td className="px-3 py-2 text-center font-mono text-emerald-700">{row.countIn}</td>
                    <td className="px-3 py-2 text-center font-mono text-amber-700">{row.countOut}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{row.totalQty}</td>
                    <td className="px-3 py-2 text-slate-600">{row.operatorName || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDeleteLog(row.id)}
                        title="Hapus Log"
                        className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
