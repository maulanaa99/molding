"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authenticateOperator } from "./actions";

export interface DBUser {
  id: number;
  name: string;
  employeeId: string;
  role: string;
  department: string | null;
}

export interface DBMachine {
  id: number;
  code: string;
  model: string | null;
  tonnage: number;
}

interface LoginTerminalClientProps {
  initialUsers: DBUser[];
  initialMachines: DBMachine[];
}

export default function LoginTerminalClient({
  initialUsers,
  initialMachines,
}: LoginTerminalClientProps) {
  const router = useRouter();

  // Selected operator state
  const [selectedUser, setSelectedUser] = useState<DBUser | null>(() => {
    return initialUsers.length > 0 ? initialUsers[0] : null;
  });

  // Selected station / machine
  const [selectedMachine, setSelectedMachine] = useState<DBMachine | null>(() => {
    return initialMachines.length > 0 ? initialMachines[0] : null;
  });

  // PIN state
  const [pin, setPin] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showOperatorModal, setShowOperatorModal] = useState<boolean>(false);
  const [showStationModal, setShowStationModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [manualNikInput, setManualNikInput] = useState<string>("");

  // Operational window live clock & shift
  const [operationalWindow, setOperationalWindow] = useState<{
    shift: string;
    shiftHours: string;
    dateStr: string;
  }>({
    shift: "Shift 1",
    shiftHours: "07:00 – 15:00",
    dateStr: "",
  });

  // Load saved operator and machine from localStorage on mount
  useEffect(() => {
    try {
      const savedNik = localStorage.getItem("mms_terminal_operator_nik");
      if (savedNik) {
        const found = initialUsers.find(
          (u) => u.employeeId.toUpperCase() === savedNik.toUpperCase()
        );
        if (found) setSelectedUser(found);
      }

      const savedMachineCode = localStorage.getItem("mms_terminal_station_code");
      if (savedMachineCode) {
        const found = initialMachines.find(
          (m) => m.code.toUpperCase() === savedMachineCode.toUpperCase()
        );
        if (found) setSelectedMachine(found);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [initialUsers, initialMachines]);

  // Operational window calculation (Shift 1: 07-15, Shift 2: 15-23, Shift 3: 23-07)
  useEffect(() => {
    const updateWindow = () => {
      const now = new Date();
      const hour = now.getHours();
      let shift = "Shift 1";
      let shiftHours = "07:00 – 15:00";

      if (hour >= 7 && hour < 15) {
        shift = "Shift 1";
        shiftHours = "07:00 – 15:00";
      } else if (hour >= 15 && hour < 23) {
        shift = "Shift 2";
        shiftHours = "15:00 – 23:00";
      } else {
        shift = "Shift 3";
        shiftHours = "23:00 – 07:00";
      }

      const dateStr = now.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      });

      setOperationalWindow({ shift, shiftHours, dateStr });
    };

    updateWindow();
    const interval = setInterval(updateWindow, 10000);
    return () => clearInterval(interval);
  }, []);

  // Audio feedback helper
  const playSound = (freq = 600, duration = 0.04) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio might be blocked before user interaction
    }
  };

  const pressKey = useCallback(
    (digit: string) => {
      if (pin.length < 4) {
        playSound(800, 0.05);
        setPin((prev) => prev + digit);
        setErrorMessage(null);
      }
    },
    [pin]
  );

  const clearPin = useCallback(() => {
    playSound(400, 0.06);
    setPin("");
    setErrorMessage(null);
  }, []);

  const backspacePin = useCallback(() => {
    playSound(500, 0.05);
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  }, []);

  const submitLogin = useCallback(() => {
    if (!selectedUser) {
      setErrorMessage("Silakan pilih operator terlebih dahulu.");
      playSound(250, 0.2);
      return;
    }

    if (pin.length < 4) {
      setErrorMessage("Silakan masukkan 4 digit PIN keamanan secara lengkap.");
      playSound(250, 0.2);
      return;
    }

    setErrorMessage(null);
    playSound(950, 0.08);

    startTransition(async () => {
      const res = await authenticateOperator(selectedUser.employeeId, pin);
      if (!res.success) {
        setErrorMessage(res.error || "PIN keamanan salah. Silakan coba lagi.");
        playSound(220, 0.25);
        setPin("");
      } else {
        try {
          localStorage.setItem("mms_terminal_operator_nik", selectedUser.employeeId);
        } catch {
          // Ignore
        }
        router.push("/");
        router.refresh();
      }
    });
  }, [selectedUser, pin, router]);

  // Physical keyboard support (0-9, Backspace, Escape, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input/modal
      if (showOperatorModal || showStationModal) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        pressKey(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspacePin();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearPin();
      } else if (e.key === "Enter") {
        e.preventDefault();
        submitLogin();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pressKey, backspacePin, clearPin, submitLogin, showOperatorModal, showStationModal]);

  // Handle operator change
  const handleSelectUser = (user: DBUser) => {
    setSelectedUser(user);
    setPin("");
    setErrorMessage(null);
    setShowOperatorModal(false);
    try {
      localStorage.setItem("mms_terminal_operator_nik", user.employeeId);
    } catch {
      // Ignore
    }
  };

  // Filtered operators for CHANGE modal
  const filteredUsers = initialUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === "ALL" || u.role.toUpperCase() === roleFilter.toUpperCase();

    return matchesSearch && matchesRole;
  });

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-background p-gutter-lg select-none">
      <div className="flex flex-col w-full max-w-6xl mx-auto py-4 px-2 select-none">
        {/* Terminal Fixed Overhead Context Strip */}
        <div className="flex flex-wrap items-center justify-between bg-surface-container-high rounded-t-xl px-space-lg py-3 shadow-sm gap-y-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-primary text-on-primary shadow-sm">
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                precision_manufacturing
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowStationModal(true)}
                  className="font-headline-sm text-headline-sm text-on-surface hover:text-primary transition flex items-center gap-1 cursor-pointer"
                  title="Klik untuk memilih Stasiun Mesin"
                >
                  <span>Station {selectedMachine?.code || "MMS-01"}</span>
                  <span className="material-symbols-outlined text-sm text-secondary">
                    expand_more
                  </span>
                </button>
                <span className="bg-primary-container text-on-primary font-label-md text-body-sm px-2 py-0.5 rounded font-bold">
                  LOCKED TERMINAL
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary">
                {selectedMachine
                  ? `${selectedMachine.tonnage} T Precision Injection Molding Cell • Line 3 Bay C`
                  : "180 T Hydraulic Precision Molding Cell • Line 3 Bay C"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <span className="font-label-md text-body-sm uppercase tracking-wider text-secondary block font-semibold">
                Current Operational Window
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                {operationalWindow.shift}: {operationalWindow.shiftHours} •{" "}
                {operationalWindow.dateStr}
              </span>
            </div>
            <div className="flex items-center space-x-2 bg-surface-container-lowest px-3 py-1.5 rounded-lg shadow-sm border border-surface-container-high">
              <span className="w-3 h-3 rounded-full bg-tertiary-container animate-pulse"></span>
              <span className="font-label-md text-body-sm text-tertiary font-bold">
                ONLINE / READY
              </span>
            </div>
          </div>
        </div>

        {/* Main Interaction Card Container */}
        <div className="relative bg-surface-container-lowest rounded-b-xl shadow-xl overflow-hidden flex flex-col border-x border-b border-surface-container-high">
          {/* Visual Top Status Accent Bar (Industrial Blue / Paired State) */}
          <div className="h-2 w-full bg-primary-container"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
            {/* Left Column: Operator Identity Profile & PIN Mask (5 Columns) */}
            <div className="col-span-12 lg:col-span-5 bg-surface-container-low p-space-lg flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-surface-container-high">
              <div className="space-y-6">
                <div>
                  <span className="font-label-md text-body-sm text-primary uppercase tracking-wider block font-semibold">
                    Security Gate
                  </span>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">
                    Operator Check-in
                  </h1>
                  <p className="font-body-sm text-body-sm text-secondary mt-1">
                    Present credentials to authenticate workstation control.
                  </p>
                </div>

                {/* Active Operator Identification Card */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-4 border border-surface-container">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-body-sm text-secondary uppercase font-semibold">
                      Assigned Operator
                    </span>
                    <button
                      className="text-primary font-label-md text-body-sm flex items-center space-x-1 hover:text-on-primary-fixed active:translate-y-0.5 cursor-pointer font-bold px-2 py-1 rounded hover:bg-surface-container-low transition"
                      onClick={() => {
                        setSearchQuery("");
                        setRoleFilter("ALL");
                        setShowOperatorModal(true);
                      }}
                      type="button"
                    >
                      <span>CHANGE</span>
                      <span className="material-symbols-outlined text-base">sync_alt</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-4 bg-surface-container rounded-lg p-3">
                    <div className="w-14 h-14 rounded-lg bg-surface-variant flex items-center justify-center text-primary flex-shrink-0 shadow-inner">
                      <span
                        className="material-symbols-outlined text-3xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        person
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-headline-md text-headline-md text-on-surface truncate">
                          {selectedUser ? selectedUser.name : "Belum Dipilih"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="bg-surface-container-highest text-on-secondary-fixed font-label-tabular text-body-sm px-2 py-0.5 rounded font-bold tracking-wide">
                          NIK: {selectedUser ? selectedUser.employeeId : "----"}
                        </span>
                        <span className="font-body-sm text-body-sm text-secondary truncate">
                          {selectedUser
                            ? selectedUser.role === "OPERATOR"
                              ? "Grade 3 Lead Tech"
                              : selectedUser.role
                            : "Tap CHANGE"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Qualification Badges */}
                  <div className="flex items-center space-x-2 pt-1 flex-wrap gap-y-1">
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-container text-on-surface-variant font-label-md text-body-sm">
                      <span className="material-symbols-outlined text-sm text-tertiary">
                        verified
                      </span>
                      <span>
                        {selectedUser?.department
                          ? `${selectedUser.department} Certified`
                          : "Hydraulics Certified"}
                      </span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-container text-on-surface-variant font-label-md text-body-sm">
                      <span className="material-symbols-outlined text-sm text-primary">
                        security
                      </span>
                      <span>
                        {selectedUser?.role === "ADMIN"
                          ? "Safety Lvl 5 (Admin)"
                          : selectedUser?.role === "SUPERVISOR"
                          ? "Safety Lvl 4 (Spv)"
                          : "Safety Lvl 4"}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div
                    className="bg-error-container text-error p-3.5 rounded-xl border border-error/20 flex items-start space-x-2.5 text-body-sm shadow-sm"
                    role="alert"
                  >
                    <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">
                      error
                    </span>
                    <span className="font-medium leading-snug">{errorMessage}</span>
                  </div>
                )}

                {/* PIN Display Panel */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-3 border border-surface-container">
                  <div className="flex justify-between items-center">
                    <label className="font-label-lg text-label-lg text-on-surface block font-bold">
                      Authentication PIN
                    </label>
                    <span
                      className={`font-label-md text-body-sm ${
                        pin.length === 4
                          ? "text-tertiary font-bold"
                          : "text-secondary"
                      }`}
                      id="pin-status-text"
                    >
                      {pin.length === 4
                        ? "PIN Complete - Tap Login"
                        : `${4 - pin.length} More Digit${
                            4 - pin.length > 1 ? "s" : ""
                          } Needed`}
                    </span>
                  </div>

                  {/* Pin Dots Visualizer */}
                  <div className="flex items-center justify-center space-x-6 py-4 bg-surface-container-low rounded-lg border border-surface-container-high/50">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full shadow-inner transition-all duration-150 ${
                          i <= pin.length
                            ? "bg-primary-container scale-110"
                            : "bg-surface-container-highest"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-secondary pt-1">
                    <span className="font-body-sm text-body-sm flex items-center space-x-1">
                      <span className="material-symbols-outlined text-base">lock</span>
                      <span>Hardware Encrypted</span>
                    </span>
                    <button
                      className="font-label-md text-body-sm text-error hover:underline active:translate-y-0.5 cursor-pointer font-bold"
                      onClick={clearPin}
                      type="button"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Security Audit Footer Note */}
              <div className="bg-surface-container p-3 rounded-lg flex items-start space-x-3 mt-6">
                <span className="material-symbols-outlined text-secondary flex-shrink-0 mt-0.5 text-lg">
                  info
                </span>
                <p className="font-body-sm text-body-sm text-secondary leading-snug">
                  Authorized Molding Machine Operator check-in. All actions, sensor
                  overrides, and shift timestamps are audited under your NIK.
                </p>
              </div>
            </div>

            {/* Right Column: Industrial 3x4 Touch Keypad & Actions (7 Columns) */}
            <div className="col-span-12 lg:col-span-7 p-space-lg flex flex-col justify-between bg-surface-container-lowest">
              {/* Keypad Header / State Indicator */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-surface-container-high">
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-primary">dialpad</span>
                  <span className="font-label-lg text-label-lg text-on-surface uppercase tracking-wide font-bold">
                    Touch Terminal Keypad
                  </span>
                </div>
                <span className="font-label-md text-body-sm text-secondary font-semibold">
                  GLOVE-SAFE CAPACITIVE INPUT
                </span>
              </div>

              {/* 3x4 Touch Numeric Keypad Grid */}
              <div className="grid grid-cols-3 gap-3 flex-1 mb-4">
                {/* Row 1 */}
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("1")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    1
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("2")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    2
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("3")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    3
                  </span>
                </button>

                {/* Row 2 */}
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("4")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    4
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("5")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    5
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("6")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    6
                  </span>
                </button>

                {/* Row 3 */}
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("7")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    7
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("8")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    8
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("9")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    9
                  </span>
                </button>

                {/* Row 4: Clear, Zero, Backspace */}
                <button
                  className="h-20 bg-surface-container-high text-error hover:bg-error-container active:translate-y-0.5 rounded-lg flex flex-col items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={clearPin}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-headline-lg text-headline-lg font-bold">CLR</span>
                  <span className="font-label-md text-body-sm uppercase tracking-tight">
                    Clear
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={() => pressKey("0")}
                  disabled={isPending}
                  type="button"
                >
                  <span className="font-display-metrics text-display-metrics text-on-surface">
                    0
                  </span>
                </button>
                <button
                  className="h-20 bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:translate-y-0.5 rounded-lg flex flex-col items-center justify-center shadow-sm select-none transition-all duration-75 cursor-pointer disabled:opacity-50"
                  onClick={backspacePin}
                  disabled={isPending}
                  type="button"
                >
                  <span className="material-symbols-outlined text-3xl">backspace</span>
                  <span className="font-label-md text-body-sm uppercase tracking-tight">
                    Delete
                  </span>
                </button>
              </div>

              {/* Primary Giant Action Button: Start Shift */}
              <div className="pt-2">
                <button
                  className="w-full h-20 bg-tertiary-container hover:bg-tertiary text-on-tertiary rounded-xl shadow-lg active:translate-y-1 flex items-center justify-center space-x-3 transition-all duration-100 cursor-pointer disabled:opacity-50"
                  id="login-button"
                  onClick={submitLogin}
                  disabled={isPending}
                  type="button"
                >
                  {isPending ? (
                    <>
                      <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="font-headline-lg text-headline-lg uppercase tracking-wider font-bold">
                        VERIFYING PIN...
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="material-symbols-outlined text-3xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        play_circle
                      </span>
                      <span className="font-headline-lg text-headline-lg uppercase tracking-wider font-bold">
                        LOGIN / START SHIFT
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Resilience and Network Status Strip */}
          <div className="bg-surface-container-highest px-space-lg py-2.5 flex items-center justify-between border-t border-surface-container-high">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-secondary text-base">
                cloud_sync
              </span>
              <span className="font-label-md text-body-sm text-on-surface-variant font-medium">
                Device Local Storage Ready • LAN Network Connected
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="font-label-md text-body-sm text-secondary">
                PLC Cycle: 14.8s
              </span>
              <span className="font-label-md text-body-sm text-secondary">•</span>
              <span className="font-label-md text-body-sm text-secondary">
                Surface Terminal #{selectedMachine?.code || "01"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CHANGE OPERATOR PROFILE */}
      {showOperatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl border border-surface-container-high overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-surface-container-high px-space-lg py-4 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-2xl">
                  manage_accounts
                </span>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Pilih Operator / Roster
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Pilih profil karyawan yang bertugas untuk verifikasi check-in terminal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOperatorModal(false)}
                className="w-9 h-9 rounded-lg bg-surface-container hover:bg-surface-container-highest flex items-center justify-center text-secondary hover:text-on-surface transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Search & Filters */}
            <div className="p-space-md border-b border-surface-container space-y-3 bg-surface-container-low">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-lg">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama karyawan atau NIK..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-10 pr-4 py-2.5 text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>

              {/* Role filter buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-label-md text-body-sm text-secondary mr-1">
                  Filter:
                </span>
                {["ALL", "OPERATOR", "SUPERVISOR", "PLANNER", "ADMIN"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg text-body-sm font-semibold transition cursor-pointer ${
                      roleFilter === r
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {r === "ALL" ? "Semua" : r}
                  </button>
                ))}
              </div>
            </div>

            {/* Operators List */}
            <div className="p-space-md overflow-y-auto flex-1 space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-secondary">
                    person_off
                  </span>
                  <p className="font-body-md text-body-md text-secondary">
                    Tidak ditemukan karyawan yang cocok dengan pencarian.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredUsers.map((u) => {
                    const isSelected = selectedUser?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className={`text-left p-3 rounded-xl border transition flex items-center space-x-3 cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary ring-2 ring-primary"
                            : "bg-surface-container-lowest border-surface-container hover:border-primary/50 hover:bg-surface-container-low"
                        }`}
                      >
                        <div className="w-11 h-11 rounded-lg bg-surface-variant flex items-center justify-center text-primary shrink-0 font-bold">
                          {u.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-headline-sm text-body-md text-on-surface font-semibold truncate">
                            {u.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="bg-surface-container-highest text-on-secondary-fixed text-[11px] font-mono font-bold px-1.5 py-0.5 rounded">
                              NIK: {u.employeeId}
                            </span>
                            <span className="text-[11px] text-secondary font-medium">
                              {u.role}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-primary text-xl shrink-0">
                            check_circle
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Manual NIK fallback */}
            <div className="p-space-md bg-surface-container-low border-t border-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">
                badge
              </span>
              <input
                type="text"
                placeholder="Atau masukkan NIK manual..."
                value={manualNikInput}
                onChange={(e) => setManualNikInput(e.target.value.toUpperCase())}
                className="flex-1 bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-1.5 text-body-sm font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => {
                  const clean = manualNikInput.trim().toUpperCase();
                  if (!clean) return;
                  const found = initialUsers.find(
                    (u) => u.employeeId.toUpperCase() === clean
                  );
                  if (found) {
                    handleSelectUser(found);
                  } else {
                    // Manual synthetic user
                    handleSelectUser({
                      id: 9999,
                      name: `Operator (${clean})`,
                      employeeId: clean,
                      role: "OPERATOR",
                      department: "MOLDING",
                    });
                  }
                }}
                className="px-4 py-1.5 bg-primary text-on-primary rounded-lg text-body-sm font-bold hover:bg-primary-container transition cursor-pointer"
              >
                Pilih
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHOOSE STATION / MACHINE */}
      {showStationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-xl border border-surface-container-high overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-surface-container-high px-space-lg py-4 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-2xl">
                  precision_manufacturing
                </span>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Pilih Stasiun Mesin
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Tentukan stasiun mesin molding untuk terminal kerja ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStationModal(false)}
                className="w-9 h-9 rounded-lg bg-surface-container hover:bg-surface-container-highest flex items-center justify-center text-secondary hover:text-on-surface transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-space-md overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {initialMachines.map((m) => {
                const isSelected = selectedMachine?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMachine(m);
                      setShowStationModal(false);
                      try {
                        localStorage.setItem("mms_terminal_station_code", m.code);
                      } catch {
                        // Ignore
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-primary/10 border-primary ring-2 ring-primary"
                        : "bg-surface-container-lowest border-surface-container hover:border-primary/50 hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-headline-sm font-bold text-on-surface">
                        {m.code}
                      </span>
                      {isSelected && (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-[11px] text-secondary mt-1">
                      {m.tonnage} T • {m.model || "Molding"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

