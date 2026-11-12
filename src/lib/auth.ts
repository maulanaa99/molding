import { prisma } from "./prisma";
import { UserSession, setSession, clearSession } from "./session";

export * from "./session";

export async function loginWithPin(employeeId: string, pin: string) {
  const cleanId = employeeId.trim().toUpperCase();
  const user = await prisma.user.findUnique({
    where: { employeeId: cleanId },
  });

  if (!user || !user.isActive) {
    return { success: false, error: `Karyawan dengan NIK "${cleanId}" tidak ditemukan atau tidak aktif.` };
  }

  // PIN check (default PIN di seed: 1234)
  if (user.pinHash && user.pinHash !== pin.trim()) {
    return { success: false, error: "PIN keamanan salah. Silakan coba lagi." };
  }

  const session: UserSession = {
    id: user.id,
    name: user.name,
    employeeId: user.employeeId,
    role: user.role,
  };

  await setSession(session);
  return { success: true, user: session };
}

export async function logoutUser() {
  await clearSession();
  return { success: true };
}
