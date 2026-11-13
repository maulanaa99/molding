import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginTerminalClient, { DBUser, DBMachine } from "./LoginTerminalClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Operator Check-in - MMS Terminal",
  description: "Touch Terminal Authentication & Workstation Control",
};

export default async function LoginPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // Session read fallback
  }

  if (session) {
    redirect("/");
  }

  let users: DBUser[] = [];
  let machines: DBMachine[] = [];

  try {
    const [fetchedUsers, fetchedMachines] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          employeeId: true,
          role: true,
          department: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.machine.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          model: true,
          tonnage: true,
        },
        orderBy: { code: "asc" },
      }),
    ]);
    users = fetchedUsers;
    machines = fetchedMachines;
  } catch (err) {
    console.warn("Database connection notice on /login:", err);
  }

  return <LoginTerminalClient initialUsers={users} initialMachines={machines} />;
}
