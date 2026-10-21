"use server";

import { loginWithPin, logoutUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export interface LoginState {
  error?: string;
  success?: boolean;
}

export async function loginAction(prevState: LoginState | null, formData: FormData): Promise<LoginState> {
  const employeeId = formData.get("employeeId") as string;
  const pin = formData.get("pin") as string;

  if (!employeeId || !employeeId.trim()) {
    return { error: "Silakan masukkan NIK / ID Karyawan." };
  }

  if (!pin || !pin.trim()) {
    return { error: "Silakan masukkan PIN keamanan." };
  }

  const result = await loginWithPin(employeeId, pin);

  if (!result.success) {
    return { error: result.error || "Gagal masuk." };
  }

  redirect("/");
}

export async function quickLoginAction(employeeId: string, pin: string = "1234") {
  const result = await loginWithPin(employeeId, pin);
  if (!result.success) {
    return { error: result.error || "Gagal masuk." };
  }
  redirect("/");
}

export async function handleLogout() {
  await logoutUser();
  redirect("/login");
}
