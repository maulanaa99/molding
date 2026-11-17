import MMSMainApp from "@/components/MMSMainApp";
import {
  getMachinesWithStatus,
  getDashboardOverview,
  getMasterData,
  getProductionPlans,
  FinishGoodStockItem,
} from "@/lib/actions";
import { MachineData } from "@/components/MachineCard";
import { PlanDetailItem } from "@/components/ProductionPlanningView";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }

  // Hanya ambil data esensial untuk render awal (Mesin, Dashboard OEE, Master, & Planning)
  // Laporan historis & Stok FG di-load secara dinamis/lazy saat tab terkait dibuka
  const [machinesRes, overviewRes, masterRes, plansRes] = await Promise.all([
    getMachinesWithStatus(),
    getDashboardOverview(),
    getMasterData(),
    getProductionPlans(),
  ]);

  const initialMachines = (machinesRes.data || []) as MachineData[];
  const initialOverview = overviewRes.data || {
    machineCounts: { total: 0, running: 0, down: 0, idle: 0 },
    productionToday: {
      totalRuns: 0,
      totalTrolly: 0,
      totalPcsOk: 0,
      totalPcsReject: 0,
      efficiency: 0,
      rejectRate: 0,
    },
    oee: {
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 100,
      operatingMinutes: 0,
      downtimeMinutes: 0,
      worldClassTarget: {
        oee: 85,
        availability: 90,
        performance: 95,
        quality: 99.9,
      },
    },
  };
  const initialReports = { rows: [], pareto: [] };
  const initialStock: FinishGoodStockItem[] = [];
  const masterData = masterRes.data || {
    machines: [],
    parts: [],
    stopReasons: [],
    kanbans: [],
    users: [],
  };
  const initialPlans = (plansRes.data || []) as PlanDetailItem[];
  const initialServerTime = Date.now();

  return (
    <MMSMainApp
      initialMachines={initialMachines}
      initialOverview={initialOverview}
      initialReports={initialReports}
      masterData={masterData}
      initialPlans={initialPlans}
      initialStock={initialStock}
      initialServerTime={initialServerTime}
      authenticatedUser={user}
    />
  );
}
