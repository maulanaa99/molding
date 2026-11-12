"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "./auth";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Type definitions
export interface StartRunInput {
  machineId: number;
  partId: number;
  operatorId: number;
  shift?: string;
  planId?: number;
  moldMode?: string; // "SET", "SINGLE_LH", "SINGLE_RH", "STANDARD"
}

export interface StopRunInput {
  runId: number;
  stopReasonId: number;
  remainderQty: number;
  qtyReject: number;
  notes?: string;
  operatorId: number;
}

export interface ScanKanbanInput {
  runId: number;
  code: string;
  operatorId: number;
  customQty?: number;
}

function formatMinutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

async function getPartAttributesMap(): Promise<Map<number, { containerType: string; customer: string | null }>> {
  try {
    const rows = await prisma.part.findMany({
      select: { id: true, containerType: true, customer: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        {
          containerType: (r.containerType || "TROLLY").toUpperCase(),
          customer: r.customer ? r.customer.trim().toUpperCase() : null,
        },
      ])
    );
  } catch {
    return new Map();
  }
}

// Keep backwards-compatible alias
async function getContainerTypeMap(): Promise<Map<number, string>> {
  const attrMap = await getPartAttributesMap();
  const map = new Map<number, string>();
  attrMap.forEach((val, id) => map.set(id, val.containerType));
  return map;
}

// 1. Get Machines with live status, server time sync, and daily timeline progress
export async function getMachinesWithStatus() {
  try {
    const serverNow = new Date();
    const serverNowMs = serverNow.getTime();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [machines, todayRuns] = await Promise.all([
      prisma.machine.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        include: {
          parts: {
            include: {
              part: {
                include: { pairPart: true },
              },
            },
          },
          runs: {
            take: 1,
            orderBy: { startTime: "desc" },
            include: {
              part: {
                include: { pairPart: true },
              },
              operator: true,
              stopReason: true,
              scans: {
                where: { isVoid: false },
                include: {
                  kanban: {
                    include: { part: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.productionRun.findMany({
        where: {
          startTime: { gte: todayStart },
        },
        orderBy: { startTime: "asc" },
        include: {
          part: {
            include: { pairPart: true },
          },
          operator: true,
          stopReason: true,
          scans: {
            where: { isVoid: false },
            include: {
              kanban: {
                include: { part: true },
              },
            },
          },
        },
      }),
    ]);

    // Ensure containerType, customer, and machine-specific cycleTimeSec are populated on machines and runs
    const partAttrMap = await getPartAttributesMap();
    machines.forEach((m) => {
      const machineCtMap = new Map<number, number>();
      m.parts?.forEach((mp) => {
        if (mp.cycleTimeSec && mp.cycleTimeSec > 0) {
          machineCtMap.set(mp.partId, mp.cycleTimeSec);
        }
        if (mp.part) {
          const attr = partAttrMap.get(mp.part.id);
          (mp.part as any).containerType = attr?.containerType || (mp.part as any).containerType || "TROLLY";
          (mp.part as any).customer = attr?.customer ?? (mp.part as any).customer ?? null;
          if (mp.cycleTimeSec && mp.cycleTimeSec > 0) {
            mp.part.cycleTimeSec = mp.cycleTimeSec;
          }
          if (mp.part.pairPart) {
            const pairAttr = partAttrMap.get(mp.part.pairPart.id);
            (mp.part.pairPart as any).containerType = pairAttr?.containerType || (mp.part.pairPart as any).containerType || "TROLLY";
            (mp.part.pairPart as any).customer = pairAttr?.customer ?? (mp.part.pairPart as any).customer ?? null;
            const pairOverrideCt = machineCtMap.get(mp.part.pairPart.id);
            if (pairOverrideCt) {
              mp.part.pairPart.cycleTimeSec = pairOverrideCt;
            }
          }
        }
      });
      m.runs?.forEach((r) => {
        if (r.part) {
          const attr = partAttrMap.get(r.part.id);
          (r.part as any).containerType = attr?.containerType || (r.part as any).containerType || "TROLLY";
          (r.part as any).customer = attr?.customer ?? (r.part as any).customer ?? null;
          const overrideCt = machineCtMap.get(r.part.id);
          if (overrideCt) {
            r.part.cycleTimeSec = overrideCt;
          }
          if (r.part.pairPart) {
            const pairAttr = partAttrMap.get(r.part.pairPart.id);
            (r.part.pairPart as any).containerType = pairAttr?.containerType || (r.part.pairPart as any).containerType || "TROLLY";
            (r.part.pairPart as any).customer = pairAttr?.customer ?? (r.part.pairPart as any).customer ?? null;
            const pairOverrideCt = machineCtMap.get(r.part.pairPart.id);
            if (pairOverrideCt) {
              r.part.pairPart.cycleTimeSec = pairOverrideCt;
            }
          }
        }
      });
    });
    todayRuns.forEach((r) => {
      if (r.part) {
        const attr = partAttrMap.get(r.part.id);
        (r.part as any).containerType = attr?.containerType || (r.part as any).containerType || "TROLLY";
        (r.part as any).customer = attr?.customer ?? (r.part as any).customer ?? null;
        if (r.part.pairPart) {
          const pairAttr = partAttrMap.get(r.part.pairPart.id);
          (r.part.pairPart as any).containerType = pairAttr?.containerType || (r.part.pairPart as any).containerType || "TROLLY";
          (r.part.pairPart as any).customer = pairAttr?.customer ?? (r.part.pairPart as any).customer ?? null;
        }
      }
    });

    // Query run rejects separately to guarantee compatibility without schema cache issues
    const activeRunIds = machines
      .map((m) => m.runs[0]?.id)
      .filter((id): id is number => typeof id === "number");

    type RunRejectItem = {
      id: number;
      runId: number;
      defectTypeId: number;
      partId: number | null;
      qty: number;
      defectType: {
        id: number;
        code: string;
        name: string;
        category: string | null;
      };
    };

    const allRejects: RunRejectItem[] =
      activeRunIds.length > 0
        ? await prisma.runReject.findMany({
            where: { runId: { in: activeRunIds } },
            include: { defectType: true },
          })
        : [];

    const rejectsByRunId: Record<number, RunRejectItem[]> = {};
    for (const r of allRejects) {
      if (!rejectsByRunId[r.runId]) {
        rejectsByRunId[r.runId] = [];
      }
      rejectsByRunId[r.runId].push(r);
    }

    // Query today's plans (pending, in-progress, or completed today)
    const allPlans = await prisma.productionPlan.findMany({
      where: {
        OR: [
          { status: { in: ["PENDING", "IN_PROGRESS"] } },
          { status: "COMPLETED", updatedAt: { gte: todayStart } },
        ],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      include: {
        part: true,
        operator: true,
      },
    });

    const plansByMachine: Record<number, typeof allPlans> = {};
    for (const p of allPlans) {
      if (!plansByMachine[p.machineId]) plansByMachine[p.machineId] = [];
      plansByMachine[p.machineId].push(p);
    }

    const resultData = machines.map((m) => {
      const latestRun = m.runs[0] || null;
      const isRunning = latestRun && latestRun.status === "RUNNING";

      let currentQty = 0;
      let trollyCount = 0;
      let pairStats: {
        isPair: boolean;
        lhPart: any;
        rhPart: any;
        lhTrollyCount: number;
        lhQty: number;
        rhTrollyCount: number;
        rhQty: number;
        setsCount: number;
      } | null = null;

      if (latestRun) {
        trollyCount = latestRun.scans.length;
        const scanTotal = latestRun.scans.reduce((acc, s) => acc + s.qty, 0);
        currentQty = scanTotal + latestRun.remainderQty;

        if (latestRun.part.pairPartId && latestRun.part.pairPart) {
          const isMainRH =
            latestRun.part.partNo.toUpperCase().includes("RH") ||
            latestRun.part.name.toUpperCase().includes("RH") ||
            latestRun.part.name.toUpperCase().includes("KANAN");

          const lhPart = isMainRH ? latestRun.part.pairPart : latestRun.part;
          const rhPart = isMainRH ? latestRun.part : latestRun.part.pairPart;

          const lhScans = latestRun.scans.filter((s) => s.kanban.partId === lhPart.id);
          const rhScans = latestRun.scans.filter((s) => s.kanban.partId === rhPart.id);
          const lhQty = lhScans.reduce((acc, s) => acc + s.qty, 0);
          const rhQty = rhScans.reduce((acc, s) => acc + s.qty, 0);
          pairStats = {
            isPair: true,
            lhPart,
            rhPart,
            lhTrollyCount: lhScans.length,
            lhQty,
            rhTrollyCount: rhScans.length,
            rhQty,
            setsCount: Math.min(lhQty, rhQty),
          };
        }
      }

      // Filter today's runs for this machine
      const mRunsToday = todayRuns.filter((r) => r.machineId === m.id);

      let totalRunMinutes = 0;
      let totalDowntimeMinutes = 0;
      let stopsCount = 0;

      const timelineEvents: Array<{
        type: "RUN" | "STOP";
        runId?: number;
        startTime: string;
        endTime: string | null;
        durationMinutes: number;
        partNo?: string;
        partName?: string;
        qtyOk?: number;
        qtyReject?: number;
        operatorName?: string;
        shift?: string;
        stopReason?: string;
        stopCategory?: string;
      }> = [];

      const partsMap: Record<
        string,
        { partNo: string; name: string; qtyOk: number; qtyReject: number }
      > = {};
      const operatorsSet = new Set<string>();
      const stopReasonsMap: Record<
        string,
        { reason: string; category: string; count: number; minutes: number }
      > = {};

      for (let i = 0; i < mRunsToday.length; i++) {
        const run = mRunsToday[i];
        const runStartMs = new Date(run.startTime).getTime();
        const runEndMs = run.stopTime ? new Date(run.stopTime).getTime() : serverNowMs;
        const runDurationMin = Math.max(0, Math.round((runEndMs - runStartMs) / 60000));

        totalRunMinutes += runDurationMin;

        const scanTotal = run.scans.reduce((acc, s) => acc + s.qty, 0);
        const qtyOk = scanTotal + run.remainderQty;

        // Collect part stats
        if (!partsMap[run.part.partNo]) {
          partsMap[run.part.partNo] = {
            partNo: run.part.partNo,
            name: run.part.name,
            qtyOk: 0,
            qtyReject: 0,
          };
        }
        partsMap[run.part.partNo].qtyOk += qtyOk;
        partsMap[run.part.partNo].qtyReject += run.qtyReject;

        operatorsSet.add(run.operator.name);

        timelineEvents.push({
          type: "RUN",
          runId: run.id,
          startTime: run.startTime.toISOString(),
          endTime: run.stopTime ? run.stopTime.toISOString() : null,
          durationMinutes: runDurationMin,
          partNo: run.part.partNo,
          partName: run.part.name,
          qtyOk,
          qtyReject: run.qtyReject,
          operatorName: run.operator.name,
          shift: run.shift || "Shift 1",
        });

        // Check for downtime between this run and the next run
        if (run.stopTime) {
          stopsCount++;
          const nextRun = mRunsToday[i + 1];
          const nextStartMs = nextRun
            ? new Date(nextRun.startTime).getTime()
            : (i === mRunsToday.length - 1 ? serverNowMs : new Date(run.stopTime).getTime());
          const stopDurationMin = Math.max(
            0,
            Math.round((nextStartMs - new Date(run.stopTime).getTime()) / 60000)
          );

          totalDowntimeMinutes += stopDurationMin;

          const reasonText = run.stopReason ? run.stopReason.reason : "Mesin Berhenti";
          const catText = run.stopReason ? run.stopReason.category : "Umum";

          if (!stopReasonsMap[reasonText]) {
            stopReasonsMap[reasonText] = {
              reason: reasonText,
              category: catText,
              count: 0,
              minutes: 0,
            };
          }
          stopReasonsMap[reasonText].count += 1;
          stopReasonsMap[reasonText].minutes += stopDurationMin;

          timelineEvents.push({
            type: "STOP",
            startTime: run.stopTime.toISOString(),
            endTime: nextRun ? nextRun.startTime.toISOString() : null,
            durationMinutes: stopDurationMin,
            stopReason: reasonText,
            stopCategory: catText,
          });
        }
      }

      // Compose Narrative Summary
      let narrativeSummary = "";
      if (mRunsToday.length === 0) {
        narrativeSummary = `Mesin ${m.code} belum ada catatan produksi hari ini (status siap/idle).`;
      } else {
        const partsListText = Object.values(partsMap)
          .map((p) => `part ${p.partNo} (${p.name}) sebanyak ${p.qtyOk} pcs OK (reject: ${p.qtyReject} pcs)`)
          .join(", ");

        const operatorsText = Array.from(operatorsSet).join(", ");

        const reasonsList = Object.values(stopReasonsMap);
        const reasonsText =
          reasonsList.length > 0
            ? reasonsList.map((r) => `${r.count}x karena ${r.reason} (${formatMinutesText(r.minutes)})`).join(", ")
            : "tanpa downtime";

        narrativeSummary = `Hari ini ${m.code} telah berjalan selama ${formatMinutesText(
          totalRunMinutes
        )} dan berhenti selama ${formatMinutesText(
          totalDowntimeMinutes
        )}. Memproduksi ${partsListText || "0 part"}. Ditangani oleh operator ${
          operatorsText || "-"
        }, dengan ${stopsCount} kali stop (${reasonsText}).`;
      }

      // Hitung akumulasi durasi sebelumnya jika run aktif saat ini adalah kelanjutan part yang sama
      let previousAccumulatedSec = 0;
      if (isRunning && latestRun) {
        // Cari run-run sebelumnya pada hari ini dengan part yang sama sebelum run aktif ini
        const prevSamePartRuns = mRunsToday.filter(
          (r) => r.id !== latestRun.id && r.partId === latestRun.part.id && r.stopTime
        );
        for (const pr of prevSamePartRuns) {
          const prStart = new Date(pr.startTime).getTime();
          const prEnd = new Date(pr.stopTime!).getTime();
          previousAccumulatedSec += Math.max(0, Math.floor((prEnd - prStart) / 1000));
        }
      }

      const mPlans = plansByMachine[m.id] || [];
      const activePlan =
        latestRun && latestRun.planId
          ? mPlans.find((p) => p.id === latestRun.planId && p.status !== "COMPLETED") || null
          : isRunning && latestRun
          ? mPlans.find((p) => p.partId === latestRun.part.id && p.status !== "COMPLETED") || null
          : mPlans.find((p) => p.status === "IN_PROGRESS") || null;

      const nextPlans = mPlans.filter((p) => p.id !== activePlan?.id && p.status === "PENDING");

      // Cek apakah stop karena Selesai Produksi (Target Tercapai atau Ganti Job)
      const isCompletedProduction = Boolean(
        latestRun &&
        latestRun.stopReason &&
        (latestRun.stopReason.category === "Selesai Produksi" ||
          latestRun.stopReason.category === "Selesai" ||
          latestRun.stopReason.reason.toLowerCase().includes("selesai produksi") ||
          latestRun.stopReason.reason.toLowerCase().includes("selesai"))
      );

      // Cek apakah run ini berhenti pada hari ini (sejak 00:00:00 WIB hari ini)
      const isStoppedToday = Boolean(
        latestRun &&
        latestRun.stopTime &&
        new Date(latestRun.stopTime).getTime() >= todayStart.getTime()
      );

      // Tentukan status mesin:
      // 1. RUNNING jika run masih aktif berjalan
      // 2. DOWN HANYA jika mesin berhenti HARI INI dan alasannya BUKAN selesai produksi
      // 3. IDLE jika:
      //    - Hari sudah berganti / hari baru (run dari hari kemarin/sebelumnya) -> otomatis reset ke IDLE
      //    - Alasan stop adalah "Selesai Produksi" -> otomatis status menjadi IDLE
      //    - Belum pernah ada run
      let computedStatus: "RUNNING" | "DOWN" | "IDLE" = "IDLE";
      if (isRunning) {
        computedStatus = "RUNNING";
      } else if (isStoppedToday && !isCompletedProduction) {
        computedStatus = "DOWN";
      } else {
        computedStatus = "IDLE";
      }

      return {
        id: m.id,
        code: m.code,
        model: m.model,
        tonnage: m.tonnage,
        status: computedStatus,
        activePlan: activePlan
          ? {
              id: activePlan.id,
              machineId: activePlan.machineId,
              partId: activePlan.partId,
              operatorId: activePlan.operatorId,
              operatorName: activePlan.operator?.name || null,
              operatorEmployeeId: activePlan.operator?.employeeId || null,
              targetQty: activePlan.targetQty,
              priority: activePlan.priority,
              status: activePlan.status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
              notes: activePlan.notes,
              scheduledDate: activePlan.scheduledDate
                ? activePlan.scheduledDate.toISOString()
                : null,
              moldMode: (activePlan.part as any).pairPartId ? (activePlan.moldMode || "SET") : null,
              part: activePlan.part,
            }
          : null,
        nextPlans: nextPlans.map((np) => ({
          id: np.id,
          machineId: np.machineId,
          partId: np.partId,
          operatorId: np.operatorId,
          operatorName: np.operator?.name || null,
          operatorEmployeeId: np.operator?.employeeId || null,
          targetQty: np.targetQty,
          priority: np.priority,
          status: np.status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
          notes: np.notes,
          moldMode: (np.part as any).pairPartId ? (np.moldMode || "SET") : null,
          scheduledDate: np.scheduledDate ? np.scheduledDate.toISOString() : null,
          part: np.part,
        })),
        todayPlans: mPlans.map((tp) => ({
          id: tp.id,
          machineId: tp.machineId,
          partId: tp.partId,
          operatorId: tp.operatorId,
          operatorName: tp.operator?.name || null,
          operatorEmployeeId: tp.operator?.employeeId || null,
          targetQty: tp.targetQty,
          priority: tp.priority,
          status: tp.status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
          notes: tp.notes,
          moldMode: (tp.part as any).pairPartId ? (tp.moldMode || "SET") : null,
          scheduledDate: tp.scheduledDate ? tp.scheduledDate.toISOString() : null,
          part: tp.part,
        })),
        latestRun: latestRun
          ? {
              id: latestRun.id,
              planId: latestRun.planId,
              planTargetQty:
                (latestRun.planId ? mPlans.find((p) => p.id === latestRun.planId)?.targetQty : null) ||
                activePlan?.targetQty ||
                null,
              status: latestRun.status,
              startTime: latestRun.startTime.toISOString(),
              stopTime: latestRun.stopTime ? latestRun.stopTime.toISOString() : null,
              part: latestRun.part,
              operator: latestRun.operator,
              stopReason: latestRun.stopReason,
              trollyCount,
              currentQty,
              qtyReject: latestRun.qtyReject,
              remainderQty: latestRun.remainderQty,
              previousAccumulatedSec,
              shift: latestRun.shift || null,
              moldMode: latestRun.part.pairPartId ? (latestRun.moldMode || "SET") : null,
              pairStats,
              rejects: latestRun
                ? (rejectsByRunId[latestRun.id] || []).map((rj) => ({
                    id: rj.id,
                    defectTypeId: rj.defectTypeId,
                    partId: rj.partId,
                    qty: rj.qty,
                    defectType: {
                      id: rj.defectType.id,
                      code: rj.defectType.code,
                      name: rj.defectType.name,
                      category: rj.defectType.category,
                    },
                  }))
                : [],
            }
          : null,
        allowedParts: m.parts.map((mp) => mp.part),
        dailySummary: {
          totalRunMinutes,
          totalDowntimeMinutes,
          stopsCount,
          partsProduced: Object.values(partsMap),
          operators: Array.from(operatorsSet),
          stopReasons: Object.values(stopReasonsMap),
          timelineEvents,
          narrativeSummary,
        },
      };
    });

    return {
      success: true,
      serverTime: serverNow.toISOString(),
      data: resultData,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat status mesin";
    return { success: false, error: message };
  }
}

// 2. Get Machine Detail
export async function getMachineDetail(machineId: number) {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        parts: {
          include: { part: true },
        },
        runs: {
          take: 10,
          orderBy: { startTime: "desc" },
          include: {
            part: true,
            operator: true,
            stopReason: true,
            scans: {
              orderBy: { scannedAt: "desc" },
              include: {
                kanban: true,
                scannedBy: true,
              },
            },
          },
        },
      },
    });

    if (!machine) {
      return { success: false, error: "Mesin tidak ditemukan" };
    }

    const currentRun = machine.runs.find((r) => r.status === "RUNNING") || null;
    const pastRuns = machine.runs.filter((r) => r.status === "STOPPED");

    return {
      success: true,
      data: {
        machine,
        currentRun,
        pastRuns,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat detail mesin";
    return { success: false, error: message };
  }
}

// 3. Start Run
export async function startRun(input: StartRunInput) {
  try {
    // Check if machine already has an active running run
    const existingActive = await prisma.productionRun.findFirst({
      where: {
        machineId: input.machineId,
        status: "RUNNING",
      },
    });

    if (existingActive) {
      return {
        success: false,
        error: "Mesin ini sudah memiliki run aktif. Selesaikan run sebelumnya terlebih dahulu.",
      };
    }

    // Verify part is allowed on machine
    const machinePart = await prisma.machinePart.findUnique({
      where: {
        machineId_partId: {
          machineId: input.machineId,
          partId: input.partId,
        },
      },
      include: { part: true },
    });

    if (!machinePart) {
      return {
        success: false,
        error: "Part yang dipilih tidak terdaftar untuk mesin ini.",
      };
    }

    // Validasi Poka-Yoke: Part yang diproses sebelumnya pada mesin ini wajib sudah memiliki input scan kuantiti trolly
    // sebelum operator dapat beralih ke next proses / part berikutnya.
    const previousRun = await prisma.productionRun.findFirst({
      where: { machineId: input.machineId },
      orderBy: { startTime: "desc" },
      include: {
        part: { include: { pairPart: true } },
        scans: { where: { isVoid: false } },
      },
    });

    if (previousRun) {
      const isSamePart = previousRun.partId === input.partId;
      const isFamilyPairInSet = Boolean(
        previousRun.part.pairPartId &&
        previousRun.part.pairPartId === input.partId &&
        (input.moldMode === "SET" || previousRun.moldMode === "SET")
      );

      // Next proses: beralih ke part berbeda, atau beralih ke plan PPIC berikutnya yang berbeda
      const isNextProcess =
        (!isSamePart && !isFamilyPairInSet) ||
        Boolean(input.planId && previousRun.planId && input.planId !== previousRun.planId);

      if (isNextProcess) {
        let prevPartScannedQty =
          previousRun.scans.reduce((acc, s) => acc + s.qty, 0) +
          (previousRun.remainderQty || 0);

        // Jika pada run terakhir bernilai 0, cek apakah ada akumulasi scan pada run-run sebelumnya untuk part/plan yang sama
        if (prevPartScannedQty === 0) {
          const totalScansInHistory = await prisma.scanLog.count({
            where: {
              run: {
                machineId: input.machineId,
                partId: previousRun.partId,
                ...(previousRun.planId ? { planId: previousRun.planId } : {}),
              },
              isVoid: false,
            },
          });
          prevPartScannedQty = totalScansInHistory;
        }

        if (prevPartScannedQty === 0) {
          return {
            success: false,
            error: `Tidak dapat beralih ke next proses: Part yang diproses sebelumnya (${previousRun.part.partNo} - ${previousRun.part.name}) belum memiliki input scan kuantiti trolly. Harap selesaikan input scan atau kuantiti part sebelumnya terlebih dahulu.`,
          };
        }
      }
    }

    // Connect to planner job / ProductionPlan
    let planIdToUse = input.planId;
    let matchedPlan: any = null;
    if (!planIdToUse) {
      const matchPlan = await prisma.productionPlan.findFirst({
        where: {
          machineId: input.machineId,
          partId: input.partId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { priority: "asc" },
      });
      if (matchPlan) planIdToUse = matchPlan.id;
    }

    if (planIdToUse) {
      matchedPlan = await prisma.productionPlan.findUnique({
        where: { id: planIdToUse },
        include: { operator: true },
      });

      if (matchedPlan && matchedPlan.operatorId) {
        const callingUser = await prisma.user.findUnique({
          where: { id: input.operatorId },
        });

        if (
          callingUser &&
          callingUser.role === "OPERATOR" &&
          matchedPlan.operatorId !== input.operatorId
        ) {
          return {
            success: false,
            error: `Akses Ditolak: Rencana job ini ditugaskan khusus untuk operator ${
              matchedPlan.operator?.name || "lain"
            }. Hanya operator yang ditugaskan atau Supervisor/Admin yang dapat memulai job ini.`,
          };
        }
      }

      await prisma.productionPlan.update({
        where: { id: planIdToUse },
        data: { status: "IN_PROGRESS" },
      });
    }

    const newRun = await prisma.productionRun.create({
      data: {
        machineId: input.machineId,
        partId: input.partId,
        planId: planIdToUse,
        operatorId: input.operatorId,
        shift: input.shift || "Shift 1",
        status: "RUNNING",
        startTime: new Date(),
        moldMode: machinePart.part.pairPartId ? (input.moldMode || (matchedPlan?.moldMode ?? "SET")) : null,
      },
      include: {
        machine: true,
        part: {
          include: { pairPart: true },
        },
        operator: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: newRun.id,
        action: "START_RUN",
        newValue: JSON.stringify({
          machine: newRun.machine.code,
          part: newRun.part.partNo,
          operatorId: input.operatorId,
          startTime: newRun.startTime,
        }),
        userId: input.operatorId,
      },
    });

    revalidatePath("/");
    return { success: true, data: newRun };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memulai run";
    return { success: false, error: message };
  }
}

// 4. Scan Kanban (Add Production Trolly)
export async function scanKanban(input: ScanKanbanInput) {
  try {
    const rawCode = input.code.trim();
    if (!rawCode) {
      return { success: false, error: "Kode kanban tidak boleh kosong." };
    }

    // Support Lot QR Code payload: KB-7415A703#LOT-20261014-1015-T01 -> extract KB-7415A703
    const cleanCode = rawCode.split(/[#/|]/)[0].trim();

    const run = await prisma.productionRun.findUnique({
      where: { id: input.runId },
      include: {
        part: {
          include: { pairPart: true },
        },
        machine: true,
        plan: true,
      },
    });

    if (!run || run.status !== "RUNNING") {
      return { success: false, error: "Run produksi tidak aktif atau telah dihentikan." };
    }

    // Find Kanban (exact code, normalized with/without KB- prefix, or by Part Number)
    let kanban = await prisma.kanban.findUnique({
      where: { code: cleanCode },
      include: { part: true },
    });

    if (!kanban) {
      const altCode = cleanCode.startsWith("KB-")
        ? cleanCode.replace(/^KB-/, "")
        : `KB-${cleanCode.replace(/\s+/g, "-")}`;

      kanban = await prisma.kanban.findUnique({
        where: { code: altCode },
        include: { part: true },
      });
    }

    if (!kanban) {
      kanban = await prisma.kanban.findFirst({
        where: {
          part: {
            partNo: {
              equals: cleanCode,
            },
          },
        },
        include: { part: true },
      });
    }

    if (!kanban) {
      // Auto-register kanban baru on-the-fly untuk part yang sedang diproduksi pada mesin ini
      let targetPartId = run.partId;
      if (run.moldMode === "SET" && run.part.pairPartId && run.part.pairPart) {
        const isCodeRH = cleanCode.toUpperCase().includes("RH") || cleanCode.toUpperCase().includes("KANAN");
        const isRunPartRH = run.part.partNo.toUpperCase().includes("RH") || run.part.name.toUpperCase().includes("RH");
        if (isCodeRH) {
          targetPartId = isRunPartRH ? run.part.id : run.part.pairPart.id;
        } else if (cleanCode.toUpperCase().includes("LH") || cleanCode.toUpperCase().includes("KIRI")) {
          targetPartId = isRunPartRH ? run.part.pairPart.id : run.part.id;
        }
      }

      const assignedPart = await prisma.part.findUnique({ where: { id: targetPartId } });
      const defaultQty = (assignedPart?.qtyPerTrolly || run.part.qtyPerTrolly) || 1;

      kanban = await prisma.kanban.create({
        data: {
          code: cleanCode,
          partId: targetPartId,
          qtyPerTrolly:
            typeof input.customQty === "number" && input.customQty > 0
              ? Math.round(input.customQty)
              : defaultQty,
          isActive: true,
        },
        include: { part: true },
      });
    }

    if (!kanban.isActive) {
      return { success: false, error: "Kartu kanban ini dinonaktifkan." };
    }

    // Validate operator permission: only assigned operator or Supervisor/Admin can scan
    const callingUser = await prisma.user.findUnique({
      where: { id: input.operatorId },
    });

    if (
      callingUser &&
      callingUser.role === "OPERATOR" &&
      run.operatorId !== input.operatorId
    ) {
      const assignedOp = await prisma.user.findUnique({
        where: { id: run.operatorId },
      });
      return {
        success: false,
        error: `Akses Ditolak: Mesin ini sedang dioperasikan oleh ${
          assignedOp?.name || "operator lain"
        }. Hanya operator yang bertugas atau Supervisor/Admin yang dapat men-scan trolly pada mesin ini.`,
      };
    }

    // Validate Part match (mendukung Family Mold: Mode 1 Set LH & RH atau Single)
    const isMainPart = kanban.partId === run.partId;
    const isPairPart = Boolean(run.part.pairPartId && kanban.partId === run.part.pairPartId);
    const isSetMode = run.moldMode === "SET" || !run.moldMode;

    if (isSetMode && run.part.pairPartId) {
      if (!isMainPart && !isPairPart) {
        return {
          success: false,
          error: `Part tidak cocok! Mode 1 Set menerima scan part "${run.part.partNo}" atau pasangannya "${run.part.pairPart?.partNo}", sedangkan kanban ini untuk "${kanban.part.partNo}".`,
        };
      }
    } else {
      if (!isMainPart) {
        return {
          success: false,
          error: `Part tidak cocok! Mode Single hanya menerima scan part "${run.part.partNo}", sedangkan kanban ini untuk "${kanban.part.partNo}".`,
        };
      }
    }

    // Anti-duplicate validation: check scans in the last 10 seconds for same kanban
    const recentScan = await prisma.scanLog.findFirst({
      where: {
        runId: run.id,
        kanbanId: kanban.id,
        isVoid: false,
        scannedAt: {
          gte: new Date(Date.now() - 10000), // 10 seconds cooldown
        },
      },
    });

    if (recentScan) {
      return {
        success: false,
        error: "Duplikat terdeteksi! Trolly ini baru saja di-scan kurang dari 10 detik yang lalu.",
      };
    }

    // Calculate trolly number & lot number (per sisi part jika set)
    const previousScansForThisPart = await prisma.scanLog.count({
      where: {
        runId: run.id,
        kanban: { partId: kanban.partId },
        isVoid: false,
      },
    });
    const trollyNumber = previousScansForThisPart + 1;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = now.getFullYear();
    const yy = String(yyyy).slice(-2);
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const shiftStr = run.shift || "Shift 1";
    const shiftMatch = shiftStr.match(/\d+/);
    const shiftCode = shiftMatch ? `S${shiftMatch[0]}` : shiftStr.replace(/\s+/g, "");
    const machineCode = (run.machine?.code || `M${run.machineId}`).trim().replace(/\s+/g, "");
    const kanbanPartNo = (kanban.part?.partNo || "").toUpperCase();
    const kanbanPartName = (kanban.part?.name || "").toUpperCase();
    const isKanbanRH = kanbanPartNo.includes("RH") || kanbanPartName.includes("RH") || kanbanPartName.includes("KANAN");
    const sideTag = isSetMode && run.part.pairPartId ? (isKanbanRH ? "-RH" : "-LH") : "";
    const generatedLot = `L-${machineCode}-${yy}${mm}${dd}-${shiftCode}${sideTag}-T${pad(trollyNumber)}`;

    // Determine Qty per trolly snapshot (override on Kanban or default from Part)
    const stdQty = kanban.qtyPerTrolly ?? kanban.part.qtyPerTrolly ?? run.part.qtyPerTrolly;
    let qtyToAdd = stdQty;

    if (typeof input.customQty === "number" && input.customQty > 0) {
      // Jika ditentukan secara eksplisit
      qtyToAdd = Math.round(input.customQty);
    } else if (run.plan && run.plan.targetQty > 0) {
      // Otomatisasi trolly tidak penuh dari sisa target PPIC:
      // Catatan Family Mold: Jika mode 1 Set, targetQty adalah target per sisi (misal 400 Set = 400 LH dan 400 RH).
      // Oleh karena itu, sisa trolly harus dihitung berdasarkan akumulasi scan untuk part yang sedang di-scan saat ini!
      let currentQtyForThisPart = 0;
      if (isSetMode && run.part.pairPartId) {
        const prevPartScans = await prisma.scanLog.aggregate({
          where: {
            runId: run.id,
            isVoid: false,
            kanban: { partId: kanban.partId },
          },
          _sum: { qty: true },
        });
        currentQtyForThisPart = prevPartScans._sum.qty || 0;
      } else {
        const prevScans = await prisma.scanLog.aggregate({
          where: { runId: run.id, isVoid: false },
          _sum: { qty: true },
        });
        currentQtyForThisPart = (prevScans._sum.qty || 0) + (run.remainderQty || 0);
      }

      const remainingTarget = Math.max(0, run.plan.targetQty - currentQtyForThisPart);

      // Jika sisa target positif dan lebih kecil dari standar trolly penuh:
      // Otomatiskan kuantiti trolly ini sebesar sisa target (misal target 400, sudah 250, sisa 150 < 250 -> otomatis 150 pcs!)
      if (remainingTarget > 0 && remainingTarget < stdQty) {
        qtyToAdd = remainingTarget;
      }
    }

    const isPartial = qtyToAdd < stdQty;
    const finalLotNumber = isPartial ? `${generatedLot}-PARTIAL` : generatedLot;

    const scanLog = await prisma.scanLog.create({
      data: {
        runId: run.id,
        kanbanId: kanban.id,
        lotNumber: finalLotNumber,
        qty: qtyToAdd,
        scannedById: input.operatorId,
      },
      include: {
        kanban: true,
        scannedBy: true,
      },
    });

    revalidatePath("/");
    return {
      success: true,
      addedQty: qtyToAdd,
      isPartial,
      lotNumber: finalLotNumber,
      trollyNumber,
      data: {
        scanLog,
        partNo: run.part.partNo,
        addedQty: qtyToAdd,
        isPartial,
        lotNumber: finalLotNumber,
        trollyNumber,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses scan kanban";
    return { success: false, error: message };
  }
}

// 5. Stop Run
export async function stopRun(input: StopRunInput) {
  try {
    const run = await prisma.productionRun.findUnique({
      where: { id: input.runId },
      include: { machine: true, part: true },
    });

    if (!run) {
      return { success: false, error: "Run produksi tidak ditemukan." };
    }

    if (run.status !== "RUNNING") {
      return { success: false, error: "Run produksi sudah dihentikan sebelumnya." };
    }

    // Validate operator permission: only assigned operator or Supervisor/Admin can stop the machine
    const callingUser = await prisma.user.findUnique({
      where: { id: input.operatorId },
    });

    if (
      callingUser &&
      callingUser.role === "OPERATOR" &&
      run.operatorId !== input.operatorId
    ) {
      const assignedOp = await prisma.user.findUnique({
        where: { id: run.operatorId },
      });
      return {
        success: false,
        error: `Akses Ditolak: Mesin ini sedang dioperasikan oleh ${
          assignedOp?.name || "operator lain"
        }. Hanya operator yang bertugas atau Supervisor/Admin yang dapat menghentikan mesin ini.`,
      };
    }

    const stopReason = await prisma.stopReason.findUnique({
      where: { id: input.stopReasonId },
    });

    if (!stopReason) {
      return { success: false, error: "Alasan stop wajib dipilih." };
    }

    // Update status plan jika target tercapai atau alasan adalah Selesai Produksi
    const isCompletedReason = Boolean(
      stopReason.category === "Selesai Produksi" ||
      stopReason.category === "Selesai" ||
      stopReason.reason.toLowerCase().includes("selesai produksi") ||
      stopReason.reason.toLowerCase().includes("selesai")
    );

    // Poka-Yoke: Jika alasan adalah Selesai Produksi, pastikan part ini memiliki output scan atau remainder > 0
    if (isCompletedReason) {
      const currentRunScans = await prisma.scanLog.count({
        where: { runId: run.id, isVoid: false },
      });
      let totalQtyAccounted = currentRunScans + Math.max(0, input.remainderQty || 0);

      if (totalQtyAccounted === 0 && run.planId) {
        const planScans = await prisma.scanLog.count({
          where: { run: { planId: run.planId }, isVoid: false },
        });
        totalQtyAccounted = planScans;
      }

      if (totalQtyAccounted === 0) {
        return {
          success: false,
          error: `Tidak dapat memilih alasan Selesai Produksi: Part ini (${run.part.partNo}) belum memiliki input scan kuantiti trolly atau sisa part. Silakan lakukan scan trolly terlebih dahulu atau isi kuantiti pada sisa trolly.`,
        };
      }
    }

    const now = new Date();
    const updatedRun = await prisma.productionRun.update({
      where: { id: run.id },
      data: {
        status: "STOPPED",
        stopTime: now,
        stopReasonId: input.stopReasonId,
        remainderQty: Math.max(0, input.remainderQty || 0),
        qtyReject: Math.max(0, input.qtyReject || 0),
        notes: input.notes || null,
      },
      include: {
        machine: true,
        part: true,
        stopReason: true,
        scans: { where: { isVoid: false }, include: { kanban: true } },
      },
    });


    if (run.planId) {
      const plan = await prisma.productionPlan.findUnique({
        where: { id: run.planId },
      });
      if (plan) {
        const isSetMode = run.moldMode === "SET" || !run.moldMode;
        let isTargetReached = false;

        if (isSetMode && run.part.pairPartId) {
          const lhScans = (updatedRun.scans || []).filter((s) => s.kanban.partId === run.partId);
          const rhScans = (updatedRun.scans || []).filter((s) => s.kanban.partId === run.part.pairPartId);
          const lhQty = lhScans.reduce((acc, s) => acc + s.qty, 0);
          const rhQty = rhScans.reduce((acc, s) => acc + s.qty, 0);
          const setsCount = Math.min(lhQty, rhQty);
          isTargetReached = setsCount >= plan.targetQty;
        } else {
          const scanTotal = (updatedRun.scans || []).reduce((acc: number, s: { qty: number }) => acc + s.qty, 0);
          const currentPcs = scanTotal + input.remainderQty;
          isTargetReached = currentPcs >= plan.targetQty;
        }

        if (isTargetReached || isCompletedReason) {
          await prisma.productionPlan.update({
            where: { id: plan.id },
            data: { status: "COMPLETED" },
          });
        }
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: run.id,
        action: "STOP_RUN",
        newValue: JSON.stringify({
          stopTime: now,
          stopReason: stopReason.reason,
          remainderQty: input.remainderQty,
          qtyReject: input.qtyReject,
          stoppedBy: input.operatorId,
        }),
        userId: input.operatorId,
      },
    });

    revalidatePath("/");
    return { success: true, data: updatedRun };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghentikan run";
    return { success: false, error: message };
  }
}

// 5.1 Change Run Operator (Pergantian Operator / Relief / Istirahat)
export interface ChangeRunOperatorInput {
  runId: number;
  newOperatorId: number;
  changedById?: number;
  reason?: string;
}

export async function changeRunOperator(input: ChangeRunOperatorInput) {
  try {
    const run = await prisma.productionRun.findUnique({
      where: { id: input.runId },
      include: { operator: true },
    });
    if (!run) {
      return { success: false, error: "Sesi produksi tidak ditemukan." };
    }

    const newOperator = await prisma.user.findUnique({
      where: { id: input.newOperatorId },
    });
    if (!newOperator) {
      return { success: false, error: "Operator baru tidak ditemukan." };
    }

    const now = new Date();

    // 1. Audit log with timestamp for hourly timeline distribution
    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: run.id,
        action: "CHANGE_OPERATOR",
        oldValue: JSON.stringify({
          operatorId: run.operatorId,
          name: run.operator.name,
          employeeId: run.operator.employeeId,
        }),
        newValue: JSON.stringify({
          operatorId: newOperator.id,
          name: newOperator.name,
          employeeId: newOperator.employeeId,
          reason: input.reason || "Pergantian operator / istirahat",
          changedAt: now.toISOString(),
        }),
        userId: input.changedById || input.newOperatorId,
      },
    });

    // 2. Update operator on active run
    const updatedRun = await prisma.productionRun.update({
      where: { id: run.id },
      data: {
        operatorId: input.newOperatorId,
      },
      include: {
        operator: true,
      },
    });

    revalidatePath("/");
    return {
      success: true,
      data: {
        id: updatedRun.id,
        operator: {
          id: newOperator.id,
          name: newOperator.name,
          employeeId: newOperator.employeeId,
        },
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengganti operator";
    return { success: false, error: message };
  }
}

// 5.5 Save / Update Run Rejects (Input NG saat mesin running atau stop)
export interface SaveRunRejectsInput {
  runId: number;
  rejects: Array<{
    defectTypeId: number;
    qty: number;
    partId?: number;
  }>;
  operatorId?: number;
}

export async function saveRunRejects(input: SaveRunRejectsInput) {
  try {
    const run = await prisma.productionRun.findUnique({
      where: { id: input.runId },
      include: { machine: true, part: true },
    });

    if (!run) {
      return { success: false, error: "Run produksi tidak ditemukan." };
    }

    // Upsert each defect count inside transaction
    await prisma.$transaction(async (tx) => {
      let totalReject = 0;

      for (const item of input.rejects) {
        const qty = Math.max(0, item.qty || 0);
        totalReject += qty;
        const targetPartId = item.partId || run.partId;

        await tx.runReject.upsert({
          where: {
            runId_defectTypeId_partId: {
              runId: input.runId,
              defectTypeId: item.defectTypeId,
              partId: targetPartId,
            },
          },
          update: {
            qty,
          },
          create: {
            runId: input.runId,
            defectTypeId: item.defectTypeId,
            partId: targetPartId,
            qty,
          },
        });
      }

      // Update total qtyReject di ProductionRun
      await tx.productionRun.update({
        where: { id: input.runId },
        data: {
          qtyReject: totalReject,
        },
      });

      // Audit log
      if (input.operatorId) {
        await tx.auditLog.create({
          data: {
            entity: "ProductionRun",
            entityId: input.runId,
            action: "UPDATE_REJECTS",
            oldValue: JSON.stringify({ qtyReject: run.qtyReject }),
            newValue: JSON.stringify({ qtyReject: totalReject, breakdown: input.rejects }),
            userId: input.operatorId,
          },
        });
      }
    });

    try {
      revalidatePath("/");
    } catch {}
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan data NG";
    return { success: false, error: message };
  }
}

export async function getDefectTypes() {
  try {
    const defectTypes = await prisma.defectType.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
    return { success: true, data: defectTypes };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat jenis defect";
    return { success: false, error: message, data: [] };
  }
}

// 6. Void Scan Log (STRICTLY ADMIN ONLY)
export async function voidScan(scanId: number, reason: string, userId: number) {
  try {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Alasan pembatalan scan wajib diisi." };
    }

    const callingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    const session = await getSession();
    const role = session?.role || callingUser?.role;

    if (role !== "ADMIN") {
      return {
        success: false,
        error: "Akses Ditolak: Hanya pengguna dengan Role ADMIN yang berwenang membatalkan / menghapus data scan produksi.",
      };
    }

    const scan = await prisma.scanLog.findUnique({
      where: { id: scanId },
      include: { kanban: true },
    });

    if (!scan) {
      return { success: false, error: "Data scan tidak ditemukan." };
    }

    if (scan.isVoid) {
      return { success: false, error: "Scan ini sudah dibatalkan sebelumnya." };
    }

    const updated = await prisma.scanLog.update({
      where: { id: scanId },
      data: {
        isVoid: true,
        voidReason: reason.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: "ScanLog",
        entityId: scanId,
        action: "VOID_SCAN",
        oldValue: JSON.stringify({ isVoid: false, qty: scan.qty, kanban: scan.kanban.code }),
        newValue: JSON.stringify({ isVoid: true, reason }),
        userId: userId,
      },
    });

    revalidatePath("/");
    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal membatalkan scan";
    return { success: false, error: message };
  }
}

// 6b. Delete Entire Production Data for a Machine (STRICTLY ADMIN ONLY)
export async function deleteMachineProductionData(machineId: number, operatorId?: number) {
  try {
    const session = await getSession();
    let role = session?.role;
    if (!role && operatorId) {
      const u = await prisma.user.findUnique({ where: { id: operatorId } });
      role = u?.role;
    }

    if (role !== "ADMIN") {
      return {
        success: false,
        error: "Akses Ditolak: Hanya pengguna dengan Role ADMIN yang berwenang menghapus data produksi mesin.",
      };
    }

    const machine = await prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) {
      return { success: false, error: "Mesin tidak ditemukan." };
    }

    // Find all runs for this machine
    const runs = await prisma.productionRun.findMany({
      where: { machineId },
      select: { id: true },
    });
    const runIds = runs.map((r) => r.id);

    if (runIds.length > 0) {
      await prisma.scanLog.deleteMany({
        where: { runId: { in: runIds } },
      });
      await prisma.runReject.deleteMany({
        where: { runId: { in: runIds } },
      });
      await prisma.productionRun.deleteMany({
        where: { id: { in: runIds } },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        entity: "Machine",
        entityId: machineId,
        action: "CLEAR_PRODUCTION_DATA",
        newValue: JSON.stringify({ deletedRunsCount: runIds.length, machineCode: machine.code }),
        userId: operatorId || 1,
      },
    });

    revalidatePath("/");
    return { success: true, count: runIds.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghapus data produksi mesin";
    return { success: false, error: message };
  }
}

// 6c. Delete Single Production Run (STRICTLY ADMIN ONLY)
export async function deleteProductionRun(runId: number, operatorId?: number) {
  try {
    const session = await getSession();
    let role = session?.role;
    if (!role && operatorId) {
      const u = await prisma.user.findUnique({ where: { id: operatorId } });
      role = u?.role;
    }

    if (role !== "ADMIN") {
      return {
        success: false,
        error: "Akses Ditolak: Hanya pengguna dengan Role ADMIN yang berwenang menghapus data produksi.",
      };
    }

    const run = await prisma.productionRun.findUnique({
      where: { id: runId },
      include: { machine: true },
    });
    if (!run) {
      return { success: false, error: "Data run produksi tidak ditemukan." };
    }

    await prisma.scanLog.deleteMany({ where: { runId } });
    await prisma.runReject.deleteMany({ where: { runId } });
    await prisma.productionRun.delete({ where: { id: runId } });

    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: runId,
        action: "DELETE_RUN",
        oldValue: JSON.stringify({ runId, machineId: run.machineId, partId: run.partId }),
        userId: operatorId || 1,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghapus run produksi";
    return { success: false, error: message };
  }
}

// 7. Force Stop Run (Supervisor emergency closure)
export async function forceStopRun(runId: number, stopReasonId: number, supervisorId: number) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPERVISOR" && session.role !== "ADMIN") {
      return { success: false, error: "Akses Ditolak: Hanya Supervisor atau Admin yang memiliki wewenang Force Stop." };
    }

    const run = await prisma.productionRun.findUnique({
      where: { id: runId },
    });

    if (!run || run.status !== "RUNNING") {
      return { success: false, error: "Run produksi tidak aktif." };
    }

    const now = new Date();
    const updated = await prisma.productionRun.update({
      where: { id: runId },
      data: {
        status: "STOPPED",
        stopTime: now,
        stopReasonId,
        notes: "Ditutup paksa oleh supervisor (auto-close).",
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: runId,
        action: "FORCE_STOP",
        newValue: JSON.stringify({ stopTime: now, stopReasonId, supervisorId }),
        userId: supervisorId,
      },
    });

    revalidatePath("/");
    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menutup run";
    return { success: false, error: message };
  }
}

// 8. Get Dashboard Metrics and Statuses
export async function getDashboardOverview() {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: {
        runs: {
          take: 1,
          orderBy: { startTime: "desc" },
          include: {
            part: true,
            operator: true,
            stopReason: true,
            scans: { where: { isVoid: false } },
          },
        },
      },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRuns = await prisma.productionRun.findMany({
      where: {
        startTime: { gte: todayStart },
      },
      include: {
        part: true,
        machine: true,
        stopReason: true,
        scans: { where: { isVoid: false } },
      },
    });

    let runningCount = 0;
    let downCount = 0;
    let idleCount = 0;

    machines.forEach((m) => {
      const latest = m.runs[0];
      const isRunning = Boolean(latest && latest.status === "RUNNING");
      const isCompletedProduction = Boolean(
        latest &&
        latest.stopReason &&
        (latest.stopReason.category === "Selesai Produksi" ||
          latest.stopReason.category === "Selesai" ||
          latest.stopReason.reason.toLowerCase().includes("selesai produksi") ||
          latest.stopReason.reason.toLowerCase().includes("selesai"))
      );
      const isStoppedToday = Boolean(
        latest &&
        latest.stopTime &&
        new Date(latest.stopTime).getTime() >= todayStart.getTime()
      );

      if (isRunning) {
        runningCount++;
      } else if (isStoppedToday && !isCompletedProduction) {
        downCount++;
      } else {
        idleCount++;
      }
    });

    let totalPcsOk = 0;
    let totalPcsReject = 0;
    let totalTrolly = 0;
    let totalTargetQty = 0;

    todayRuns.forEach((r) => {
      const scanQty = r.scans.reduce((a, s) => a + s.qty, 0);
      const ok = scanQty + r.remainderQty;
      totalPcsOk += ok;
      totalPcsReject += r.qtyReject;
      totalTrolly += r.scans.length;

      // Calculate Target Qty for finished or ongoing runs
      const end = r.stopTime ? new Date(r.stopTime).getTime() : Date.now();
      const start = new Date(r.startTime).getTime();
      const durationSec = Math.max(0, (end - start) / 1000);
      if (r.part.cycleTimeSec > 0) {
        const target = (durationSec / r.part.cycleTimeSec) * r.part.cavity;
        totalTargetQty += target;
      }
    });

    const efficiency = totalTargetQty > 0 ? (totalPcsOk / totalTargetQty) * 100 : 0;
    const totalPcs = totalPcsOk + totalPcsReject;
    const rejectRate = totalPcs > 0 ? (totalPcsReject / totalPcs) * 100 : 0;

    return {
      success: true,
      data: {
        machineCounts: {
          total: machines.length,
          running: runningCount,
          down: downCount,
          idle: idleCount,
        },
        productionToday: {
          totalRuns: todayRuns.length,
          totalTrolly,
          totalPcsOk,
          totalPcsReject,
          efficiency: Math.round(efficiency * 10) / 10,
          rejectRate: Math.round(rejectRate * 10) / 10,
        },
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat overview dashboard";
    return { success: false, error: message };
  }
}

// 9. Get Reports with Downtime Pareto
export async function getProductionReports(filters?: {
  machineId?: number;
  partId?: number;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const whereClause: Record<string, unknown> = {};

    if (filters?.machineId) {
      whereClause.machineId = filters.machineId;
    }
    if (filters?.partId) {
      whereClause.partId = filters.partId;
    }
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const eDate = new Date(filters.endDate);
        eDate.setHours(23, 59, 59, 999);
        dateFilter.lte = eDate;
      }
      whereClause.startTime = dateFilter;
    }

    const [runs, machineParts] = await Promise.all([
      prisma.productionRun.findMany({
        where: whereClause,
        orderBy: { startTime: "desc" },
        include: {
          machine: true,
          part: true,
          operator: true,
          stopReason: true,
          scans: { where: { isVoid: false } },
        },
      }),
      prisma.machinePart.findMany({
        where: { cycleTimeSec: { not: null } },
      }),
    ]);

    const machinePartCtMap = new Map<string, number>();
    machineParts.forEach((mp) => {
      if (mp.cycleTimeSec && mp.cycleTimeSec > 0) {
        machinePartCtMap.set(`${mp.machineId}_${mp.partId}`, mp.cycleTimeSec);
      }
    });

    // Process runs into report rows with formulas
    const reportRows = runs.map((r) => {
      const scanQty = r.scans.reduce((a, s) => a + s.qty, 0);
      const qtyOk = scanQty + r.remainderQty;
      const end = r.stopTime ? new Date(r.stopTime).getTime() : Date.now();
      const start = new Date(r.startTime).getTime();
      const durationSec = Math.max(0, Math.floor((end - start) / 1000));

      const effectiveCt = machinePartCtMap.get(`${r.machineId}_${r.partId}`) || r.part.cycleTimeSec;

      const targetQty =
        effectiveCt > 0
          ? Math.floor((durationSec / effectiveCt) * r.part.cavity)
          : 0;

      const efficiency = targetQty > 0 ? Math.min(150, Math.round((qtyOk / targetQty) * 1000) / 10) : 0;
      const totalProduced = qtyOk + r.qtyReject;
      const rejectRate = totalProduced > 0 ? Math.round((r.qtyReject / totalProduced) * 1000) / 10 : 0;

      return {
        id: r.id,
        machineCode: r.machine.code,
        machineModel: r.machine.model || "-",
        partNo: r.part.partNo,
        partName: r.part.name,
        operatorName: r.operator.name,
        shift: r.shift || "Shift 1",
        status: r.status,
        startTime: r.startTime.toISOString(),
        stopTime: r.stopTime ? r.stopTime.toISOString() : null,
        durationSec,
        trollyCount: r.scans.length,
        qtyOk,
        qtyReject: r.qtyReject,
        targetQty,
        efficiency,
        rejectRate,
        stopReason: r.stopReason ? `${r.stopReason.category}: ${r.stopReason.reason}` : "-",
      };
    });

    // Calculate Downtime Pareto
    // Downtime per StopReason category and reason
    const downtimeCounts: Record<string, { category: string; reason: string; count: number; totalMinutes: number }> = {};

    runs.forEach((r) => {
      if (r.stopReason) {
        const key = `${r.stopReason.category} - ${r.stopReason.reason}`;
        if (!downtimeCounts[key]) {
          downtimeCounts[key] = {
            category: r.stopReason.category,
            reason: r.stopReason.reason,
            count: 0,
            totalMinutes: 0,
          };
        }
        downtimeCounts[key].count += 1;
        // Approximate downtime duration until next run or default duration
        downtimeCounts[key].totalMinutes += 15; // baseline interval
      }
    });

    const paretoList = Object.values(downtimeCounts)
      .sort((a, b) => b.count - a.count)
      .map((item, idx, arr) => {
        const totalOccurrences = arr.reduce((acc, curr) => acc + curr.count, 0);
        const cumCount = arr.slice(0, idx + 1).reduce((acc, curr) => acc + curr.count, 0);
        const cumulativePercent = totalOccurrences > 0 ? Math.round((cumCount / totalOccurrences) * 100) : 0;
        return {
          ...item,
          cumulativePercent,
        };
      });

    return {
      success: true,
      data: {
        rows: reportRows,
        pareto: paretoList,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat laporan produksi";
    return { success: false, error: message };
  }
}

// 10. Master Data Queries
export async function getMasterData() {
  try {
    const [machines, parts, stopReasons, kanbans, users, defectTypes] = await Promise.all([
      prisma.machine.findMany({
        orderBy: { code: "asc" },
        include: { parts: { include: { part: true } } },
      }),
      prisma.part.findMany({
        orderBy: { partNo: "asc" },
        include: {
          machines: { include: { machine: true } },
          pairPart: true,
        },
      }),
      prisma.stopReason.findMany({
        orderBy: [{ category: "asc" }, { reason: "asc" }],
      }),
      prisma.kanban.findMany({
        orderBy: { code: "asc" },
        include: { part: true },
      }),
      prisma.user.findMany({
        orderBy: { employeeId: "asc" },
      }),
      prisma.defectType.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
    ]);

    const masterAttrMap = await getPartAttributesMap();
    parts.forEach((p) => {
      const attr = masterAttrMap.get(p.id);
      (p as any).containerType = attr?.containerType || (p as any).containerType || "TROLLY";
      (p as any).customer = attr?.customer ?? (p as any).customer ?? null;
      if (p.pairPart) {
        const pairAttr = masterAttrMap.get(p.pairPart.id);
        (p.pairPart as any).containerType = pairAttr?.containerType || (p.pairPart as any).containerType || "TROLLY";
        (p.pairPart as any).customer = pairAttr?.customer ?? (p.pairPart as any).customer ?? null;
      }
    });
    machines.forEach((m) => {
      m.parts?.forEach((mp) => {
        if (mp.part) {
          const attr = masterAttrMap.get(mp.part.id);
          (mp.part as any).containerType = attr?.containerType || (mp.part as any).containerType || "TROLLY";
          (mp.part as any).customer = attr?.customer ?? (mp.part as any).customer ?? null;
        }
      });
    });
    kanbans.forEach((k) => {
      if (k.part) {
        const attr = masterAttrMap.get(k.part.id);
        (k.part as any).containerType = attr?.containerType || (k.part as any).containerType || "TROLLY";
        (k.part as any).customer = attr?.customer ?? (k.part as any).customer ?? null;
      }
    });

    return {
      success: true,
      data: {
        machines,
        parts,
        stopReasons,
        kanbans,
        users,
        defectTypes,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat master data";
    return { success: false, error: message };
  }
}

// 11. Add/Edit Kanban
export async function createKanban(code: string, partId: number, qtyPerTrolly?: number) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Admin atau Supervisor yang dapat membuat kartu Kanban." };
    }

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return { success: false, error: "Kode kanban wajib diisi." };
    }

    const existing = await prisma.kanban.findUnique({ where: { code: trimmed } });
    if (existing) {
      return { success: false, error: `Kode kanban "${trimmed}" sudah terdaftar.` };
    }

    const created = await prisma.kanban.create({
      data: {
        code: trimmed,
        partId,
        qtyPerTrolly: qtyPerTrolly || null,
        isActive: true,
      },
      include: { part: true },
    });

    revalidatePath("/master");
    return { success: true, data: created };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal membuat kanban";
    return { success: false, error: message };
  }
}

// 11b. Atur Relasi Pasangan Part (Family Mold: Set LH & RH)
export async function setPartPair(partAId: number, partBId: number | null) {
  try {
    const partA = await prisma.part.findUnique({ where: { id: partAId } });
    if (!partA) return { success: false, error: "Part tidak ditemukan." };

    // Hapus relasi lama part A jika ada
    if (partA.pairPartId && partA.pairPartId !== partBId) {
      await prisma.part.update({
        where: { id: partA.pairPartId },
        data: { pairPartId: null },
      });
    }

    if (partBId) {
      const partB = await prisma.part.findUnique({ where: { id: partBId } });
      if (!partB) return { success: false, error: "Part pasangan tidak ditemukan." };

      // Hapus relasi lama part B jika ada
      if (partB.pairPartId && partB.pairPartId !== partAId) {
        await prisma.part.update({
          where: { id: partB.pairPartId },
          data: { pairPartId: null },
        });
      }

      // Hubungkan kedua part secara dua arah (bidirectional)
      await prisma.part.update({
        where: { id: partAId },
        data: { pairPartId: partBId },
      });
      await prisma.part.update({
        where: { id: partBId },
        data: { pairPartId: partAId },
      });
    } else {
      // Putus hubungan pasangan
      await prisma.part.update({
        where: { id: partAId },
        data: { pairPartId: null },
      });
    }

    revalidatePath("/");
    revalidatePath("/master");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengatur relasi pasangan part";
    return { success: false, error: message };
  }
}

// 12. Import Machines from CSV (FR-09)
export async function importMachinesFromCsv(csvText: string) {
  try {
    const session = await getSession();
    if (session && session.role !== "ADMIN") {
      return { success: false, error: "Akses Ditolak: Hanya Administrator yang berwenang mengimpor mesin." };
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return { success: false, error: "File CSV kosong atau hanya berisi header." };
    }

    const delimiter = detectDelimiter(lines[0]);
    let count = 0;
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i], delimiter);
      if (parts.length < 3) continue;

      const [code, model, tonnageStr, isActiveStr] = parts;
      if (!code) continue;

      const tonnage = parseInt(tonnageStr, 10) || 100;
      const isActive = isActiveStr ? isActiveStr.toUpperCase() !== "FALSE" : true;

      await prisma.machine.upsert({
        where: { code: code.toUpperCase() },
        update: {
          model: model || null,
          tonnage,
          isActive,
        },
        create: {
          code: code.toUpperCase(),
          model: model || null,
          tonnage,
          isActive,
        },
      });
      count++;
    }

    revalidatePath("/");
    return { success: true, count };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengimpor mesin dari CSV";
    return { success: false, error: message };
  }
}

// Robust CSV line parser compliant with RFC 4180 (handles delimiters inside quotes and escaped quotes)
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Auto-detect list delimiter (semicolon for Indonesian/European Excel, comma for standard RFC, tab)
function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (semicolons > commas && semicolons > tabs) return ";";
  if (tabs > commas && tabs > semicolons) return "\t";
  return ",";
}

// Helper to process structured 2D rows (from either CSV or XLSX)
export async function processPartRowsData(rows: string[][]) {
  if (!rows || rows.length === 0) {
    return { success: false, error: "Data kosong." };
  }

  const firstRowParsed = rows[0].map((col) =>
    (col || "").toString().toLowerCase().replace(/[\s_-]+/g, "")
  );

  // Identify header positions
  let partNoIdx = -1;
  let nameIdx = -1;
  let ctIdx = -1;
  let cavityIdx = -1;
  let qtyTrollyIdx = -1;
  let materialIdx = -1;
  let machinesIdx = -1;
  let pairIdx = -1;
  let nextProcessIdx = -1;
  let containerTypeIdx = -1;
  let customerIdx = -1;

  firstRowParsed.forEach((header, idx) => {
    // 1. Part No
    if (header.includes("partno") || header.includes("kodepart") || header.includes("nomorpart") || header === "part" || header === "kode") {
      partNoIdx = idx;
    }
    // 2. Part Name
    else if (header.includes("namapart") || header.includes("partname") || header.includes("nama") || header.includes("deskripsi") || header.includes("desc")) {
      nameIdx = idx;
    }
    // 3. Customer / OEM
    else if (header.includes("customer") || header.includes("cust") || header.includes("oem") || header.includes("pelanggan")) {
      customerIdx = idx;
    }
    // 4. Cycle Time (detik)
    else if (header.includes("cycletime") || header.includes("ct") || header.includes("waktusiklus") || header.includes("siklus") || header.includes("detik")) {
      ctIdx = idx;
    }
    // 5. Cavity
    else if (header.includes("cavity") || header.includes("cav")) {
      cavityIdx = idx;
    }
    // 6. Qty per Kemasan (PRIORITAS: Cocokkan 'qty', 'isi', 'standar', 'jumlah' SEBELUM cek kata 'kemasan')
    else if (header.includes("qty") || header.includes("isi") || header.includes("standar") || header.includes("jumlah") || header === "pcs") {
      qtyTrollyIdx = idx;
    }
    // 7. Satuan Kemasan (TROLLY, BOX, RAK)
    else if (header.includes("satuan") || header.includes("kemasan") || header.includes("wadah") || header.includes("container") || header === "unit") {
      containerTypeIdx = idx;
    }
    // 8. Material
    else if (header.includes("material") || header.includes("bahan") || header.includes("rawmaterial") || header === "mat") {
      materialIdx = idx;
    }
    // 9. Mesin (daftar_kode_mesin)
    else if (header.includes("mesin") || header.includes("machine") || header.includes("daftarmesin")) {
      machinesIdx = idx;
    }
    // 10. Pasangan (Family Mold Pair)
    else if (header.includes("pasang") || header.includes("pair") || header.includes("partpasangan") || header.includes("pairpart")) {
      pairIdx = idx;
    }
    // 11. Proses Lanjutan (Next Process)
    else if (header.includes("process") || header.includes("proses") || header.includes("lanjutan") || header.includes("next")) {
      nextProcessIdx = idx;
    }
  });

  const isHeaderRow = partNoIdx !== -1 || nameIdx !== -1;
  const startIndex = isHeaderRow ? 1 : 0;

  // Default positional fallback if headers are not explicitly labeled
  if (partNoIdx === -1) partNoIdx = 0;
  if (nameIdx === -1) nameIdx = 1;
  if (customerIdx === -1 && rows[0]?.length >= 11) customerIdx = 2;
  if (ctIdx === -1) ctIdx = customerIdx !== -1 ? 3 : 2;
  if (cavityIdx === -1) cavityIdx = customerIdx !== -1 ? 4 : 3;
  if (qtyTrollyIdx === -1) qtyTrollyIdx = customerIdx !== -1 ? 5 : 4;
  if (containerTypeIdx === -1 && customerIdx !== -1) containerTypeIdx = 6;
  if (materialIdx === -1 && customerIdx !== -1) materialIdx = 7;
  if (machinesIdx === -1) machinesIdx = customerIdx !== -1 ? 8 : 5;
  if (pairIdx === -1 && customerIdx !== -1) pairIdx = 9;
  if (nextProcessIdx === -1 && customerIdx !== -1) nextProcessIdx = 10;

  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  // Pre-fetch all machines for quick lookup with flexible aliases
  const allMachines = await prisma.machine.findMany();
  const machineMap = new Map<string, number>();
  for (const m of allMachines) {
    const codeUpper = m.code.toUpperCase().trim();
    machineMap.set(codeUpper, m.id);
    machineMap.set(codeUpper.replace(/[\s_-]+/g, ""), m.id);

    // Support aliases: MC01, MC1, MC-01, MC 01, M01, M-01, IMM-01, IMM01, MESIN 01
    const mMatch = codeUpper.match(/^(?:MC|M|IMM|MESIN)?[_-]?(\d+)$/i);
    if (mMatch) {
      const num = parseInt(mMatch[1], 10);
      const pad = num < 10 ? `0${num}` : `${num}`;
      machineMap.set(`M${pad}`, m.id);
      machineMap.set(`MC${pad}`, m.id);
      machineMap.set(`M${num}`, m.id);
      machineMap.set(`MC${num}`, m.id);
      machineMap.set(`MC-${pad}`, m.id);
      machineMap.set(`MC-${num}`, m.id);
      machineMap.set(`MC ${pad}`, m.id);
      machineMap.set(`MC ${num}`, m.id);
      machineMap.set(`IMM-${pad}`, m.id);
      machineMap.set(`IMM-${num}`, m.id);
      machineMap.set(`IMM${pad}`, m.id);
      machineMap.set(`IMM${num}`, m.id);
      machineMap.set(`MESIN${pad}`, m.id);
      machineMap.set(`MESIN${num}`, m.id);
      machineMap.set(`MESIN-${pad}`, m.id);
      machineMap.set(`MESIN-${num}`, m.id);
    }
  }

  // 1. Pre-aggregate multiple rows by partNo in memory to merge machines (e.g. Row with MC01 & Row with MC02)
  interface AggregatedPart {
    partNo: string;
    name: string;
    customer?: string;
    cycleTimeSec: number;
    cavity: number;
    qtyPerTrolly: number;
    containerType?: string;
    material?: string;
    nextProcess: string;
    pairPartNo?: string;
    machineMapData: Map<number, number | null>; // machineId -> per-machine cycle time override
  }

  const aggregatedParts = new Map<string, AggregatedPart>();

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawPartNo = row[partNoIdx] ? row[partNoIdx].toString().trim() : "";
    if (!rawPartNo) {
      skippedCount++;
      continue;
    }

    const cleanPartNo = rawPartNo.toUpperCase();
    const rawName = row[nameIdx] ? row[nameIdx].toString().trim() : "";
    const rowCustomer = customerIdx !== -1 && row[customerIdx] ? row[customerIdx].toString().trim().toUpperCase() : undefined;

    // Parse numerical values safely
    const ctStr = row[ctIdx] ? row[ctIdx].toString().replace(",", ".") : "";
    const rowCt = parseFloat(ctStr) > 0 ? parseFloat(ctStr) : 0;

    const cavityStr = row[cavityIdx] ? row[cavityIdx].toString() : "";
    const rowCavity = parseInt(cavityStr, 10) > 0 ? parseInt(cavityStr, 10) : 0;

    const qtyStr = row[qtyTrollyIdx] ? row[qtyTrollyIdx].toString() : "";
    const rowQty = parseInt(qtyStr, 10) > 0 ? parseInt(qtyStr, 10) : 0;

    const rowContainer =
      containerTypeIdx !== -1 && row[containerTypeIdx]
        ? row[containerTypeIdx].toString().trim().toUpperCase()
        : "TROLLY";

    const rowMaterial = materialIdx !== -1 && row[materialIdx] ? row[materialIdx].toString().trim() : undefined;

    const nextProcess =
      nextProcessIdx !== -1 && row[nextProcessIdx]
        ? row[nextProcessIdx].toString().trim().toUpperCase()
        : "PAINTING";
    const pairPartNo =
      pairIdx !== -1 && row[pairIdx] ? row[pairIdx].toString().trim().toUpperCase() : undefined;

    // Extract machine codes from this row
    const rawMachines = machinesIdx !== -1 && row[machinesIdx] !== undefined ? row[machinesIdx].toString().trim() : "";
    const machineCodes = rawMachines
      ? rawMachines
          .split(/[\s,;|/]+/)
          .map((m) => m.trim().toUpperCase())
          .filter((m) => m.length > 0)
      : [];

    const targetMachineIds: number[] = [];
    for (const mCode of machineCodes) {
      const mId = machineMap.get(mCode);
      if (mId) {
        targetMachineIds.push(mId);
      }
    }

    if (!aggregatedParts.has(cleanPartNo)) {
      const machineMapData = new Map<number, number | null>();
      targetMachineIds.forEach((mId) => machineMapData.set(mId, rowCt > 0 ? rowCt : null));

      aggregatedParts.set(cleanPartNo, {
        partNo: cleanPartNo,
        name: rawName || cleanPartNo,
        customer: rowCustomer,
        cycleTimeSec: rowCt > 0 ? rowCt : 30.0,
        cavity: rowCavity > 0 ? rowCavity : 1,
        qtyPerTrolly: rowQty > 0 ? rowQty : 100,
        containerType: rowContainer,
        material: rowMaterial,
        nextProcess,
        pairPartNo,
        machineMapData,
      });
    } else {
      // MERGE (Opsi A): Part sama di baris berbeda dengan mesin dan cycle time spesifik mesin tersebut
      // Contoh: Baris 1: SL3800 di MC01 CT 38s, Baris 2: SL3800 di MC02 CT 24s
      const existingAgg = aggregatedParts.get(cleanPartNo)!;

      // Catat CT spesifik per mesin dari baris ini!
      targetMachineIds.forEach((mId) => {
        existingAgg.machineMapData.set(mId, rowCt > 0 ? rowCt : null);
      });

      // Retain best available data
      if (rawName && (!existingAgg.name || existingAgg.name === cleanPartNo)) {
        existingAgg.name = rawName;
      }
      if (rowCustomer && !existingAgg.customer) {
        existingAgg.customer = rowCustomer;
      }
      if (rowContainer && (!existingAgg.containerType || existingAgg.containerType === "TROLLY")) {
        existingAgg.containerType = rowContainer;
      }
      if (existingAgg.cycleTimeSec <= 0 && rowCt > 0) {
        existingAgg.cycleTimeSec = rowCt;
      }
      if (rowCavity > 0 && existingAgg.cavity <= 1) {
        existingAgg.cavity = rowCavity;
      }
      if (rowQty > 0 && existingAgg.qtyPerTrolly <= 100) {
        existingAgg.qtyPerTrolly = rowQty;
      }
      if (rowMaterial && !existingAgg.material) {
        existingAgg.material = rowMaterial;
      }
      if (pairPartNo && !existingAgg.pairPartNo) {
        existingAgg.pairPartNo = pairPartNo;
      }
    }
  }

  // 2. Write aggregated parts to database
  for (const item of Array.from(aggregatedParts.values())) {
    const existing = await prisma.part.findUnique({
      where: { partNo: item.partNo },
    });

    let partId: number;

    if (existing) {
      // OVERWRITE existing part
      const desiredContainer = item.containerType || (existing as any).containerType || "TROLLY";
      const desiredCustomer = item.customer || (existing as any).customer || null;
      let updated: any;
      try {
        updated = await prisma.part.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            cycleTimeSec: item.cycleTimeSec,
            cavity: item.cavity,
            qtyPerTrolly: item.qtyPerTrolly,
            containerType: desiredContainer,
            ...(desiredCustomer ? { customer: desiredCustomer } : {}),
            ...(item.material ? { material: item.material } : {}),
            nextProcess: item.nextProcess,
            isActive: true,
          },
        });
      } catch (prismaErr: any) {
        updated = await prisma.part.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            cycleTimeSec: item.cycleTimeSec,
            cavity: item.cavity,
            qtyPerTrolly: item.qtyPerTrolly,
            ...(item.material ? { material: item.material } : {}),
            nextProcess: item.nextProcess,
            isActive: true,
          },
        });
      }
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Part" SET "containerType" = ?, "customer" = ? WHERE "id" = ?`,
          desiredContainer,
          desiredCustomer,
          existing.id
        );
        updated.containerType = desiredContainer;
        updated.customer = desiredCustomer;
      } catch (sqlErr) {
        console.error("Failed raw update in importParts:", sqlErr);
      }
      partId = updated.id;
      updatedCount++;
    } else {
      // CREATE new part
      const desiredContainer = item.containerType || "TROLLY";
      const desiredCustomer = item.customer || null;
      let created: any;
      try {
        created = await prisma.part.create({
          data: {
            partNo: item.partNo,
            name: item.name,
            cycleTimeSec: item.cycleTimeSec,
            cavity: item.cavity,
            qtyPerTrolly: item.qtyPerTrolly,
            containerType: desiredContainer,
            customer: desiredCustomer,
            material: item.material || null,
            nextProcess: item.nextProcess,
            isActive: true,
          } as any,
        });
      } catch (prismaErr: any) {
        created = await prisma.part.create({
          data: {
            partNo: item.partNo,
            name: item.name,
            cycleTimeSec: item.cycleTimeSec,
            cavity: item.cavity,
            qtyPerTrolly: item.qtyPerTrolly,
            material: item.material || null,
            nextProcess: item.nextProcess,
            isActive: true,
          },
        });
      }
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Part" SET "containerType" = ?, "customer" = ? WHERE "id" = ?`,
          desiredContainer,
          desiredCustomer,
          created.id
        );
        created.containerType = desiredContainer;
        created.customer = desiredCustomer;
      } catch (sqlErr) {
        console.error("Failed raw update in importParts create:", sqlErr);
      }
      partId = created.id;
      createdCount++;
    }

    // Synchronize Machine Relations (all merged machines!)
    if (item.machineMapData.size > 0) {
      await prisma.machinePart.deleteMany({
        where: { partId },
      });

      await prisma.machinePart.createMany({
        data: Array.from(item.machineMapData.entries()).map(([machineId, cycleTimeSec]) => ({
          machineId,
          partId,
          cycleTimeSec,
        })),
      });
    }

    // Handle Family Mold Pair Part if provided
    if (item.pairPartNo && item.pairPartNo !== item.partNo) {
      const pairTarget = await prisma.part.findUnique({
        where: { partNo: item.pairPartNo },
      });
      if (pairTarget) {
        await prisma.part.update({
          where: { id: partId },
          data: { pairPartId: pairTarget.id },
        });
        await prisma.part.update({
          where: { id: pairTarget.id },
          data: { pairPartId: partId },
        });
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/master");

  const totalProcessed = updatedCount + createdCount;
  return {
    success: true,
    count: totalProcessed,
    createdCount,
    updatedCount,
    skippedCount,
    errors,
  };
}

// 13. Import Parts & Machine Relations from CSV with Robust Delimiter, Header Mapping & Overwrite Support
export async function importPartsWithRelationsFromCsv(csvText: string) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Operator tidak berwenang mengimpor Master Part." };
    }

    // Clean byte-order mark (BOM) if present from Excel
    const cleanedCsv = csvText.replace(/^\uFEFF/, "");
    const rawLines = cleanedCsv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) {
      return { success: false, error: "File CSV kosong." };
    }

    const delimiter = detectDelimiter(rawLines[0]);
    const rows = rawLines.map((line) => parseCsvLine(line, delimiter));
    return await processPartRowsData(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengimpor part dari CSV";
    return { success: false, error: message };
  }
}

// 13a. Import Parts directly from parsed 2D row array (from Excel / XLSX)
export async function importPartsWithRelationsFromRows(rows: string[][]) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Operator tidak berwenang mengimpor Master Part." };
    }
    return await processPartRowsData(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengimpor part dari Excel";
    return { success: false, error: message };
  }
}


// 13b. Create Single Master Part
export async function createPart(data: {
  partNo: string;
  name: string;
  cycleTimeSec: number;
  cavity: number;
  qtyPerTrolly: number;
  containerType?: string;
  customer?: string | null;
  material?: string;
  nextProcess?: string;
  machineIds?: number[];
  pairPartId?: number | null;
}) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Admin atau Supervisor yang dapat menambah part." };
    }

    const cleanPartNo = data.partNo.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (!cleanPartNo || !cleanName) {
      return { success: false, error: "Nomor Part dan Nama Part wajib diisi." };
    }

    const existing = await prisma.part.findUnique({
      where: { partNo: cleanPartNo },
    });
    if (existing) {
      return { success: false, error: `Part dengan nomor "${cleanPartNo}" sudah terdaftar.` };
    }

    const desiredContainerType = data.containerType?.trim().toUpperCase() || "TROLLY";
    const desiredCustomer = data.customer?.trim().toUpperCase() || null;
    let created: any;
    try {
      created = await prisma.part.create({
        data: {
          partNo: cleanPartNo,
          name: cleanName,
          cycleTimeSec: Math.max(1, data.cycleTimeSec || 30),
          cavity: Math.max(1, data.cavity || 1),
          qtyPerTrolly: Math.max(1, data.qtyPerTrolly || 100),
          containerType: desiredContainerType,
          customer: desiredCustomer,
          material: data.material?.trim() || null,
          nextProcess: data.nextProcess?.trim().toUpperCase() || "PAINTING",
          pairPartId: data.pairPartId || null,
          isActive: true,
        } as any,
      });
    } catch (prismaErr: any) {
      created = await prisma.part.create({
        data: {
          partNo: cleanPartNo,
          name: cleanName,
          cycleTimeSec: Math.max(1, data.cycleTimeSec || 30),
          cavity: Math.max(1, data.cavity || 1),
          qtyPerTrolly: Math.max(1, data.qtyPerTrolly || 100),
          material: data.material?.trim() || null,
          nextProcess: data.nextProcess?.trim().toUpperCase() || "PAINTING",
          pairPartId: data.pairPartId || null,
          isActive: true,
        },
      });
    }
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Part" SET "containerType" = ?, "customer" = ? WHERE "id" = ?`,
        desiredContainerType,
        desiredCustomer,
        created.id
      );
      created.containerType = desiredContainerType;
      created.customer = desiredCustomer;
    } catch (sqlErr) {
      console.error("Failed raw update in createPart:", sqlErr);
    }

    // Assign machine relations
    if (data.machineIds && data.machineIds.length > 0) {
      await prisma.machinePart.createMany({
        data: data.machineIds.map((machineId) => ({
          machineId,
          partId: created.id,
        })),
      });
    }

    // Pair bidirectional if selected
    if (data.pairPartId) {
      await prisma.part.update({
        where: { id: data.pairPartId },
        data: { pairPartId: created.id },
      });
    }

    revalidatePath("/");
    revalidatePath("/master");
    return { success: true, data: created };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menambahkan part";
    return { success: false, error: message };
  }
}

// 13c. Update Single Master Part (Overwrite fields & machine relations)
export async function updatePart(
  id: number,
  data: {
    partNo?: string;
    name?: string;
    cycleTimeSec?: number;
    cavity?: number;
    qtyPerTrolly?: number;
    containerType?: string;
    customer?: string | null;
    material?: string | null;
    nextProcess?: string;
    isActive?: boolean;
    machineIds?: number[];
    pairPartId?: number | null;
  }
) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Admin atau Supervisor yang dapat mengubah part." };
    }

    const currentPart = await prisma.part.findUnique({ where: { id } });
    if (!currentPart) {
      return { success: false, error: "Part tidak ditemukan." };
    }

    const updatePayload: any = {};
    if (data.partNo !== undefined) {
      const cleanPartNo = data.partNo.trim().toUpperCase();
      if (!cleanPartNo) return { success: false, error: "Nomor part tidak boleh kosong." };
      // Check duplicate if partNo changed
      if (cleanPartNo !== currentPart.partNo) {
        const dup = await prisma.part.findUnique({ where: { partNo: cleanPartNo } });
        if (dup && dup.id !== id) {
          return { success: false, error: `Nomor part "${cleanPartNo}" sudah dipakai oleh part lain.` };
        }
      }
      updatePayload.partNo = cleanPartNo;
    }

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) return { success: false, error: "Nama part tidak boleh kosong." };
      updatePayload.name = cleanName;
    }

    if (data.cycleTimeSec !== undefined) {
      updatePayload.cycleTimeSec = Math.max(1, data.cycleTimeSec);
    }

    if (data.cavity !== undefined) {
      updatePayload.cavity = Math.max(1, data.cavity);
    }

    if (data.qtyPerTrolly !== undefined) {
      updatePayload.qtyPerTrolly = Math.max(1, data.qtyPerTrolly);
    }

    if (data.containerType !== undefined) {
      updatePayload.containerType = data.containerType.trim().toUpperCase() || "TROLLY";
    }

    if (data.customer !== undefined) {
      updatePayload.customer = data.customer ? data.customer.trim().toUpperCase() : null;
    }

    if (data.material !== undefined) {
      updatePayload.material = data.material?.trim() || null;
    }

    if (data.nextProcess !== undefined) {
      updatePayload.nextProcess = data.nextProcess.trim().toUpperCase() || "PAINTING";
    }

    if (data.isActive !== undefined) {
      updatePayload.isActive = data.isActive;
    }

    // Handle pair part update
    if (data.pairPartId !== undefined) {
      const oldPairId = currentPart.pairPartId;
      const newPairId = data.pairPartId;

      if (oldPairId && oldPairId !== newPairId) {
        await prisma.part.update({
          where: { id: oldPairId },
          data: { pairPartId: null },
        });
      }

      updatePayload.pairPartId = newPairId;

      if (newPairId) {
        await prisma.part.update({
          where: { id: newPairId },
          data: { pairPartId: id },
        });
      }
    }

    const desiredContainerType = updatePayload.containerType;
    const desiredCustomer = updatePayload.customer;
    let updated: any;
    try {
      updated = await prisma.part.update({
        where: { id },
        data: updatePayload,
      });
    } catch (prismaErr: any) {
      const safePayload = { ...updatePayload };
      delete (safePayload as any).containerType;
      delete (safePayload as any).customer;
      updated = await prisma.part.update({
        where: { id },
        data: safePayload,
      });
    }
    if (desiredContainerType !== undefined || desiredCustomer !== undefined) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Part" SET "containerType" = COALESCE(?, "containerType"), "customer" = ? WHERE "id" = ?`,
          desiredContainerType || null,
          desiredCustomer !== undefined ? desiredCustomer : null,
          id
        );
        if (desiredContainerType !== undefined) updated.containerType = desiredContainerType;
        if (desiredCustomer !== undefined) updated.customer = desiredCustomer;
      } catch (sqlErr) {
        console.error("Failed raw update in updatePart:", sqlErr);
      }
    }

    // Synchronize machine relations if provided
    if (data.machineIds !== undefined) {
      await prisma.machinePart.deleteMany({
        where: { partId: id },
      });

      if (data.machineIds.length > 0) {
        await prisma.machinePart.createMany({
          data: data.machineIds.map((machineId) => ({
            machineId,
            partId: id,
          })),
        });
      }
    }

    revalidatePath("/");
    revalidatePath("/master");
    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui part";
    return { success: false, error: message };
  }
}

// 13d. Delete Single Master Part
export async function deletePart(id: number) {
  try {
    const session = await getSession();
    if (session && session.role !== "ADMIN") {
      return { success: false, error: "Akses Ditolak: Hanya Administrator yang berwenang menghapus part." };
    }

    // Check if part is referenced in active runs
    const activeRuns = await prisma.productionRun.findFirst({
      where: { partId: id, status: "RUNNING" },
    });
    if (activeRuns) {
      return {
        success: false,
        error: "Part tidak dapat dihapus karena sedang diproduksi pada mesin aktif.",
      };
    }

    // Clean up pair relations
    await prisma.part.updateMany({
      where: { pairPartId: id },
      data: { pairPartId: null },
    });

    // Clean up machine relations
    await prisma.machinePart.deleteMany({
      where: { partId: id },
    });

    // Delete kanbans
    await prisma.kanban.deleteMany({
      where: { partId: id },
    });

    // Delete plans
    await prisma.productionPlan.deleteMany({
      where: { partId: id },
    });

    const deleted = await prisma.part.delete({
      where: { id },
    });

    revalidatePath("/");
    revalidatePath("/master");
    return { success: true, data: deleted };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghapus part";
    return { success: false, error: message };
  }
}

// 14. Delete Single Machine
export async function deleteMachine(machineId: number) {
  try {
    const session = await getSession();
    if (session && session.role !== "ADMIN") {
      return { success: false, error: "Akses Ditolak: Hanya Administrator yang berwenang menghapus mesin." };
    }

    // Delete relations
    await prisma.machinePart.deleteMany({
      where: { machineId },
    });

    const runs = await prisma.productionRun.findMany({
      where: { machineId },
      select: { id: true },
    });
    const runIds = runs.map((r) => r.id);
    if (runIds.length > 0) {
      await prisma.scanLog.deleteMany({
        where: { runId: { in: runIds } },
      });
      await prisma.productionRun.deleteMany({
        where: { id: { in: runIds } },
      });
    }

    const deleted = await prisma.machine.delete({
      where: { id: machineId },
    });

    revalidatePath("/");
    return { success: true, data: deleted };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghapus mesin";
    return { success: false, error: message };
  }
}

// 15. Clear All Machines
export async function clearAllMachines() {
  try {
    await prisma.machinePart.deleteMany({});
    const runs = await prisma.productionRun.findMany({ select: { id: true } });
    const runIds = runs.map((r) => r.id);
    if (runIds.length > 0) {
      await prisma.scanLog.deleteMany({ where: { runId: { in: runIds } } });
      await prisma.productionRun.deleteMany({});
    }
    const count = await prisma.machine.deleteMany({});
    revalidatePath("/");
    return { success: true, count: count.count };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengosongkan data mesin";
    return { success: false, error: message };
  }
}

// 16. Production Planning CRUD Server Actions
export interface ProductionPlanFilters {
  machineId?: number;
  startDate?: string;
  endDate?: string;
}

export async function getProductionPlans(filters?: ProductionPlanFilters | number) {
  try {
    let machineId: number | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (typeof filters === "number") {
      machineId = filters;
    } else if (filters) {
      machineId = filters.machineId;
      startDate = filters.startDate;
      endDate = filters.endDate;
    }

    const where: any = {};
    if (machineId) {
      where.machineId = machineId;
    }

    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T23:59:59.999Z`);
      where.scheduledDate = {
        gte: start,
        lte: end,
      };
    } else if (startDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      where.scheduledDate = {
        gte: start,
      };
    } else if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999Z`);
      where.scheduledDate = {
        lte: end,
      };
    }

    const [plans, users, machineParts] = await Promise.all([
      prisma.productionPlan.findMany({
        where,
        orderBy: [{ scheduledDate: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
        include: {
          machine: true,
          part: {
            include: { pairPart: true },
          },
          runs: {
            take: 1,
            orderBy: { startTime: "desc" },
            include: { scans: { where: { isVoid: false } } },
          },
        },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, employeeId: true },
      }),
      prisma.machinePart.findMany({
        where: { cycleTimeSec: { not: null } },
      }),
    ]);

    const machinePartCtMap = new Map<string, number>();
    machineParts.forEach((mp) => {
      if (mp.cycleTimeSec && mp.cycleTimeSec > 0) {
        machinePartCtMap.set(`${mp.machineId}_${mp.partId}`, mp.cycleTimeSec);
      }
    });

    const planAttrMap = await getPartAttributesMap();
    plans.forEach((pl) => {
      if (pl.part) {
        const attr = planAttrMap.get(pl.part.id);
        (pl.part as any).containerType =
          attr?.containerType || (pl.part as any).containerType || "TROLLY";
        (pl.part as any).customer = attr?.customer ?? (pl.part as any).customer ?? null;
        const overrideCt = machinePartCtMap.get(`${pl.machineId}_${pl.partId}`);
        if (overrideCt) {
          pl.part.cycleTimeSec = overrideCt;
        }
        if (pl.part.pairPart) {
          const pairAttr = planAttrMap.get(pl.part.pairPart.id);
          (pl.part.pairPart as any).containerType =
            pairAttr?.containerType || (pl.part.pairPart as any).containerType || "TROLLY";
          (pl.part.pairPart as any).customer = pairAttr?.customer ?? (pl.part.pairPart as any).customer ?? null;
          const pairOverrideCt = machinePartCtMap.get(`${pl.machineId}_${pl.part.pairPart.id}`);
          if (pairOverrideCt) {
            pl.part.pairPart.cycleTimeSec = pairOverrideCt;
          }
        }
      }
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      success: true,
      data: plans.map((p) => {
        const opId = (p as any).operatorId as number | null | undefined;
        const op = opId ? userMap.get(opId) : null;

        return {
          id: p.id,
          machineId: p.machineId,
          machineCode: p.machine.code,
          partId: p.partId,
          partNo: p.part.partNo,
          partName: p.part.name,
          cycleTimeSec: p.part.cycleTimeSec,
          cavity: p.part.cavity,
          qtyPerTrolly: p.part.qtyPerTrolly,
          targetQty: p.targetQty,
          priority: p.priority,
          status: p.status,
          notes: p.notes,
          moldMode: (p.part as any).pairPartId ? (p.moldMode || "SET") : null,
          pairPart: (p.part as any).pairPart
            ? {
                id: (p.part as any).pairPart.id,
                partNo: (p.part as any).pairPart.partNo,
                name: (p.part as any).pairPart.name,
              }
            : null,
          scheduledDate: p.scheduledDate ? p.scheduledDate.toISOString() : null,
          createdAt: p.createdAt.toISOString(),
          operatorId: opId || null,
          operatorName: op ? op.name : null,
          operatorEmployeeId: op ? op.employeeId : null,
        };
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat rencana produksi";
    return { success: false, error: message, data: [] };
  }
}

export interface CreateProductionPlanInput {
  machineId: number;
  partId: number;
  targetQty: number;
  operatorId?: number | null;
  priority?: number;
  notes?: string;
  scheduledDate?: string;
  moldMode?: string;
}

export async function createProductionPlan(input: CreateProductionPlanInput) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Bagian PPIC / Supervisor / Admin yang dapat membuat rencana produksi." };
    }

    if (!input.targetQty || input.targetQty <= 0) {
      return { success: false, error: "Target kuantiti produksi harus lebih dari 0 pcs." };
    }

    // Tentukan prioritas otomatis jika tidak diisi
    let priority = input.priority;
    if (!priority) {
      const count = await prisma.productionPlan.count({
        where: {
          machineId: input.machineId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      });
      priority = count + 1;
    }

    const scheduledDateObj = input.scheduledDate
      ? new Date(input.scheduledDate)
      : new Date();

    const partObj = await prisma.part.findUnique({ where: { id: input.partId } });
    const isFamilyMold = Boolean(partObj?.pairPartId);

    const planData: any = {
      machineId: input.machineId,
      partId: input.partId,
      targetQty: input.targetQty,
      priority,
      notes: input.notes?.trim() || null,
      scheduledDate: scheduledDateObj,
      status: "PENDING",
      moldMode: isFamilyMold ? (input.moldMode || "SET") : null,
    };

    if (input.operatorId) {
      planData.operatorId = input.operatorId;
    }

    const newPlan = await prisma.productionPlan.create({
      data: planData,
      include: {
        machine: true,
        part: true,
      },
    });

    revalidatePath("/");
    return { success: true, data: newPlan };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal membuat rencana produksi";
    return { success: false, error: message };
  }
}

export interface CreateProductionPlanItemInput {
  partId: number;
  targetQty: number;
  notes?: string;
  moldMode?: string;
}

export interface CreateProductionPlansBatchInput {
  machineId: number;
  operatorId?: number | null;
  scheduledDate?: string;
  items: CreateProductionPlanItemInput[];
}

export async function createProductionPlansBatch(input: CreateProductionPlansBatchInput) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Bagian PPIC / Supervisor / Admin yang dapat membuat rencana produksi." };
    }

    if (!input.machineId) {
      return { success: false, error: "Pilih mesin molding terlebih dahulu." };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Daftar part yang direncanakan tidak boleh kosong." };
    }

    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      if (!it.partId) {
        return { success: false, error: `Part baris #${i + 1} belum dipilih.` };
      }
      if (!it.targetQty || it.targetQty <= 0) {
        return { success: false, error: `Target kuantiti pada baris #${i + 1} harus lebih dari 0 pcs.` };
      }
    }

    const scheduledDateObj = input.scheduledDate
      ? new Date(input.scheduledDate)
      : new Date();

    const count = await prisma.productionPlan.count({
      where: {
        machineId: input.machineId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    const partIds = input.items.map((it) => it.partId);
    const partsMap = new Map<number, any>();
    const foundParts = await prisma.part.findMany({
      where: { id: { in: partIds } },
    });
    foundParts.forEach((p) => partsMap.set(p.id, p));

    const createdPlans = [];

    for (let idx = 0; idx < input.items.length; idx++) {
      const item = input.items[idx];
      const partObj = partsMap.get(item.partId);
      const isFamilyMold = Boolean(partObj?.pairPartId);

      const planData: any = {
        machineId: input.machineId,
        partId: item.partId,
        targetQty: item.targetQty,
        priority: count + idx + 1,
        notes: item.notes?.trim() || null,
        scheduledDate: scheduledDateObj,
        status: "PENDING",
        moldMode: isFamilyMold ? (item.moldMode || "SET") : null,
      };

      if (input.operatorId) {
        planData.operatorId = input.operatorId;
      }

      const newPlan = await prisma.productionPlan.create({
        data: planData,
        include: {
          machine: true,
          part: true,
        },
      });
      createdPlans.push(newPlan);
    }

    revalidatePath("/");
    return { success: true, count: createdPlans.length, data: createdPlans };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal membuat batch rencana produksi";
    return { success: false, error: message };
  }
}

export async function updateProductionPlan(
  id: number,
  data: {
    targetQty?: number;
    priority?: number;
    status?: string;
    operatorId?: number | null;
    notes?: string;
    moldMode?: string;
  }
) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      if (data.status !== undefined || data.priority !== undefined) {
        return { success: false, error: "Akses Ditolak: Hanya Bagian PPIC / Supervisor / Admin yang dapat mengubah status & prioritas rencana produksi." };
      }
    }

    const updateData: any = {
      targetQty: data.targetQty,
      priority: data.priority,
      status: data.status,
      notes: data.notes,
    };

    if (data.moldMode !== undefined) {
      updateData.moldMode = data.moldMode;
    }

    if (data.operatorId !== undefined) {
      updateData.operatorId = data.operatorId;
    }

    const updated = await prisma.productionPlan.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/");
    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengupdate rencana produksi";
    return { success: false, error: message };
  }
}

export async function deleteProductionPlan(id: number) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Bagian PPIC / Supervisor / Admin yang dapat menghapus rencana produksi." };
    }

    await prisma.productionPlan.delete({
      where: { id },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghapus rencana produksi";
    return { success: false, error: message };
  }
}

// 17. Finish Good Stock & Inventory per Part (Perhitungan Real-Time dari Scan Trolly)
export interface FinishGoodStockItem {
  partId: number;
  partNo: string;
  name: string;
  qtyPerTrolly: number;
  cycleTimeSec: number;
  cavity: number;
  totalTrolly: number;
  totalPcs: number;
  todayTrolly: number;
  todayPcs: number;
  lastUpdated: string | null;
  recentScans: Array<{
    id: number;
    kanbanCode: string;
    qty: number;
    scannedAt: string;
    operatorName: string;
    machineCode: string;
  }>;
}

export async function getFinishGoodStock() {
  try {
    const parts = await prisma.part.findMany({
      where: { isActive: true },
      orderBy: { partNo: "asc" },
      include: {
        kanbans: {
          include: {
            scans: {
              where: { isVoid: false },
              orderBy: { scannedAt: "desc" },
              include: {
                scannedBy: true,
                run: {
                  include: { machine: true },
                },
              },
            },
          },
        },
      },
    });

    const stockAttrMap = await getPartAttributesMap();
    parts.forEach((p) => {
      const attr = stockAttrMap.get(p.id);
      (p as any).containerType = attr?.containerType || (p as any).containerType || "TROLLY";
      (p as any).customer = attr?.customer ?? (p as any).customer ?? null;
    });

    // Batas hari ini (00:00:00)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const stockItems: FinishGoodStockItem[] = parts.map((part) => {
      let totalTrolly = 0;
      let totalPcs = 0;
      let todayTrolly = 0;
      let todayPcs = 0;
      let latestScanDate: Date | null = null;
      const allScansList: Array<{
        id: number;
        kanbanCode: string;
        qty: number;
        scannedAt: string;
        operatorName: string;
        machineCode: string;
        dateObj: Date;
      }> = [];

      for (const kanban of part.kanbans) {
        for (const scan of kanban.scans) {
          totalTrolly += 1;
          totalPcs += scan.qty;

          const sDate = new Date(scan.scannedAt);
          if (sDate >= startOfToday) {
            todayTrolly += 1;
            todayPcs += scan.qty;
          }

          if (!latestScanDate || sDate > latestScanDate) {
            latestScanDate = sDate;
          }

          allScansList.push({
            id: scan.id,
            kanbanCode: kanban.code,
            qty: scan.qty,
            scannedAt: sDate.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            operatorName: scan.scannedBy.name,
            machineCode: scan.run.machine.code,
            dateObj: sDate,
          });
        }
      }

      // Ambil 5 scan terakhir
      allScansList.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      const recentScans = allScansList.slice(0, 5).map((s) => ({
        id: s.id,
        kanbanCode: s.kanbanCode,
        qty: s.qty,
        scannedAt: s.scannedAt,
        operatorName: s.operatorName,
        machineCode: s.machineCode,
      }));

      return {
        partId: part.id,
        partNo: part.partNo,
        name: part.name,
        qtyPerTrolly: part.qtyPerTrolly,
        cycleTimeSec: part.cycleTimeSec,
        cavity: part.cavity,
        totalTrolly,
        totalPcs,
        todayTrolly,
        todayPcs,
        lastUpdated: latestScanDate ? latestScanDate.toISOString() : null,
        recentScans,
      };
    });

    return { success: true, data: stockItems };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat stok finish good";
    return { success: false, error: message, data: [] };
  }
}

// -------------------------------------------------------------
// MATRIKS STOK FINISH GOOD BULANAN (IN / OUT PER HARI)
// Format standar pabrik: No | No Part | Nama Part | Next Process | Status (In/Out) | Stok Awal | 1 2..31 | Total In | Total Out | Stok Saat Ini
// -------------------------------------------------------------

export interface MonthlyStockMatrixRow {
  no: number;
  partId: number;
  partNo: string;
  name: string;
  nextProcess: string;
  qtyPerTrolly: number;
  systemPreviousStock: number; // Saldo catatan sistem bulan lalu (buku transaksi)
  initialStock: number; // Stok Awal yang berlaku (hasil opname jika ada penyesuaian)
  isAdjusted?: boolean; // True jika stok awal disesuaikan manual via opname
  adjustmentNotes?: string | null;
  variance: number; // Selisih = initialStock (fisik) - systemPreviousStock (buku)
  nextMonthAdjusted?: boolean; // Apakah di awal bulan berikutnya ada opname
  nextMonthInitialStock?: number;
  nextMonthVariance?: number;
  nextMonthNotes?: string | null;
  inDays: Record<string, number>;
  outDays: Record<string, number>;
  totalIn: number;
  totalOut: number;
  endingStock: number; // Stok Saat Ini = initialStock + totalIn - totalOut
  balance: number; // Alias
}

export interface MonthlyStockMatrixResponse {
  month: number;
  year: number;
  monthName: string;
  dayColumns: string[];
  rows: MonthlyStockMatrixRow[];
  totalsPerDay: {
    in: Record<string, number>;
    out: Record<string, number>;
  };
  grandTotalSystemPreviousStock: number;
  grandTotalInitialStock: number;
  grandTotalVariance: number;
  grandTotalIn: number;
  grandTotalOut: number;
  grandTotalEndingStock: number;
  grandTotalBalance: number;
  adjustedCount: number; // Berapa part yang disesuaikan via opname bulan ini
}

export async function getMonthlyStockMatrix(targetMonth?: number, targetYear?: number) {
  try {
    const now = new Date();
    const month = typeof targetMonth === "number" ? targetMonth : now.getMonth() + 1; // 1-12
    const year = typeof targetYear === "number" ? targetYear : now.getFullYear();

    // Hitung jumlah hari pada bulan bersangkutan (28, 29, 30, atau 31)
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayColumns: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      dayColumns.push(d.toString());
    }

    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);

    // Bulan berikutnya untuk pelacakan adjustment forward
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    const parts = await prisma.part.findMany({
      where: { isActive: true },
      orderBy: { partNo: "asc" },
      include: {
        kanbans: {
          include: {
            scans: {
              where: {
                isVoid: false,
                scannedAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              },
            },
          },
        },
      },
    });

    // Ambil nextProcess untuk setiap part
    const nextProcessMap: Record<number, string> = {};
    try {
      const rawParts = await prisma.part.findMany({
        select: { id: true, nextProcess: true },
      });
      for (const rp of rawParts) {
        nextProcessMap[rp.id] = rp.nextProcess || "PAINTING";
      }
    } catch {
      // Fallback
    }

    // Ambil penyesuaian stok / stok opname (StockAdjustment) untuk bulan ini
    const adjustmentMap = new Map<number, { initialStock: number; notes: string | null }>();
    try {
      const rawAdjs = await prisma.stockAdjustment.findMany({
        where: { year, month },
        select: { partId: true, initialStock: true, notes: true },
      });
      for (const adj of rawAdjs) {
        adjustmentMap.set(adj.partId, {
          initialStock: adj.initialStock || 0,
          notes: adj.notes,
        });
      }
    } catch {
      // Table may be empty
    }

    // Ambil penyesuaian stok bulan berikutnya (untuk melihat jika bulan depan ada opname)
    const nextMonthAdjustmentMap = new Map<number, { initialStock: number; notes: string | null }>();
    try {
      const rawNextAdjs = await prisma.stockAdjustment.findMany({
        where: { year: nextYear, month: nextMonth },
        select: { partId: true, initialStock: true, notes: true },
      });
      for (const adj of rawNextAdjs) {
        nextMonthAdjustmentMap.set(adj.partId, {
          initialStock: adj.initialStock || 0,
          notes: adj.notes,
        });
      }
    } catch {
      // Table may be empty
    }

    // Hitung otomatis carry-over stok awal dari transaksi sebelum bulan ini (buku sistem)
    const priorInMap = new Map<number, number>();
    const priorOutMap = new Map<number, number>();
    try {
      const priorScans = await prisma.scanLog.findMany({
        where: {
          isVoid: false,
          scannedAt: { lt: monthStart },
        },
        select: {
          qty: true,
          kanban: {
            select: { partId: true },
          },
        },
      });
      for (const ps of priorScans) {
        const pId = ps.kanban?.partId;
        if (pId) {
          priorInMap.set(pId, (priorInMap.get(pId) || 0) + ps.qty);
        }
      }

      const priorOuts = await prisma.stockOut.groupBy({
        by: ["partId"],
        _sum: { qty: true },
        where: { outDate: { lt: monthStart } },
      });
      for (const po of priorOuts) {
        priorOutMap.set(po.partId, po._sum.qty || 0);
      }
    } catch {
      // Fallback
    }

    // Ambil data StockOut untuk bulan ini
    const stockOutMap: Record<number, Array<{ qty: number; day: string }>> = {};
    try {
      const rawOuts = await prisma.stockOut.findMany({
        where: {
          outDate: { gte: monthStart, lte: monthEnd },
        },
        select: { partId: true, qty: true, outDate: true },
      });
      for (const ro of rawOuts) {
        const d = new Date(ro.outDate);
        const dayStr = d.getDate().toString();
        if (!stockOutMap[ro.partId]) stockOutMap[ro.partId] = [];
        stockOutMap[ro.partId].push({ qty: ro.qty, day: dayStr });
      }
    } catch {
      // Fallback
    }

    const totalsInPerDay: Record<string, number> = {};
    const totalsOutPerDay: Record<string, number> = {};
    for (const d of dayColumns) {
      totalsInPerDay[d] = 0;
      totalsOutPerDay[d] = 0;
    }

    let grandTotalSystemPreviousStock = 0;
    let grandTotalInitialStock = 0;
    let grandTotalVariance = 0;
    let grandTotalIn = 0;
    let grandTotalOut = 0;
    let grandTotalEndingStock = 0;
    let adjustedCount = 0;

    const rows: MonthlyStockMatrixRow[] = parts.map((part, index) => {
      // Saldo akhir buku sistem bulan lalu
      const priorIn = priorInMap.get(part.id) || 0;
      const priorOut = priorOutMap.get(part.id) || 0;
      const systemPreviousStock = Math.max(0, priorIn - priorOut);

      // Tentukan Stok Awal yang berlaku bulan ini
      let initialStock = systemPreviousStock;
      let isAdjusted = false;
      let adjustmentNotes: string | null = null;
      let variance = 0;

      if (adjustmentMap.has(part.id)) {
        const adj = adjustmentMap.get(part.id)!;
        initialStock = adj.initialStock;
        isAdjusted = true;
        adjustmentNotes = adj.notes;
        variance = initialStock - systemPreviousStock;
        adjustedCount++;
      }

      grandTotalSystemPreviousStock += systemPreviousStock;
      grandTotalInitialStock += initialStock;
      grandTotalVariance += variance;

      const inDays: Record<string, number> = {};
      const outDays: Record<string, number> = {};
      for (const d of dayColumns) {
        inDays[d] = 0;
        outDays[d] = 0;
      }

      // Agregasi scan kanban (In)
      for (const kanban of part.kanbans) {
        for (const scan of kanban.scans) {
          const sDate = new Date(scan.scannedAt);
          const dayStr = sDate.getDate().toString();
          if (inDays[dayStr] !== undefined) {
            inDays[dayStr] += scan.qty;
          }
        }
      }

      // Agregasi stock out (Out)
      const partOuts = stockOutMap[part.id] || [];
      for (const po of partOuts) {
        if (outDays[po.day] !== undefined) {
          outDays[po.day] += po.qty;
        }
      }

      let totalIn = 0;
      let totalOut = 0;
      for (const d of dayColumns) {
        totalIn += inDays[d];
        totalOut += outDays[d];
        totalsInPerDay[d] += inDays[d];
        totalsOutPerDay[d] += outDays[d];
      }

      grandTotalIn += totalIn;
      grandTotalOut += totalOut;

      const endingStock = initialStock + totalIn - totalOut;
      grandTotalEndingStock += endingStock;

      // Cek apakah di awal bulan berikutnya ada opname
      let nextMonthAdjusted = false;
      let nextMonthInitialStock: number | undefined;
      let nextMonthVariance: number | undefined;
      let nextMonthNotes: string | null = null;

      if (nextMonthAdjustmentMap.has(part.id)) {
        const nAdj = nextMonthAdjustmentMap.get(part.id)!;
        nextMonthAdjusted = true;
        nextMonthInitialStock = nAdj.initialStock;
        nextMonthNotes = nAdj.notes;
        nextMonthVariance = nAdj.initialStock - endingStock;
      }

      const nextProc = nextProcessMap[part.id] || "PAINTING";

      return {
        no: index + 1,
        partId: part.id,
        partNo: part.partNo,
        name: part.name,
        nextProcess: nextProc,
        qtyPerTrolly: part.qtyPerTrolly,
        systemPreviousStock,
        initialStock,
        isAdjusted,
        adjustmentNotes,
        variance,
        nextMonthAdjusted,
        nextMonthInitialStock,
        nextMonthVariance,
        nextMonthNotes,
        inDays,
        outDays,
        totalIn,
        totalOut,
        endingStock,
        balance: endingStock,
      };
    });

    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const result: MonthlyStockMatrixResponse = {
      month,
      year,
      monthName: monthNames[month - 1] || `Bulan ${month}`,
      dayColumns,
      rows,
      totalsPerDay: {
        in: totalsInPerDay,
        out: totalsOutPerDay,
      },
      grandTotalSystemPreviousStock,
      grandTotalInitialStock,
      grandTotalVariance,
      grandTotalIn,
      grandTotalOut,
      grandTotalEndingStock,
      grandTotalBalance: grandTotalEndingStock,
      adjustedCount,
    };

    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat matriks stok bulanan";
    return { success: false, error: message };
  }
}

export async function saveStockAdjustment(input: {
  partId: number;
  year: number;
  month: number;
  initialStock: number;
  notes?: string;
  adjustedBy?: string;
}) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Bagian PPIC / Gudang / Supervisor yang dapat menyesuaikan stok fisik." };
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "StockAdjustment" ("partId", "year", "month", "initialStock", "notes", "adjustedBy")
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT("partId", "year", "month")
       DO UPDATE SET "initialStock" = excluded."initialStock", "notes" = excluded."notes", "adjustedBy" = excluded."adjustedBy", "updatedAt" = CURRENT_TIMESTAMP`,
      input.partId,
      input.year,
      input.month,
      Math.max(0, input.initialStock || 0),
      input.notes || null,
      input.adjustedBy || "Planner/Supervisor"
    );

    await prisma.auditLog.create({
      data: {
        entity: "StockAdjustment",
        entityId: input.partId,
        action: "SAVE_STOCK_ADJUSTMENT",
        newValue: JSON.stringify(input),
        userId: 1,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan penyesuaian stok";
    return { success: false, error: message };
  }
}

export async function recordStockOut(input: {
  partId: number;
  qty: number;
  outDate?: string;
  destination?: string;
  notes?: string;
}) {
  try {
    const session = await getSession();
    if (session && session.role === "OPERATOR") {
      return { success: false, error: "Akses Ditolak: Hanya Bagian PPIC / Gudang / Supervisor yang dapat mencatat pengeluaran stok." };
    }

    const dateToUse = input.outDate ? new Date(input.outDate) : new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StockOut" ("partId", "qty", "outDate", "destination", "notes") VALUES (?, ?, ?, ?, ?)`,
      input.partId,
      input.qty,
      dateToUse.toISOString(),
      input.destination || "PAINTING",
      input.notes || null
    );

    await prisma.auditLog.create({
      data: {
        entity: "StockOut",
        entityId: input.partId,
        action: "RECORD_STOCK_OUT",
        newValue: JSON.stringify(input),
        userId: 1,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mencatat pengeluaran stok";
    return { success: false, error: message };
  }
}

export async function updatePartNextProcess(partId: number, nextProcess: string) {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Part" SET "nextProcess" = ? WHERE "id" = ?`,
      nextProcess,
      partId
    );
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui proses lanjutan part";
    return { success: false, error: message };
  }
}

// -------------------------------------------------------------
// 18B. OUTBOUND TROLLEY & PDA CART MANAGEMENT (Next Process)
// -------------------------------------------------------------

export interface OutboundTrolleyItem {
  scanLogId: number;
  lotNumber: string;
  qty: number;
  scannedAt: string;
  partId: number;
  partNo: string;
  partName: string;
  nextProcess: string;
  machineCode: string;
  shift: string;
  operatorName: string;
  isIssuedOut: boolean;
  issuedAt?: string | null;
  issuedLocation?: string | null;
  isDeptMismatch?: boolean;
  mismatchWarning?: string;
}

export interface OutboundRecapItem {
  id: number;
  batchNo: string | null;
  outDate: string;
  destination: string | null;
  qty: number;
  notes: string | null;
  lotNumber: string | null;
  part: {
    id: number;
    partNo: string;
    name: string;
    nextProcess: string | null;
  };
  operator: {
    id: number;
    name: string;
    employeeId: string;
  } | null;
  scanLog: {
    id: number;
    lotNumber: string | null;
    scannedAt: string;
    run: {
      machine: {
        code: string;
      };
      shift: string | null;
    };
  } | null;
}

/**
 * Mencari trolly yang di-scan untuk pengeluaran (Outbound PDA)
 */
export async function lookupTrolleyForOutbound(
  scannedCode: string,
  currentDept?: string
): Promise<{ success: boolean; data?: OutboundTrolleyItem; error?: string }> {
  try {
    const raw = scannedCode.trim();
    if (!raw) {
      return { success: false, error: "Kode scan tidak boleh kosong." };
    }

    // Ekstraksi jika format payload QR unik: "KB-04143-0K020#LOT-20261021-Shift1-T01#142015"
    let targetLotNumber: string | null = null;
    let targetKanbanCode: string | null = null;

    if (raw.includes("#")) {
      const parts = raw.split("#");
      targetKanbanCode = parts[0]?.trim() || null;
      targetLotNumber = parts[1]?.trim() || null;
    } else if (raw.toUpperCase().startsWith("LOT-") || raw.toUpperCase().startsWith("L-")) {
      targetLotNumber = raw.trim();
    } else {
      // Barcode biasa / kanban code / lot
      targetLotNumber = raw;
      targetKanbanCode = raw;
    }

    // Cari di ScanLog
    let scanLog = null;

    if (targetLotNumber) {
      scanLog = await prisma.scanLog.findFirst({
        where: {
          lotNumber: { equals: targetLotNumber },
          isVoid: false,
        },
        include: {
          kanban: { include: { part: true } },
          run: { include: { machine: true, part: true, operator: true } },
          scannedBy: true,
        },
        orderBy: { scannedAt: "desc" },
      });
    }

    // Jika belum ketemu dan ada kanban code, cari scanLog terbaru untuk kanban tersebut yang belum out
    if (!scanLog && targetKanbanCode) {
      scanLog = await prisma.scanLog.findFirst({
        where: {
          kanban: { code: targetKanbanCode },
          isVoid: false,
          isIssuedOut: false,
        },
        include: {
          kanban: { include: { part: true } },
          run: { include: { machine: true, part: true, operator: true } },
          scannedBy: true,
        },
        orderBy: { scannedAt: "desc" },
      });
    }

    if (!scanLog) {
      return {
        success: false,
        error: `Trolly dengan barcode/lot "${raw}" tidak ditemukan di sistem molding atau data scan telah dibatalkan.`,
      };
    }

    // Cek apakah sudah pernah di-out
    if (scanLog.isIssuedOut) {
      const issuedDateStr = scanLog.issuedAt
        ? new Date(scanLog.issuedAt).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
      return {
        success: false,
        error: `Trolly ${scanLog.lotNumber || ""} SUDAH PERNAH DIKELUARKAN ke ${scanLog.issuedLocation || "Next Process"} pada ${issuedDateStr}.`,
      };
    }

    const part = scanLog.kanban?.part || scanLog.run?.part;
    if (!part) {
      return { success: false, error: "Data part untuk trolly ini tidak valid." };
    }

    const partNextProcess = (part.nextProcess || "PAINTING 1").trim().toUpperCase();
    const cleanCurrentDept = currentDept ? currentDept.trim().toUpperCase() : "";

    let isDeptMismatch = false;
    let mismatchWarning: string | undefined;

    if (cleanCurrentDept && cleanCurrentDept !== "ALL" && cleanCurrentDept !== partNextProcess) {
      isDeptMismatch = true;
      mismatchWarning = `Perhatian: Part "${part.partNo}" memiliki alur tujuan "${partNextProcess}", sedangkan departemen Anda saat ini adalah "${cleanCurrentDept}".`;
    }

    const item: OutboundTrolleyItem = {
      scanLogId: scanLog.id,
      lotNumber: scanLog.lotNumber || `LOT-${scanLog.id}`,
      qty: scanLog.qty,
      scannedAt: scanLog.scannedAt.toISOString(),
      partId: part.id,
      partNo: part.partNo,
      partName: part.name,
      nextProcess: partNextProcess,
      machineCode: scanLog.run?.machine?.code || "-",
      shift: scanLog.run?.shift || "Shift 1",
      operatorName: scanLog.scannedBy?.name || scanLog.run?.operator?.name || "Operator",
      isIssuedOut: false,
      isDeptMismatch,
      mismatchWarning,
    };

    return { success: true, data: item };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mencari data trolly";
    return { success: false, error: message };
  }
}

/**
 * Checkout seluruh trolly dalam keranjang supermarket PDA
 */
export async function checkoutOutboundCart(input: {
  items: Array<{ scanLogId: number; qty: number; lotNumber?: string }>;
  destination: string;
  operatorId?: number;
  notes?: string;
}): Promise<{
  success: boolean;
  data?: { batchNo: string; totalTrolly: number; totalQty: number };
  error?: string;
}> {
  try {
    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Keranjang masih kosong! Silakan scan minimal 1 trolly." };
    }
    if (!input.destination || !input.destination.trim()) {
      return { success: false, error: "Departemen tujuan pengeluaran wajib dipilih." };
    }

    const session = await getSession();
    const effectiveOperatorId = input.operatorId || session?.id || 1;
    const destination = input.destination.trim().toUpperCase();

    // Generate batch number: OUT-YYYYMMDD-HHMMSS
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const batchNo = `OUT-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    let totalQty = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        // Cek kembali status trolly
        const scanLog = await tx.scanLog.findUnique({
          where: { id: item.scanLogId },
          include: { kanban: true },
        });

        if (!scanLog) {
          throw new Error(`Trolly ID #${item.scanLogId} tidak ditemukan.`);
        }

        if (scanLog.isIssuedOut) {
          throw new Error(`Trolly ${scanLog.lotNumber || item.scanLogId} sudah pernah dikeluarkan sebelumnya.`);
        }

        totalQty += item.qty;

        // 1. Update ScanLog
        await tx.scanLog.update({
          where: { id: item.scanLogId },
          data: {
            isIssuedOut: true,
            issuedAt: now,
            issuedLocation: destination,
            issuedById: effectiveOperatorId,
            stockOutBatchNo: batchNo,
            receivedAt: now,
            receivedLocation: destination,
            receivedNotes: input.notes ? input.notes.trim() : `Scan Outbound PDA (${destination})`,
          },
        });

        // 2. Insert ke StockOut
        await tx.stockOut.create({
          data: {
            partId: scanLog.kanban.partId,
            qty: item.qty,
            outDate: now,
            destination: destination,
            notes: input.notes ? input.notes.trim() : `Trolly ${scanLog.lotNumber || ""}`,
            batchNo: batchNo,
            lotNumber: scanLog.lotNumber,
            scanLogId: scanLog.id,
            operatorId: effectiveOperatorId,
          },
        });
      }

      // 3. Catat AuditLog
      await tx.auditLog.create({
        data: {
          entity: "StockOut",
          entityId: input.items[0].scanLogId,
          action: "CHECKOUT_OUTBOUND_CART",
          newValue: JSON.stringify({
            batchNo,
            destination,
            trolleyCount: input.items.length,
            totalQty,
            operatorId: effectiveOperatorId,
          }),
          userId: effectiveOperatorId,
        },
      });
    });

    revalidatePath("/");
    return {
      success: true,
      data: {
        batchNo,
        totalTrolly: input.items.length,
        totalQty,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses pengeluaran keranjang";
    return { success: false, error: message };
  }
}

/**
 * Mengambil histori / rekapitulasi data pengeluaran barang (Outbound Dispatch Recap)
 */
export async function getOutboundRecapReports(filter?: {
  startDate?: string;
  endDate?: string;
  department?: string;
  partId?: number;
  search?: string;
}): Promise<{ success: boolean; data?: OutboundRecapItem[]; error?: string }> {
  try {
    const whereClause: any = {};

    if (filter?.department && filter.department !== "ALL") {
      whereClause.destination = filter.department.trim().toUpperCase();
    }

    if (filter?.partId) {
      whereClause.partId = filter.partId;
    }

    if (filter?.startDate || filter?.endDate) {
      whereClause.outDate = {};
      if (filter.startDate) {
        const start = new Date(filter.startDate);
        start.setHours(0, 0, 0, 0);
        whereClause.outDate.gte = start;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.outDate.lte = end;
      }
    }

    const records = await prisma.stockOut.findMany({
      where: whereClause,
      include: {
        part: {
          select: { id: true, partNo: true, name: true, nextProcess: true },
        },
        operator: {
          select: { id: true, name: true, employeeId: true },
        },
        scanLog: {
          select: {
            id: true,
            lotNumber: true,
            scannedAt: true,
            run: {
              select: {
                machine: { select: { code: true } },
                shift: true,
              },
            },
          },
        },
      },
      orderBy: { outDate: "desc" },
      take: 300,
    });

    const mapped: OutboundRecapItem[] = records.map((r) => ({
      id: r.id,
      batchNo: r.batchNo,
      outDate: r.outDate.toISOString(),
      destination: r.destination,
      qty: r.qty,
      notes: r.notes,
      lotNumber: r.lotNumber || r.scanLog?.lotNumber || null,
      part: r.part,
      operator: r.operator,
      scanLog: r.scanLog
        ? {
            id: r.scanLog.id,
            lotNumber: r.scanLog.lotNumber,
            scannedAt: r.scanLog.scannedAt.toISOString(),
            run: {
              machine: { code: r.scanLog.run?.machine?.code || "-" },
              shift: r.scanLog.run?.shift || "-",
            },
          }
        : null,
    }));

    return { success: true, data: mapped };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengambil rekap pengeluaran";
    return { success: false, error: message };
  }
}

// -------------------------------------------------------------
// 19. USER & OPERATOR MANAGEMENT (Admin MMS)
// -------------------------------------------------------------

export async function createUser(data: {
  employeeId: string;
  name: string;
  role: string;
  pin?: string;
}) {
  try {
    const session = await getSession();
    if (session && session.role !== "ADMIN") {
      return { success: false, error: "Akses Ditolak: Hanya Administrator yang berwenang menambahkan user." };
    }

    const cleanEmployeeId = data.employeeId.trim().toUpperCase();
    const cleanName = data.name.trim();
    const cleanRole = data.role.trim().toUpperCase();
    const pin = data.pin?.trim() || "1234";

    if (!cleanEmployeeId) {
      return { success: false, error: "ID Karyawan / NIK tidak boleh kosong." };
    }
    if (!cleanName) {
      return { success: false, error: "Nama karyawan tidak boleh kosong." };
    }

    const existing = await prisma.user.findUnique({
      where: { employeeId: cleanEmployeeId },
    });
    if (existing) {
      return { success: false, error: `Karyawan dengan NIK "${cleanEmployeeId}" sudah terdaftar.` };
    }

    const newUser = await prisma.user.create({
      data: {
        employeeId: cleanEmployeeId,
        name: cleanName,
        role: cleanRole,
        pinHash: pin,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: "User",
        entityId: newUser.id,
        action: "CREATE_USER",
        newValue: JSON.stringify({ employeeId: cleanEmployeeId, name: cleanName, role: cleanRole }),
        userId: session?.id || 1,
      },
    });

    revalidatePath("/");
    return { success: true, data: newUser };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menambahkan user baru";
    return { success: false, error: message };
  }
}

export async function updateUser(
  id: number,
  data: {
    name?: string;
    role?: string;
    pin?: string;
    isActive?: boolean;
  }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "ADMIN") {
      return { success: false, error: "Akses Ditolak: Hanya Administrator yang berwenang mengubah data user." };
    }

    const updatePayload: any = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.role !== undefined) updatePayload.role = data.role.trim().toUpperCase();
    if (data.pin !== undefined && data.pin.trim() !== "") updatePayload.pinHash = data.pin.trim();
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    const updated = await prisma.user.update({
      where: { id },
      data: updatePayload,
    });

    await prisma.auditLog.create({
      data: {
        entity: "User",
        entityId: id,
        action: "UPDATE_USER",
        newValue: JSON.stringify(updatePayload),
        userId: session?.id || 1,
      },
    });

    revalidatePath("/");
    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui data user";
    return { success: false, error: message };
  }
}

export async function deleteUser(id: number) {
  try {
    const session = await getSession();
    if (session && session.role !== "ADMIN") {
      return { success: false, error: "Akses Ditolak: Hanya Administrator yang berwenang menghapus user." };
    }

    if (session && session.id === id) {
      return { success: false, error: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan." };
    }

    // Cek relasi
    const [runCount, scanCount, planCount] = await Promise.all([
      prisma.productionRun.count({ where: { operatorId: id } }),
      prisma.scanLog.count({ where: { scannedById: id } }),
      prisma.productionPlan.count({ where: { operatorId: id } }),
    ]);

    if (runCount > 0 || scanCount > 0 || planCount > 0) {
      // Soft-delete agar riwayat traceability tetap utuh
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      revalidatePath("/");
      return {
        success: true,
        message: "Karyawan memiliki riwayat data produksi/scan. Akun telah dinonaktifkan (soft-delete) untuk menjaga integritas data.",
      };
    }

    await prisma.user.delete({
      where: { id },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghapus user";
    return { success: false, error: message };
  }
}

// ==========================================
// TRACEABILITY ACTIONS (QR CODE & LOT TRACKING)
// ==========================================

export interface TraceabilityItem {
  id: number;
  lotNumber: string;
  trolleyNumber: number;
  scannedAt: string;
  qty: number;
  isVoid: boolean;
  voidReason?: string | null;
  receivedAt?: string | null;
  receivedLocation?: string | null;
  receivedNotes?: string | null;
  part: {
    id: number;
    partNo: string;
    name: string;
    model?: string | null;
    cycleTimeSec: number;
    cavity: number;
    qtyPerTrolly: number;
    nextProcess?: string | null;
  };
  machine: {
    id: number;
    code: string;
    name?: string | null;
    model?: string | null;
    tonnage: number;
  };
  operator: {
    id: number;
    name: string;
    employeeId: string;
    role: string;
  };
  run: {
    id: number;
    shift?: string | null;
    status: string;
    startTime: string;
    stopTime?: string | null;
    remainderQty: number;
    qtyReject: number;
    notes?: string | null;
    stopReason?: {
      category: string;
      reason: string;
    } | null;
    rejects: Array<{
      defectCode: string;
      defectName: string;
      qty: number;
    }>;
  };
  kanban: {
    id: number;
    code: string;
  };
}

function mapScanLogToTraceabilityItem(scan: any, fallbackTrolleyNum = 1): TraceabilityItem {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const now = new Date(scan.scannedAt);
  const yyyy = now.getFullYear();
  const yy = String(yyyy).slice(-2);
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const shiftStr = scan.run?.shift || "Shift 1";
  const shiftMatch = shiftStr.match(/\d+/);
  const shiftCode = shiftMatch ? `S${shiftMatch[0]}` : shiftStr.replace(/\s+/g, "");
  const machineCode = (scan.run?.machine?.code || "").trim().replace(/\s+/g, "");

  // Fallback lot number if older record didn't store it
  const lotNumber =
    scan.lotNumber ||
    (machineCode
      ? `L-${machineCode}-${yy}${mm}${dd}-${shiftCode}-T${pad(fallbackTrolleyNum)}`
      : `LOT-${yyyy}${mm}${dd}-${shiftCode}-T${pad(fallbackTrolleyNum)}`);

  return {
    id: scan.id,
    lotNumber,
    trolleyNumber: fallbackTrolleyNum,
    scannedAt: scan.scannedAt.toISOString(),
    qty: scan.qty,
    isVoid: scan.isVoid,
    voidReason: scan.voidReason,
    receivedAt: scan.receivedAt ? scan.receivedAt.toISOString() : null,
    receivedLocation: scan.receivedLocation || null,
    receivedNotes: scan.receivedNotes || null,
    part: {
      id: scan.run.part.id,
      partNo: scan.run.part.partNo,
      name: scan.run.part.name,
      model: scan.run.part.model,
      cycleTimeSec: scan.run.part.cycleTimeSec,
      cavity: scan.run.part.cavity,
      qtyPerTrolly: scan.run.part.qtyPerTrolly,
      nextProcess: scan.run.part.nextProcess || "PAINTING",
    },
    machine: {
      id: scan.run.machine.id,
      code: scan.run.machine.code,
      name: scan.run.machine.name,
      model: scan.run.machine.model,
      tonnage: scan.run.machine.tonnage,
    },
    operator: {
      id: scan.scannedBy.id,
      name: scan.scannedBy.name,
      employeeId: scan.scannedBy.employeeId,
      role: scan.scannedBy.role,
    },
    run: {
      id: scan.run.id,
      shift: scan.run.shift,
      status: scan.run.status,
      startTime: scan.run.startTime.toISOString(),
      stopTime: scan.run.stopTime ? scan.run.stopTime.toISOString() : null,
      remainderQty: scan.run.remainderQty,
      qtyReject: scan.run.qtyReject,
      notes: scan.run.notes,
      stopReason: scan.run.stopReason
        ? {
            category: scan.run.stopReason.category,
            reason: scan.run.stopReason.reason,
          }
        : null,
      rejects: (scan.run.rejects || []).map((r: any) => ({
        defectCode: r.defectType?.code || "NG",
        defectName: r.defectType?.name || "Reject",
        qty: r.qty,
      })),
    },
    kanban: {
      id: scan.kanban.id,
      code: scan.kanban.code,
    },
  };
}

/**
 * Cari riwayat Traceability berdasarkan scan QR Code atau No. Lot
 */
export async function searchTraceability(rawQuery: string): Promise<{
  success: boolean;
  data?: TraceabilityItem[];
  error?: string;
}> {
  try {
    const query = rawQuery.trim();
    if (!query) {
      return { success: false, error: "Masukkan Nomor Lot atau Scan QR Code terlebih dahulu." };
    }

    // Ekstrak informasi jika payload QR Code gabungan: KB-7415A703#L-MC01-261015-S1-T01#081530
    const parts = query.split(/[#/|]/);
    const kanbanCandidate = parts[0]?.trim();
    const lotCandidate = parts.find(
      (p) => p.toUpperCase().startsWith("LOT-") || p.toUpperCase().startsWith("L-")
    )?.trim();

    const searchConditions: any[] = [];

    if (lotCandidate) {
      searchConditions.push({ lotNumber: { equals: lotCandidate } });
      searchConditions.push({ lotNumber: { contains: lotCandidate } });
    }

    if (query.toUpperCase().startsWith("LOT-") || query.toUpperCase().startsWith("L-")) {
      searchConditions.push({ lotNumber: { equals: query } });
      searchConditions.push({ lotNumber: { contains: query } });
    }

    if (kanbanCandidate) {
      searchConditions.push({ kanban: { code: { equals: kanbanCandidate } } });
      searchConditions.push({ run: { part: { partNo: { equals: kanbanCandidate } } } });
    }

    // Default match query string against lot, kanban code, or partNo
    searchConditions.push({ lotNumber: { contains: query } });
    searchConditions.push({ kanban: { code: { contains: query } } });
    searchConditions.push({ run: { part: { partNo: { contains: query } } } });

    const scans = await prisma.scanLog.findMany({
      where: {
        OR: searchConditions,
      },
      include: {
        kanban: true,
        scannedBy: true,
        run: {
          include: {
            part: true,
            machine: true,
            operator: true,
            stopReason: true,
            rejects: {
              include: {
                defectType: true,
              },
            },
          },
        },
      },
      orderBy: {
        scannedAt: "desc",
      },
      take: 25,
    });

    if (!scans || scans.length === 0) {
      return {
        success: false,
        error: `Data lot tidak ditemukan untuk pencarian "${query}". Pastikan kode QR atau No. Lot sesuai.`,
      };
    }

    const items = scans.map((s, idx) => mapScanLogToTraceabilityItem(s, scans.length - idx));
    return { success: true, data: items };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mencari data traceability";
    return { success: false, error: message };
  }
}

export interface GetTraceabilityLogsFilter {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  machineId?: number;
  isVoid?: boolean;
}

export interface TraceabilityLogsResult {
  success: boolean;
  data?: TraceabilityItem[];
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

/**
 * Mengambil daftar trolly scan dengan filter tanggal, pencarian, dan indexing paginasi
 */
export async function getRecentTraceabilityLogs(
  param?: number | GetTraceabilityLogsFilter
): Promise<TraceabilityLogsResult> {
  try {
    let page = 1;
    let pageSize = 15;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let search: string | undefined;
    let machineId: number | undefined;
    let isVoid: boolean | undefined = false;

    if (typeof param === "number") {
      pageSize = param;
    } else if (param && typeof param === "object") {
      if (param.page && param.page > 0) page = param.page;
      if (param.pageSize && param.pageSize > 0) pageSize = param.pageSize;
      startDate = param.startDate;
      endDate = param.endDate;
      search = param.search;
      machineId = param.machineId;
      if (param.isVoid !== undefined) isVoid = param.isVoid;
    }

    const where: any = {};
    if (isVoid !== undefined) {
      where.isVoid = isVoid;
    }

    // Filter tanggal berdasarkan scannedAt (menggunakan batas awal dan akhir hari)
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        const parts = startDate.split("-");
        if (parts.length === 3) {
          dateFilter.gte = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
        }
      }
      if (endDate) {
        const parts = endDate.split("-");
        if (parts.length === 3) {
          dateFilter.lte = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        where.scannedAt = dateFilter;
      }
    }

    // Filter mesin jika dipilih
    if (machineId) {
      where.run = { ...(where.run || {}), machineId };
    }

    // Pencarian kata kunci (lotNumber, kanban code, partNo, part name, operator name)
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { lotNumber: { contains: q } },
        { kanban: { code: { contains: q } } },
        { run: { part: { partNo: { contains: q } } } },
        { run: { part: { name: { contains: q } } } },
        { scannedBy: { name: { contains: q } } },
      ];
    }

    // Hitung total data yang cocok dengan indexing database
    const total = await prisma.scanLog.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Ambil hanya data sesuai halaman yang diperlukan (skip & take indexing)
    const skip = (page - 1) * pageSize;
    const scans = await prisma.scanLog.findMany({
      where,
      include: {
        kanban: true,
        scannedBy: true,
        run: {
          include: {
            part: true,
            machine: true,
            operator: true,
            stopReason: true,
            rejects: {
              include: {
                defectType: true,
              },
            },
          },
        },
      },
      orderBy: {
        scannedAt: "desc",
      },
      skip,
      take: pageSize,
    });

    const items = scans.map((s, idx) => mapScanLogToTraceabilityItem(s, total - (skip + idx)));
    return {
      success: true,
      data: items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengambil log scan";
    return { success: false, error: message };
  }
}

/**
 * Konfirmasi penerimaan trolly di stasiun lanjutan (Plating / Painting / Gudang FG)
 */
export async function confirmTraceabilityReceiving(
  scanId: number,
  location: string,
  notes?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const session = await getSession();
    const updated = await prisma.scanLog.update({
      where: { id: scanId },
      data: {
        receivedAt: new Date(),
        receivedLocation: location,
        receivedNotes: notes ? notes.trim() : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: "ScanLog",
        entityId: scanId,
        action: "CONFIRM_RECEIVE",
        newValue: JSON.stringify({
          receivedLocation: location,
          receivedNotes: notes,
          confirmedBy: session?.name || "System",
        }),
        userId: session?.id || 1,
      },
    });

    revalidatePath("/");
    return { success: true, data: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengonfirmasi penerimaan";
    return { success: false, error: message };
  }
}

// 21. Daily Machine Report (FO/MLD/009 Rev.08 Standard Format)
export interface DailyMachineReportData {
  machine: {
    id: number;
    code: string;
    model: string | null;
    tonnage: number;
  };
  dateStr: string;
  dateIso: string;
  shift: string;
  operators: string[];
  parts: Array<{
    no: number;
    partNo: string;
    partName: string;
    qty: number;
    cycleTime: number;
    cavity: number;
    waktuJam: number;
    material: string;
    settingAwal: string;
    settingAkhir: string;
    settingTry: string;
    totalWaktu: number;
    stopJam: number;
    stopMinutes: number;
    partOk: number;
    suteShort: number;
    silver: number;
    short: number;
    weld: number;
    cekung: number;
    bendaAsing: number;
    scratch: number;
    buang: number;
    repair: number;
  }>;
  hourly: Record<string, {
    hour: number;
    runMinutes: number;
    stopMinutes: number;
    delayMinutes: number;
    delaySymbol: string;
    delayReason?: string;
    stopSymbol: string;
    stopReason: string;
    checkedQty: number;
    segments?: Array<{
      type: "RUN" | "STOP" | "DELAY";
      startMin: number;
      endMin: number;
    }>;
    ng: {
      suteShort: number;
      silver: number;
      short: number;
      weld: number;
      cekung: number;
      bendaAsing: number;
      scratch: number;
    };
    inspector?: {
      id?: number;
      employeeId?: string;
      fullName: string;
      shortName: string;
    };
  }>;
  availableOperators?: Array<{
    id: number;
    employeeId: string;
    name: string;
    shortName: string;
    role: string;
  }>;
  inspectors?: {
    inspector1?: string;
    inspector2?: string;
  };
  leader?: string;
  deptHead?: string;
  abnormalNotes: string;
  formCode: string;
}

export async function getDailyMachineReportData(
  machineId: number,
  targetDateIso?: string
): Promise<{ success: boolean; error?: string; data?: DailyMachineReportData }> {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: { parts: { include: { part: true } } },
    });
    if (!machine) {
      return { success: false, error: "Mesin tidak ditemukan" };
    }

    // Determine target date window (Local timezone WIB)
    let startOfDay: Date;
    let endOfDay: Date;
    let dateIso: string;
    let dateStrFormatted: string;

    const idMonths = [
      "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
      "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
    ];

    if (targetDateIso) {
      const parts = targetDateIso.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      startOfDay = new Date(y, m, d, 0, 0, 0, 0);
      endOfDay = new Date(y, m, d, 23, 59, 59, 999);
      dateIso = targetDateIso;
      dateStrFormatted = `${String(d).padStart(2, "0")}/${idMonths[m]}/ ${y}`;
    } else {
      const now = new Date();
      startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      dateIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      dateStrFormatted = `${String(now.getDate()).padStart(2, "0")}/${idMonths[now.getMonth()]}/ ${now.getFullYear()}`;
    }

    // Query runs on this machine for this date
    const [runs, machinePlans, machineParts] = await Promise.all([
      prisma.productionRun.findMany({
        where: {
          machineId,
          startTime: { lte: endOfDay },
          OR: [
            { stopTime: null },
            { stopTime: { gte: startOfDay } },
          ],
        },
        include: {
          part: {
            include: {
              pairPart: true,
            },
          },
          operator: true,
          stopReason: true,
          plan: true,
          scans: {
            where: { isVoid: false },
            include: { kanban: { include: { part: true } } },
            orderBy: { scannedAt: "asc" },
          },
          rejects: {
            include: { defectType: true },
          },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.productionPlan.findMany({
        where: {
          machineId,
        },
        include: { part: { include: { pairPart: true } } },
        orderBy: { priority: "asc" },
      }),
      prisma.machinePart.findMany({
        where: { machineId, cycleTimeSec: { not: null } },
      }),
    ]);

    const machinePartCtMap = new Map<number, number>();
    machineParts.forEach((mp) => {
      if (mp.cycleTimeSec && mp.cycleTimeSec > 0) {
        machinePartCtMap.set(mp.partId, mp.cycleTimeSec);
      }
    });

    // Terapkan override CT spesifik mesin ini pada part
    runs.forEach((r) => {
      if (r.part) {
        const ct = machinePartCtMap.get(r.part.id);
        if (ct) r.part.cycleTimeSec = ct;
        if (r.part.pairPart) {
          const pairCt = machinePartCtMap.get(r.part.pairPart.id);
          if (pairCt) r.part.pairPart.cycleTimeSec = pairCt;
        }
      }
    });
    machinePlans.forEach((p) => {
      if (p.part) {
        const ct = machinePartCtMap.get(p.part.id);
        if (ct) p.part.cycleTimeSec = ct;
        if (p.part.pairPart) {
          const pairCt = machinePartCtMap.get(p.part.pairPart.id);
          if (pairCt) p.part.pairPart.cycleTimeSec = pairCt;
        }
      }
    });

    const operatorsSet = new Set<string>();
    let primaryShift = "Shift 1";
    const abnormalNotesArr: string[] = [];

    // Weekday Shift 1 Setup (07:30 WIB) logic:
    // Pada hari kerja (Senin - Jumat), jam mulai kerja adalah 07:30.
    // Waktu dari 07:30 hingga operator menekan START produksi dihitung sebagai Waktu Setting Awal / Pemanasan (Simbol K).
    const dayOfWeek = startOfDay.getDay(); // 0 = Min, 1 = Sen, ..., 5 = Jum, 6 = Sab
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const shift1Start = new Date(startOfDay);
    shift1Start.setHours(7, 30, 0, 0);

    // Cari run pertama di Shift 1 (dimulai antara 07:30 s/d 15:30)
    const firstShift1Run = runs.find((r) => {
      const st = new Date(r.startTime);
      const hours = st.getHours();
      const minutes = st.getMinutes();
      const timeInMin = hours * 60 + minutes;
      return r.shift === "Shift 1" || (timeInMin >= 450 && timeInMin < 930);
    });

    let morningSetupMinutes = 0;
    let morningSetupStart: Date | null = null;
    let morningSetupEnd: Date | null = null;

    if (isWeekday && firstShift1Run) {
      if (firstShift1Run.startTime.getTime() > shift1Start.getTime()) {
        morningSetupStart = shift1Start;
        morningSetupEnd = new Date(firstShift1Run.startTime);
        const diffMs = morningSetupEnd.getTime() - morningSetupStart.getTime();
        // Batasi maksimal 4 jam (240 menit) agar tidak anomali jika run baru dimulai sore hari
        morningSetupMinutes = Math.min(240, Math.max(0, Math.round(diffMs / 60000)));
      }
    } else if (isWeekday && runs.length === 0) {
      // Jika belum ada run sama sekali pada hari kerja saat ini di jam kerja Shift 1
      const isTargetToday = dateIso === new Date().toISOString().slice(0, 10);
      const nowMs = Date.now();
      if (isTargetToday && nowMs > shift1Start.getTime()) {
        const shift1EndLimit = new Date(startOfDay);
        shift1EndLimit.setHours(15, 30, 0, 0);
        morningSetupStart = shift1Start;
        morningSetupEnd = new Date(Math.min(nowMs, shift1EndLimit.getTime()));
        const diffMs = morningSetupEnd.getTime() - morningSetupStart.getTime();
        morningSetupMinutes = Math.min(240, Math.max(0, Math.round(diffMs / 60000)));
      }
    }

    if (morningSetupMinutes > 0 && morningSetupStart && morningSetupEnd) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const sStr = `${pad(morningSetupStart.getHours())}:${pad(morningSetupStart.getMinutes())}`;
      const eStr = `${pad(morningSetupEnd.getHours())}:${pad(morningSetupEnd.getMinutes())}`;
      abnormalNotesArr.push(
        `[Keterlambatan Start Shift 1] ${sStr} - ${eStr} : Menunggu start produksi (${morningSetupMinutes} Menit - Simbol W Sesuai Instruksi)`
      );
    }

    // Helper for stop reason symbol
    const getStopSymbol = (reasonStr?: string | null): string => {
      if (!reasonStr) return "";
      const r = reasonStr.toLowerCase();
      if (r.includes("sheet") || r.includes("cek sheet")) return "A";
      if (r.includes("auto loader") || r.includes("loader")) return "B";
      if (r.includes("training")) return "R";
      if (r.includes("meeting") || r.includes("rapat")) return "C";
      if (r.includes("angkut") || r.includes("pengangkutan")) return "D";
      if (r.includes("material habis") || r.includes("habis material")) return "E";
      if (r.includes("kualitas") || r.includes("qualitas")) return "F";
      if (r.includes("mold") || r.includes("cetakan")) return "G";
      if (r.includes("mesin") || r.includes("machine")) return "H";
      if (r.includes("robot") && !r.includes("setting")) return "I";
      if (r.includes("ganti material") || r.includes("color change")) return "J";
      if (r.includes("dies") || r.includes("setting robot")) return "K";
      if (r.includes("dryer")) return "L";
      if (r.includes("dies belum")) return "N";
      if (r.includes("5s")) return "Q";
      if (r.includes("alat") || r.includes("pengecekan alat")) return "S";
      if (r.includes("trolly") || r.includes("troli")) return "T";
      if (r.includes("makan") || r.includes("istirahat")) return "U";
      if (r.includes("trial")) return "V";
      if (r.includes("instruksi")) return "W";
      if (r.includes("listrik") || r.includes("mati lampu")) return "X";
      if (r.includes("tercapai") || r.includes("selesai")) return "OK";
      return "M";
    };

    // Helper for defect categorization
    const categorizeDefect = (code?: string, name?: string): "suteShort" | "silver" | "short" | "weld" | "cekung" | "bendaAsing" | "scratch" | "other" => {
      const n = ((name || "") + " " + (code || "")).toLowerCase();
      if (n.includes("sute") || (n.includes("short") && n.includes("mold"))) return "suteShort";
      if (n.includes("silver")) return "silver";
      if (n.includes("short")) return "short";
      if (n.includes("weld") || n.includes("flow")) return "weld";
      if (n.includes("sink") || n.includes("cekung")) return "cekung";
      if (n.includes("black") || n.includes("asing") || n.includes("gosong") || n.includes("dot")) return "bendaAsing";
      if (n.includes("scratch") || n.includes("baret")) return "scratch";
      return "other";
    };

    // Fetch defect types and audit logs for reject and operator change distribution
    const runIds = runs.map((r) => r.id);
    const [allDefectTypes, rejectAuditLogs, changeOpAuditLogs] = await Promise.all([
      prisma.defectType.findMany(),
      runIds.length > 0
        ? prisma.auditLog.findMany({
            where: {
              entity: "ProductionRun",
              entityId: { in: runIds },
              action: "UPDATE_REJECTS",
            },
            orderBy: { createdAt: "asc" },
          })
        : [],
      runIds.length > 0
        ? prisma.auditLog.findMany({
            where: {
              entity: "ProductionRun",
              entityId: { in: runIds },
              action: "CHANGE_OPERATOR",
            },
            orderBy: { createdAt: "asc" },
          })
        : [],
    ]);
    const defectTypesMap = new Map(allDefectTypes.map((dt) => [dt.id, dt]));

    // Prepare Part Rows (max 7 items)
    const reportParts: DailyMachineReportData["parts"] = [];

    // Prioritaskan operator aktif saat ini agar menjadi penandatangan utama pada laporan
    const activeOrLatestRun = runs.find((r) => r.status === "RUNNING") || runs[runs.length - 1];
    if (activeOrLatestRun?.operator?.name) {
      operatorsSet.add(activeOrLatestRun.operator.name);
    }

    // Kelompokkan runs berdasarkan Part (atau pasangan Family Mold jika mode SET)
    // agar setiap part hanya muncul 1 kali di baris tabel Part (tidak duplikat saat ada stop & start lagi)
    type PartRowGroup = {
      groupKey: string;
      isSetMode: boolean;
      mainPart: (typeof runs)[0]["part"];
      pairPart: (typeof runs)[0]["part"]["pairPart"] | null;
      runs: typeof runs;
      earliestStart: Date;
      latestEnd: Date;
      hasRunning: boolean;
      isTrial: boolean;
    };

    const partGroupsMap = new Map<string, PartRowGroup>();

    for (const run of runs) {
      operatorsSet.add(run.operator.name);
      if (run.shift) primaryShift = run.shift;
      if (run.notes && run.notes.trim()) {
        abnormalNotesArr.push(`[Run #${run.id} ${run.part.partNo}]: ${run.notes}`);
      }

      const isSetMode =
        (run.moldMode === "SET" || !run.moldMode) &&
        Boolean(run.part.pairPartId && run.part.pairPart);

      let groupKey: string;
      if (isSetMode && run.part.pairPart) {
        // Pasangan part family mold dikelompokkan bersama (key terurut id terkecil)
        const id1 = Math.min(run.part.id, run.part.pairPart.id);
        const id2 = Math.max(run.part.id, run.part.pairPart.id);
        groupKey = `FAMILY_${id1}_${id2}`;
      } else {
        groupKey = `PART_${run.part.id}`;
      }

      const rStart = new Date(Math.max(run.startTime.getTime(), startOfDay.getTime()));
      const rEnd = run.stopTime
        ? new Date(Math.min(run.stopTime.getTime(), endOfDay.getTime()))
        : new Date(Math.min(Date.now(), endOfDay.getTime()));
      const isRunning = run.status === "RUNNING";
      const isRunTrial =
        (run.notes && run.notes.toLowerCase().includes("trial")) ||
        run.stopReason?.reason?.toLowerCase().includes("trial") ||
        false;

      if (!partGroupsMap.has(groupKey)) {
        partGroupsMap.set(groupKey, {
          groupKey,
          isSetMode,
          mainPart: run.part,
          pairPart: isSetMode ? run.part.pairPart : null,
          runs: [run],
          earliestStart: rStart,
          latestEnd: rEnd,
          hasRunning: isRunning,
          isTrial: isRunTrial,
        });
      } else {
        const grp = partGroupsMap.get(groupKey)!;
        grp.runs.push(run);
        if (rStart.getTime() < grp.earliestStart.getTime()) {
          grp.earliestStart = rStart;
        }
        if (rEnd.getTime() > grp.latestEnd.getTime()) {
          grp.latestEnd = rEnd;
        }
        if (isRunning) grp.hasRunning = true;
        if (isRunTrial) grp.isTrial = true;
      }
    }

    // Bangun baris Part (maksimal 7 baris untuk form laporan)
    for (const group of Array.from(partGroupsMap.values())) {
      if (reportParts.length >= 7) break;

      const padTime = (n: number) => String(n).padStart(2, "0");
      const settingAwal = `${padTime(group.earliestStart.getHours())}:${padTime(group.earliestStart.getMinutes())}`;
      const settingAkhir = group.hasRunning
        ? "Jalan"
        : `${padTime(group.latestEnd.getHours())}:${padTime(group.latestEnd.getMinutes())}`;
      const settingTry = group.isTrial ? "OK" : "-";

      // Total waktu part berada di mesin dalam hari ini (dari start pertama s/d selesai terakhir)
      const totalSpanMs = Math.max(0, group.latestEnd.getTime() - group.earliestStart.getTime());
      const totalRunHours = Number((totalSpanMs / 3600000).toFixed(2));

      // Cari target produksi (PPIC / Revisi Target) untuk part ini
      let planTargetQty: number | null = null;
      for (const r of group.runs) {
        if (r.plan?.targetQty && r.plan.targetQty > 0) {
          planTargetQty = r.plan.targetQty;
          break;
        }
      }

      if (!planTargetQty) {
        const matchedPlan = machinePlans.find(
          (p) =>
            p.partId === group.mainPart.id ||
            (group.pairPart && p.partId === group.pairPart.id) ||
            (p.part.pairPartId && p.part.pairPartId === group.mainPart.id)
        );
        if (matchedPlan?.targetQty && matchedPlan.targetQty > 0) {
          planTargetQty = matchedPlan.targetQty;
        }
      }

      if (group.isSetMode && group.pairPart) {
        // Family Mold SET mode: produce 2 rows (Main Part & Pair Part)
        const mainPart = group.mainPart;
        const pairPart = group.pairPart;

        let mainScanQty = 0;
        let pairScanQty = 0;
        let totalRemainders = 0;

        for (const r of group.runs) {
          totalRemainders += r.remainderQty || 0;
          for (const s of r.scans) {
            if (!s.kanban?.partId || s.kanban.partId === mainPart.id) {
              mainScanQty += s.qty;
            } else if (s.kanban?.partId === pairPart.id) {
              pairScanQty += s.qty;
            }
          }
        }

        const mainTotalOk = mainScanQty + totalRemainders;
        const pairTotalOk = pairScanQty > 0 ? pairScanQty : mainTotalOk;

        // Target Qty (Jumlah Pcs): Berubah otomatis mengikuti revisi target PPIC
        const targetQtyMain = (typeof planTargetQty === "number" && planTargetQty > 0) ? planTargetQty : mainTotalOk;
        const targetQtyPair = (typeof planTargetQty === "number" && planTargetQty > 0) ? planTargetQty : pairTotalOk;

        const ctSec = mainPart.cycleTimeSec || pairPart.cycleTimeSec || 30;

        // Waktu (Jam) Target Standar: Berubah otomatis mengikuti revisi target PPIC
        const targetHoursMain = Number(((targetQtyMain * ctSec) / (2 * 3600)).toFixed(2));
        const targetHoursPair = Number(((targetQtyPair * ctSec) / (2 * 3600)).toFixed(2));

        // Waktu Produksi Aktual (dihitung dari hasil Part OK riil untuk menghitung Stop Jam)
        const actualHoursMain = Number(((mainTotalOk * ctSec) / (2 * 3600)).toFixed(2));
        const actualHoursPair = Number(((pairTotalOk * ctSec) / (2 * 3600)).toFixed(2));
        const totalActualHours = Number((actualHoursMain + actualHoursPair).toFixed(2));

        const stopJam = Math.max(0, Number((totalRunHours - totalActualHours).toFixed(2)));
        const stopMinTotal = Math.round(stopJam * 60);

        // Agregasi defect per sisi di semua run untuk grup ini
        const countDefects = (partId: number) => {
          let sShort = 0, silv = 0, shrt = 0, wld = 0, ckng = 0, bAsing = 0, scrtch = 0;
          for (const r of group.runs) {
            for (const rj of r.rejects) {
              if (!rj.partId || rj.partId === partId) {
                const cat = categorizeDefect(rj.defectType?.code, rj.defectType?.name);
                if (cat === "suteShort") sShort += rj.qty;
                else if (cat === "silver") silv += rj.qty;
                else if (cat === "short") shrt += rj.qty;
                else if (cat === "weld") wld += rj.qty;
                else if (cat === "cekung") ckng += rj.qty;
                else if (cat === "bendaAsing") bAsing += rj.qty;
                else if (cat === "scratch") scrtch += rj.qty;
              }
            }
          }
          const total = sShort + silv + shrt + wld + ckng + bAsing + scrtch;
          return { sShort, silv, shrt, wld, ckng, bAsing, scrtch, total };
        };

        const mainDefects = countDefects(mainPart.id);
        const pairDefects = countDefects(pairPart.id);

        // Row 1: Main Part
        reportParts.push({
          no: reportParts.length + 1,
          partNo: mainPart.partNo,
          partName: mainPart.name,
          qty: targetQtyMain,
          cycleTime: ctSec,
          cavity: 1,
          waktuJam: targetHoursMain,
          material: (mainPart as any).material || (pairPart as any).material || "",
          settingAwal,
          settingAkhir,
          settingTry,
          totalWaktu: totalRunHours,
          stopJam,
          stopMinutes: stopMinTotal,
          partOk: mainTotalOk,
          suteShort: mainDefects.sShort,
          silver: mainDefects.silv,
          short: mainDefects.shrt,
          weld: mainDefects.wld,
          cekung: mainDefects.ckng,
          bendaAsing: mainDefects.bAsing,
          scratch: mainDefects.scrtch,
          buang: mainDefects.total,
          repair: 0,
        });

        // Row 2: Pair Part
        if (reportParts.length < 7) {
          reportParts.push({
            no: reportParts.length + 1,
            partNo: pairPart.partNo,
            partName: pairPart.name,
            qty: targetQtyPair,
            cycleTime: ctSec,
            cavity: 1,
            waktuJam: targetHoursPair,
            material: (pairPart as any).material || (mainPart as any).material || "",
            settingAwal,
            settingAkhir,
            settingTry,
            totalWaktu: totalRunHours,
            stopJam,
            stopMinutes: stopMinTotal,
            partOk: pairTotalOk,
            suteShort: pairDefects.sShort,
            silver: pairDefects.silv,
            short: pairDefects.shrt,
            weld: pairDefects.wld,
            cekung: pairDefects.ckng,
            bendaAsing: pairDefects.bAsing,
            scratch: pairDefects.scrtch,
            buang: pairDefects.total,
            repair: 0,
          });
        }
      } else {
        // Part Reguler
        let totalScanQty = 0;
        let totalRemainderQty = 0;

        for (const r of group.runs) {
          totalScanQty += r.scans.reduce((acc, s) => acc + s.qty, 0);
          totalRemainderQty += r.remainderQty || 0;
        }

        const totalOk = totalScanQty + totalRemainderQty;
        // Target Qty (Jumlah Pcs): Berubah otomatis mengikuti revisi target PPIC
        const targetQty = (typeof planTargetQty === "number" && planTargetQty > 0) ? planTargetQty : totalOk;

        const ctSec = group.mainPart.cycleTimeSec || 30;
        const cav = group.mainPart.cavity || 1;

        // Waktu (Jam) Target Standar: Berubah otomatis mengikuti revisi target PPIC
        const targetHours = Number(((targetQty * ctSec) / (cav * 3600)).toFixed(2));

        // Waktu Produksi Aktual (dihitung dari hasil Part OK riil untuk menghitung Stop Jam)
        const actualHours = Number(((totalOk * ctSec) / (cav * 3600)).toFixed(2));

        const stopJam = Math.max(0, Number((totalRunHours - actualHours).toFixed(2)));
        const stopMinTotal = Math.round(stopJam * 60);

        let suteShort = 0, silver = 0, short = 0, weld = 0, cekung = 0, bendaAsing = 0, scratch = 0;
        for (const r of group.runs) {
          for (const rj of r.rejects) {
            const cat = categorizeDefect(rj.defectType?.code, rj.defectType?.name);
            if (cat === "suteShort") suteShort += rj.qty;
            else if (cat === "silver") silver += rj.qty;
            else if (cat === "short") short += rj.qty;
            else if (cat === "weld") weld += rj.qty;
            else if (cat === "cekung") cekung += rj.qty;
            else if (cat === "bendaAsing") bendaAsing += rj.qty;
            else if (cat === "scratch") scratch += rj.qty;
          }
        }
        const totalNgThisGroup = suteShort + silver + short + weld + cekung + bendaAsing + scratch;

        reportParts.push({
          no: reportParts.length + 1,
          partNo: group.mainPart.partNo,
          partName: group.mainPart.name,
          qty: targetQty,
          cycleTime: ctSec,
          cavity: cav,
          waktuJam: targetHours,
          material: (group.mainPart as any).material || "",
          settingAwal,
          settingAkhir,
          settingTry,
          totalWaktu: totalRunHours,
          stopJam,
          stopMinutes: stopMinTotal,
          partOk: totalOk,
          suteShort,
          silver,
          short,
          weld,
          cekung,
          bendaAsing,
          scratch,
          buang: totalNgThisGroup,
          repair: 0,
        });
      }
    }

    // 24-Hour Timeline Distribution
    // Order of hours matching Excel form: 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6
    const hourSlots = [
      7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6
    ];

    const hourlyMap: DailyMachineReportData["hourly"] = {};
    const minuteGrid: Record<number, Array<"RUN" | "STOP" | "DELAY" | null>> = {};
    type OpInfo = { id: number; employeeId: string; name: string; shortName: string };
    const operatorMinuteGrid: Record<number, Array<OpInfo | null>> = {};

    for (const h of hourSlots) {
      hourlyMap[String(h)] = {
        hour: h,
        runMinutes: 0,
        stopMinutes: 0,
        delayMinutes: 0,
        delaySymbol: "",
        stopSymbol: "",
        stopReason: "",
        checkedQty: 0,
        segments: [],
        ng: {
          suteShort: 0,
          silver: 0,
          short: 0,
          weld: 0,
          cekung: 0,
          bendaAsing: 0,
          scratch: 0,
        },
      };
      minuteGrid[h] = new Array<"RUN" | "STOP" | "DELAY" | null>(60).fill(null);
      operatorMinuteGrid[h] = new Array(60).fill(null);
    }

    // Alokasi Waktu Keterlambatan Start Shift 1 (07:30 s/d jam operator klik start) -> DELAY (Simbol W)
    if (morningSetupMinutes > 0 && morningSetupStart && morningSetupEnd) {
      let curSetup = new Date(morningSetupStart);
      while (curSetup.getTime() < morningSetupEnd.getTime()) {
        const h = curSetup.getHours();
        const m = curSetup.getMinutes();
        if (minuteGrid[h] && minuteGrid[h][m] === null) {
          minuteGrid[h][m] = "DELAY";
        }
        curSetup.setMinutes(curSetup.getMinutes() + 1);
      }
      const sH = morningSetupStart.getHours();
      const eH = morningSetupEnd.getHours();
      for (let h = sH; h <= eH; h++) {
        if (hourlyMap[String(h)] && !hourlyMap[String(h)].delaySymbol) {
          hourlyMap[String(h)].delaySymbol = "W";
          hourlyMap[String(h)].delayReason = "Sesuai Instruksi (Menunggu Mulai Shift 1)";
        }
      }

      // Assign operator Shift 1 yang bertugas jika ada
      if (firstShift1Run?.operator) {
        const first = firstShift1Run.operator.name.trim().split(/\s+/)[0] || "";
        const opData: OpInfo = {
          id: firstShift1Run.operator.id,
          employeeId: firstShift1Run.operator.employeeId,
          name: firstShift1Run.operator.name,
          shortName: first.slice(0, 5),
        };
        let curOp = new Date(morningSetupStart);
        while (curOp.getTime() < morningSetupEnd.getTime()) {
          const h = curOp.getHours();
          const m = curOp.getMinutes();
          if (operatorMinuteGrid[h] && !operatorMinuteGrid[h][m]) {
            operatorMinuteGrid[h][m] = opData;
          }
          curOp.setMinutes(curOp.getMinutes() + 1);
        }
      }
    }

    // Allocate run durations, operator timeline, and scans to hourly slots
    for (let idx = 0; idx < runs.length; idx++) {
      const run = runs[idx];
      const rStart = Math.max(run.startTime.getTime(), startOfDay.getTime());
      const rEnd = run.stopTime
        ? Math.min(run.stopTime.getTime(), endOfDay.getTime())
        : Math.min(Date.now(), endOfDay.getTime());

      // Build operator intervals for this run based on changeOpAuditLogs
      const logsForRun = changeOpAuditLogs.filter((l) => l.entityId === run.id);
      const opIntervals: Array<{ startMs: number; op: OpInfo }> = [];

      if (logsForRun.length === 0) {
        if (run.operator) {
          const first = run.operator.name.trim().split(/\s+/)[0] || "";
          opIntervals.push({
            startMs: run.startTime.getTime(),
            op: {
              id: run.operator.id,
              employeeId: run.operator.employeeId,
              name: run.operator.name,
              shortName: first.slice(0, 5),
            },
          });
        }
      } else {
        try {
          const firstOld = JSON.parse(logsForRun[0].oldValue || "{}");
          const first = (firstOld.name || "").trim().split(/\s+/)[0] || "";
          opIntervals.push({
            startMs: run.startTime.getTime(),
            op: {
              id: firstOld.operatorId || run.operator.id,
              employeeId: firstOld.employeeId || run.operator.employeeId,
              name: firstOld.name || run.operator.name,
              shortName: first.slice(0, 5),
            },
          });
        } catch {
          const first = run.operator.name.trim().split(/\s+/)[0] || "";
          opIntervals.push({
            startMs: run.startTime.getTime(),
            op: {
              id: run.operator.id,
              employeeId: run.operator.employeeId,
              name: run.operator.name,
              shortName: first.slice(0, 5),
            },
          });
        }

        for (const log of logsForRun) {
          try {
            const nextNew = JSON.parse(log.newValue || "{}");
            const first = (nextNew.name || "").trim().split(/\s+/)[0] || "";
            opIntervals.push({
              startMs: log.createdAt.getTime(),
              op: {
                id: nextNew.operatorId,
                employeeId: nextNew.employeeId,
                name: nextNew.name,
                shortName: first.slice(0, 5),
              },
            });
          } catch {}
        }
      }

      const getOpAt = (timeMs: number): OpInfo | null => {
        if (opIntervals.length === 0) return null;
        let active = opIntervals[0].op;
        for (const interval of opIntervals) {
          if (timeMs >= interval.startMs) {
            active = interval.op;
          } else {
            break;
          }
        }
        return active;
      };

      // Distribute each production minute of the run
      // Menit RUN dan operator hanya dialokasikan untuk waktu aktual yang sudah berlangsung (rEnd)
      // Tidak memproyeksikan ke jam-jam masa depan di sisa shift agar inspektor tidak muncul prematur
      const opEnd = new Date(rEnd);

      let cur = new Date(rStart);
      while (cur.getTime() < opEnd.getTime()) {
        const h = cur.getHours();
        const m = cur.getMinutes();
        if (cur.getTime() < rEnd) {
          if (minuteGrid[h]) {
            minuteGrid[h][m] = "RUN";
          }
        }
        const opAtMin = getOpAt(cur.getTime());
        if (opAtMin && operatorMinuteGrid[h]) {
          operatorMinuteGrid[h][m] = opAtMin;
        }
        cur.setMinutes(cur.getMinutes() + 1);
      }

      // Distribute actual stop/delay minutes between runs or ongoing breakdown
      if (run.stopTime && run.stopReason) {
        const reasonCode = (run.stopReason as any).code || getStopSymbol(run.stopReason.reason);
        const isNormalCompletion =
          run.stopReason.category === "Selesai Produksi" ||
          reasonCode === "OK" ||
          run.stopReason.reason.toLowerCase().includes("target tercapai");

        // Only record Berhenti / Keterlambatan if it was an abnormal stop or delay, NOT normal completion
        if (!isNormalCompletion) {
          const isDelay = run.stopReason.category === "Sebab Lambat";
          const nextRun = runs[idx + 1];
          const stopStart = run.stopTime;
          const hasActiveRun = runs.some((r) => r.status === "RUNNING");
          const stopEnd = nextRun
            ? nextRun.startTime
            : (hasActiveRun ? run.stopTime : new Date(Math.min(Date.now(), endOfDay.getTime())));

          let curStop = new Date(Math.max(stopStart.getTime(), startOfDay.getTime()));
          const maxStop = new Date(Math.min(stopEnd.getTime(), endOfDay.getTime()));

          while (curStop.getTime() < maxStop.getTime()) {
            const h = curStop.getHours();
            const m = curStop.getMinutes();
            if (minuteGrid[h]) {
              if (minuteGrid[h][m] !== "RUN") {
                minuteGrid[h][m] = isDelay ? "DELAY" : "STOP";
              }
              if (isDelay) {
                if (!hourlyMap[String(h)].delaySymbol) {
                  hourlyMap[String(h)].delaySymbol = reasonCode;
                  hourlyMap[String(h)].delayReason = run.stopReason.reason;
                }
              } else {
                if (!hourlyMap[String(h)].stopSymbol) {
                  hourlyMap[String(h)].stopSymbol = reasonCode;
                  hourlyMap[String(h)].stopReason = run.stopReason.reason;
                }
              }
            }
            const opAtMin = getOpAt(curStop.getTime());
            if (opAtMin && operatorMinuteGrid[h]) {
              operatorMinuteGrid[h][m] = opAtMin;
            }
            curStop.setMinutes(curStop.getMinutes() + 1);
          }
        }
      }

      // Allocate scans to hours
      for (const scan of run.scans) {
        const scanH = scan.scannedAt.getHours();
        if (hourlyMap[String(scanH)]) {
          hourlyMap[String(scanH)].checkedQty += scan.qty;
        }
      }

      if (run.remainderQty > 0) {
        const stopH = (run.stopTime || run.startTime).getHours();
        if (hourlyMap[String(stopH)]) {
          hourlyMap[String(stopH)].checkedQty += run.remainderQty;
        }
      }
    }

    // Summarize minuteGrid into runMinutes, stopMinutes, delayMinutes, segments, and QC Inspector
    for (const h of hourSlots) {
      const grid = minuteGrid[h];
      let runCount = 0;
      let stopCount = 0;
      let delayCount = 0;

      for (let m = 0; m < 60; m++) {
        if (grid[m] === "RUN") runCount++;
        else if (grid[m] === "STOP") stopCount++;
        else if (grid[m] === "DELAY") delayCount++;
      }

      hourlyMap[String(h)].runMinutes = runCount;
      hourlyMap[String(h)].stopMinutes = stopCount;
      hourlyMap[String(h)].delayMinutes = delayCount;

      const segs: Array<{ type: "RUN" | "STOP" | "DELAY"; startMin: number; endMin: number }> = [];
      let currentType: "RUN" | "STOP" | "DELAY" | null = null;
      let segStart = 0;

      for (let m = 0; m < 60; m++) {
        const type = grid[m];
        if (type !== currentType) {
          if (currentType !== null) {
            segs.push({
              type: currentType,
              startMin: segStart,
              endMin: m,
            });
          }
          currentType = type;
          segStart = m;
        }
      }
      if (currentType !== null) {
        segs.push({
          type: currentType,
          startMin: segStart,
          endMin: 60,
        });
      }

      hourlyMap[String(h)].segments = segs;

      // Summarize QC Inspector for hour h (Opsi 1: Slash format Rid/Hus jika 2 operator)
      const opsInHour = (operatorMinuteGrid[h] || []).filter(Boolean) as OpInfo[];
      if (opsInHour.length > 0) {
        const distinctOps: OpInfo[] = [];
        const seenIds = new Set<number>();
        for (const op of opsInHour) {
          if (!seenIds.has(op.id)) {
            seenIds.add(op.id);
            distinctOps.push(op);
          }
        }

        if (distinctOps.length === 1) {
          const op = distinctOps[0];
          hourlyMap[String(h)].inspector = {
            id: op.id,
            employeeId: op.employeeId,
            fullName: op.name,
            shortName: op.shortName.slice(0, 5),
          };
        } else if (distinctOps.length >= 2) {
          const op1 = distinctOps[0];
          const op2 = distinctOps[1];
          const a1 = op1.shortName.slice(0, 3);
          const a2 = op2.shortName.slice(0, 3);
          const slashName = `${a1}/${a2}`; // e.g. "Rid/Hus"

          let transitionMin = 30;
          for (let m = 0; m < 60; m++) {
            if (operatorMinuteGrid[h][m]?.id === op2.id) {
              transitionMin = m;
              break;
            }
          }

          hourlyMap[String(h)].inspector = {
            id: op2.id,
            employeeId: `${op1.employeeId}/${op2.employeeId}`,
            fullName: `(00-${transitionMin}m) ${op1.name} | (${transitionMin}-60m) ${op2.name}`,
            shortName: slashName,
          };
        }
      }
    }

    // Allocate defect logs to hourly slots based on AuditLog entries (or fallback to RunReject)
    if (rejectAuditLogs.length > 0) {
      const runDefectPrevMap: Record<number, Record<number, number>> = {};
      for (const log of rejectAuditLogs) {
        try {
          const parsed = JSON.parse(log.newValue || "{}");
          const breakdown: Array<{ defectTypeId: number; qty: number }> = parsed.breakdown || [];
          const logH = log.createdAt.getHours();
          if (!runDefectPrevMap[log.entityId]) runDefectPrevMap[log.entityId] = {};
          for (const item of breakdown) {
            const prev = runDefectPrevMap[log.entityId][item.defectTypeId] || 0;
            const delta = Math.max(0, (item.qty || 0) - prev);
            runDefectPrevMap[log.entityId][item.defectTypeId] = item.qty || 0;
            if (delta > 0 && hourlyMap[String(logH)]) {
              const dt = defectTypesMap.get(item.defectTypeId);
              const cat = categorizeDefect(dt?.code, dt?.name);
              if (cat !== "other") {
                hourlyMap[String(logH)].ng[cat] += delta;
              }
            }
          }
        } catch {}
      }
    }

    // Fallback for runs without audit log records
    const loggedRunIds = new Set(rejectAuditLogs.map((l) => l.entityId));
    for (const run of runs) {
      if (!loggedRunIds.has(run.id)) {
        for (const rj of run.rejects) {
          const rjH = (rj.updatedAt || run.startTime).getHours();
          if (hourlyMap[String(rjH)]) {
            const cat = categorizeDefect(rj.defectType?.code, rj.defectType?.name);
            if (cat !== "other") {
              hourlyMap[String(rjH)].ng[cat] += rj.qty;
            }
          }
        }
      }
    }

    // Identify inspectors from audit logs or users
    const qcUserIds = Array.from(new Set(rejectAuditLogs.map((l) => l.userId).filter(Boolean))) as number[];
    let inspector1 = "";
    let inspector2 = "";
    if (qcUserIds.length > 0) {
      const qcUsers = await prisma.user.findMany({
        where: { id: { in: qcUserIds } },
      });
      inspector1 = qcUsers[0]?.name || "";
      inspector2 = qcUsers[1]?.name || "";
    }

    // Fetch active users for inspector quick selection
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, employeeId: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    const availableOperators = activeUsers.map((u) => {
      const first = u.name.trim().split(/\s+/)[0] || "";
      return {
        id: u.id,
        employeeId: u.employeeId,
        name: u.name,
        shortName: first.slice(0, 5),
        role: u.role,
      };
    });

    return {
      success: true,
      data: {
        machine: {
          id: machine.id,
          code: machine.code,
          model: machine.model,
          tonnage: machine.tonnage,
        },
        dateStr: dateStrFormatted,
        dateIso,
        shift: primaryShift,
        operators: Array.from(operatorsSet),
        inspectors: {
          inspector1: inspector1 || "",
          inspector2: inspector2 || "",
        },
        availableOperators,
        leader: "",
        deptHead: "",
        parts: reportParts,
        hourly: hourlyMap,
        abnormalNotes: abnormalNotesArr.join("\n") || "Kondisi mesin berjalan normal sesuai standar target produksi.",
        formCode: "FO/MLD/009 Rev.08",
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memuat data laporan harian mesin";
    return { success: false, error: message };
  }
}

export async function exportDailyMachineReportExcel(
  machineId: number,
  targetDateIso?: string,
  approvalNames?: {
    operatorName?: string;
    inspector1?: string;
    inspector2?: string;
    leader?: string;
    deptHead?: string;
  },
  hourlyInspectors?: Record<number, { shortName: string; fullName?: string; employeeId?: string }>
): Promise<{ success: boolean; error?: string; base64?: string; filename?: string }> {
  try {
    const res = await getDailyMachineReportData(machineId, targetDateIso);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "Gagal mengambil data laporan" };
    }

    const reportData = res.data;
    if (hourlyInspectors) {
      for (const [hStr, insp] of Object.entries(hourlyInspectors)) {
        if (reportData.hourly[hStr]) {
          reportData.hourly[hStr].inspector = {
            fullName: insp.fullName || insp.shortName,
            shortName: (insp.shortName || "").slice(0, 5),
            employeeId: insp.employeeId,
          };
        }
      }
    }
    const templatePath = path.join(process.cwd(), "contoh laporan harian molding.xlsx");
    if (!fs.existsSync(templatePath)) {
      return { success: false, error: "Template file 'contoh laporan harian molding.xlsx' tidak ditemukan." };
    }

    const tempFileName = `laporan_${reportData.machine.code}_${Date.now()}.xlsx`;
    const tempOutputPath = path.join(os.tmpdir(), tempFileName);
    const pythonScript = path.join(process.cwd(), "scripts", "generate_molding_report.py");

    await new Promise<void>((resolve, reject) => {
      const py = spawn("python", [pythonScript, templatePath, tempOutputPath]);
      py.stdin.write(
        JSON.stringify({
          machineCode: reportData.machine.code,
          machineTonnage: `${reportData.machine.tonnage}T`,
          dateStr: reportData.dateStr,
          operatorName: approvalNames?.operatorName || reportData.operators.join(", ") || "-",
          inspector1: approvalNames?.inspector1 || reportData.inspectors?.inspector1 || "",
          inspector2: approvalNames?.inspector2 || reportData.inspectors?.inspector2 || "",
          leader: approvalNames?.leader || reportData.leader || "",
          deptHead: approvalNames?.deptHead || reportData.deptHead || "",
          shift: reportData.shift,
          parts: reportData.parts,
          hourly: reportData.hourly,
          abnormalNotes: reportData.abnormalNotes,
        })
      );
      py.stdin.end();

      py.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Python process exited with code ${code}`));
      });
      py.on("error", (err) => reject(err));
    });

    if (!fs.existsSync(tempOutputPath)) {
      return { success: false, error: "File Excel gagal digenerate." };
    }

    const fileBuffer = fs.readFileSync(tempOutputPath);
    try {
      fs.unlinkSync(tempOutputPath);
    } catch {}

    const safeDate = (reportData.dateIso || "today").replace(/[^a-zA-Z0-9-]/g, "_");
    const filename = `Laporan_Harian_Molding_${reportData.machine.code}_${safeDate}.xlsx`;

    return {
      success: true,
      base64: fileBuffer.toString("base64"),
      filename,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengekspor laporan harian ke Excel";
    return { success: false, error: message };
  }
}

