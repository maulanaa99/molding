import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginTerminalClient from "./LoginTerminalClient";

export const metadata = {
  title: "Operator Check-in - MMS Terminal",
  description: "Touch Terminal Authentication & Workstation Control",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  const [users, machines] = await Promise.all([
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

  return <LoginTerminalClient initialUsers={users} initialMachines={machines} />;
}
