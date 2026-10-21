import { NextResponse } from "next/server";
import { loginWithPin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, pin } = body;

    if (!employeeId || !pin) {
      return NextResponse.json(
        { success: false, error: "NIK dan PIN wajib diisi." },
        { status: 400 }
      );
    }

    const result = await loginWithPin(employeeId, pin);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
