"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock } from "lucide-react";

interface LiveClockDisplayProps {
  serverTimeOffset?: number;
}

/**
 * Isolated Live Clock & Date badge.
 * Managing the 1-second interval here prevents the entire MMSMainApp root tree
 * from re-rendering every 1000ms.
 */
export default function LiveClockDisplay({ serverTimeOffset = 0 }: LiveClockDisplayProps) {
  const [liveDateStr, setLiveDateStr] = useState<string>("");
  const [liveClockStr, setLiveClockStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date(Date.now() + serverTimeOffset);
      setLiveDateStr(
        now.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
      setLiveClockStr(
        now.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [serverTimeOffset]);

  return (
    <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-xl">
      <div className="text-left">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-sky-400" /> Tanggal Hari Ini
        </p>
        <p className="text-xs sm:text-sm font-extrabold text-white mt-0.5">
          {liveDateStr || "Memuat tanggal..."}
        </p>
      </div>
      <div className="h-8 w-px bg-slate-700 mx-1" />
      <div className="text-right">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-end gap-1">
          <Clock className="w-3 h-3 text-emerald-400" /> Jam
        </p>
        <p className="text-lg sm:text-xl font-black font-mono tabular-numbers text-emerald-400">
          {liveClockStr || "00:00:00"}
        </p>
      </div>
    </div>
  );
}
