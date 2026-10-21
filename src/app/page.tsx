import MMSMainApp from "@/components/MMSMainApp";
import {
  getMachinesWithStatus,
  getDashboardOverview,
  getProductionReports,
  getMasterData,
  getProductionPlans,
  getFinishGoodStock,
  FinishGoodStockItem,
} from "@/lib/actions";
import { MachineData } from "@/components/MachineCard";
import { PlanDetailItem } from "@/components/ProductionPlanningView";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }

  const [machinesRes, overviewRes, reportsRes, masterRes, plansRes, stockRes] = await Promise.all([
    getMachinesWithStatus(),
    getDashboardOverview(),
    getProductionReports(),
    getMasterData(),
    getProductionPlans(),
    getFinishGoodStock(),
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
  };
  const initialReports = reportsRes.data || { rows: [], pareto: [] };
  const masterData = masterRes.data || {
    machines: [],
    parts: [],
    stopReasons: [],
    kanbans: [],
    users: [],
  };
  const initialPlans = (plansRes.data || []) as PlanDetailItem[];
  const initialStock = (stockRes.data || []) as FinishGoodStockItem[];
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
