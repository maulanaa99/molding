import { NextResponse } from "next/server";
import { autoSeedInitialData } from "@/lib/seedHelper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await autoSeedInitialData();
    return NextResponse.json({
      success: true,
      message: "Data awal (5 User, 15 Mesin MC01-MC15, Alasan Stop) berhasil didaftarkan ke Supabase!",
      loginUrl: "/login",
      defaultAccounts: [
        { role: "ADMIN", employeeId: "ADM01", name: "Admin MMS", defaultPin: "1234" },
        { role: "SUPERVISOR", employeeId: "SPV01", name: "Syarip Hidayat", defaultPin: "1234" },
        { role: "PLANNER", employeeId: "PLN01", name: "Saifudin", defaultPin: "1234" },
        { role: "OPERATOR", employeeId: "OPR01", name: "Ahmad Dani", defaultPin: "1234" },
        { role: "OPERATOR", employeeId: "OPR02", name: "Budi Santoso", defaultPin: "1234" },
      ],
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: (err as Error)?.message || "Gagal melakukan seeding data",
      },
      { status: 500 }
    );
  }
}

