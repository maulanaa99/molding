import { NextRequest, NextResponse } from "next/server";
import { getDailyMachineReportData } from "@/lib/actions";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const machineIdStr = searchParams.get("machineId");
    const dateStr = searchParams.get("date") || undefined;

    if (!machineIdStr) {
      return NextResponse.json(
        { success: false, error: "Parameter machineId wajib disertakan" },
        { status: 400 }
      );
    }

    const machineId = parseInt(machineIdStr, 10);
    const res = await getDailyMachineReportData(machineId, dateStr);

    if (!res.success || !res.data) {
      return NextResponse.json(
        { success: false, error: res.error || "Gagal mengambil data laporan" },
        { status: 500 }
      );
    }

    const reportData = res.data;
    const templatePath = path.join(process.cwd(), "contoh laporan harian molding.xlsx");

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { success: false, error: "Template file 'contoh laporan harian molding.xlsx' tidak ditemukan." },
        { status: 500 }
      );
    }

    // Temporary output file
    const tempFileName = `laporan_${reportData.machine.code}_${Date.now()}.xlsx`;
    const tempOutputPath = path.join(os.tmpdir(), tempFileName);

    const pythonScript = path.join(process.cwd(), "scripts", "generate_molding_report.py");

    const inspector1 = searchParams.get("inspector1") || reportData.inspectors?.inspector1 || "";
    const inspector2 = searchParams.get("inspector2") || reportData.inspectors?.inspector2 || "";
    const leader = searchParams.get("leader") || reportData.leader || "";
    const deptHead = searchParams.get("deptHead") || reportData.deptHead || "";
    const operatorName = searchParams.get("operator") || reportData.operators.join(", ") || "-";

    // Execute Python script
    await new Promise<void>((resolve, reject) => {
      const py = spawn("python", [pythonScript, templatePath, tempOutputPath]);

      py.stdin.write(
        JSON.stringify({
          machineCode: reportData.machine.code,
          machineTonnage: `${reportData.machine.tonnage}T`,
          dateStr: reportData.dateStr,
          operatorName,
          inspector1,
          inspector2,
          leader,
          deptHead,
          shift: reportData.shift,
          parts: reportData.parts,
          hourly: reportData.hourly,
          abnormalNotes: reportData.abnormalNotes,
        })
      );
      py.stdin.end();

      py.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python process exited with code ${code}`));
        }
      });

      py.on("error", (err) => {
        reject(err);
      });
    });

    if (!fs.existsSync(tempOutputPath)) {
      return NextResponse.json(
        { success: false, error: "File Excel gagal digenerate" },
        { status: 500 }
      );
    }

    const fileBuffer = fs.readFileSync(tempOutputPath);

    // Clean up temporary file
    try {
      fs.unlinkSync(tempOutputPath);
    } catch {
      // ignore
    }

    const safeDate = (reportData.dateIso || "today").replace(/[^a-zA-Z0-9-]/g, "_");
    const downloadName = `Laporan_Harian_Molding_${reportData.machine.code}_${safeDate}.xlsx`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
