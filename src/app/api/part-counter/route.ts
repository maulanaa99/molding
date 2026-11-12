import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

interface CountEntry {
  in?: number;
  out?: number;
}

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const logs = await prisma.partCounterLog.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("[GET /api/part-counter] error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data counter part" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const counts = (body?.counts ?? {}) as Record<string, CountEntry>;
    const machineCode = typeof body?.machineCode === "string" && body.machineCode.trim()
      ? body.machineCode.trim()
      : null;
    const partNo = typeof body?.partNo === "string" && body.partNo.trim()
      ? body.partNo.trim()
      : null;
    const partName = typeof body?.partName === "string" && body.partName.trim()
      ? body.partName.trim()
      : null;
    const notes = typeof body?.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId wajib diisi" }, { status: 400 });
    }

    const entries = Object.entries(counts).filter(([, val]) => {
      const cIn = Number(val?.in || 0);
      const cOut = Number(val?.out || 0);
      return cIn > 0 || cOut > 0;
    });

    if (entries.length === 0) {
      return NextResponse.json({ success: true, data: [], message: "Belum ada hitungan untuk disimpan" });
    }

    const saved = await prisma.$transaction(
      entries.map(([itemLabel, val]) => {
        const countIn = Math.max(0, Math.floor(Number(val?.in || 0)));
        const countOut = Math.max(0, Math.floor(Number(val?.out || 0)));
        const totalQty = countIn + countOut;

        return prisma.partCounterLog.upsert({
          where: {
            sessionId_itemLabel: {
              sessionId,
              itemLabel,
            },
          },
          update: {
            countIn,
            countOut,
            totalQty,
            machineCode,
            partNo,
            partName,
            operatorId: user.id,
            operatorName: user.name,
            notes,
          },
          create: {
            sessionId,
            itemLabel,
            countIn,
            countOut,
            totalQty,
            machineCode,
            partNo,
            partName,
            operatorId: user.id,
            operatorName: user.name,
            notes,
          },
        });
      })
    );

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("[POST /api/part-counter] error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan hitungan ke database" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const idParam = req.nextUrl.searchParams.get("id");
    const id = Number(idParam);
    if (!idParam || Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });
    }

    await prisma.partCounterLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/part-counter] error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus data log" },
      { status: 500 }
    );
  }
}

