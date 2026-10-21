import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./prisma";

export interface UserSession {
  id: number;
  name: string;
  employeeId: string;
  role: string; // 'ADMIN' | 'SUPERVISOR' | 'PLANNER' | 'OPERATOR'
}

const SESSION_SECRET = process.env.AUTH_SECRET || "mms-molding-traceability-secret-2026-key";
export const COOKIE_NAME = "mms_session";

export function signToken(payload: object): string {
  const json = JSON.stringify(payload);
  const base64Payload = Buffer.from(json).toString("base64url");
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(base64Payload).digest("base64url");
  return `${base64Payload}.${hmac}`;
}

export function verifyToken<T>(token: string): T | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [base64Payload, signature] = parts;
    if (!base64Payload || !signature) return null;
    const expectedHmac = crypto.createHmac("sha256", SESSION_SECRET).update(base64Payload).digest("base64url");
    if (
      signature.length === expectedHmac.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))
    ) {
      const json = Buffer.from(base64Payload, "base64url").toString("utf-8");
      return JSON.parse(json) as T;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;
    const payload = verifyToken<UserSession & { exp?: number }>(cookie.value);
    if (!payload) return null;
    if (payload.exp && Date.now() > payload.exp) return null;
    return {
      id: payload.id,
      name: payload.name,
      employeeId: payload.employeeId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function setSession(user: UserSession): Promise<void> {
  const token = signToken({
    id: user.id,
    name: user.name,
    employeeId: user.employeeId,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

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
