"use client";

// ============================================================
// printDailyMachineReport — cetak formulir Laporan Harian Mesin (FO/MLD/009 Rev.08)
// ke ukuran A4 Landscape penuh (297mm x 210mm) tanpa terpotong dan tanpa mengecil.
// Menggunakan sintaks standar W3C @page { size: A4 landscape; }
// sehingga dialog print browser otomatis terbuka dalam mode Landscape
// dan mengisi 100% lebar kertas.
// ============================================================

export interface PrintDailyReportOptions {
  title?: string;
}

export async function printDailyMachineReport(
  elementId: string = "daily-machine-report-sheet",
  options: PrintDailyReportOptions = {}
) {
  if (typeof window === "undefined") return;

  const sheet = document.getElementById(elementId);
  if (!sheet) {
    console.error(`printDailyMachineReport: elemen #${elementId} tidak ditemukan`);
    window.print();
    return;
  }

  const { title = "Laporan_Harian_Mesin_Molding_FO_MLD_009" } = options;

  // 1. Buat iframe terisolasi
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;z-index:-9999;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    window.print();
    return;
  }

  const doc = win.document;
  doc.open();
  doc.write(
    `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body></body>
</html>`
  );
  doc.close();

  // 2. Salin link stylesheet parent (Tailwind, fonts)
  document.querySelectorAll('link[rel="stylesheet"]').forEach((linkNode) => {
    try {
      doc.head.appendChild(linkNode.cloneNode(true));
    } catch {
      // Abaikan jika tidak dapat diclone
    }
  });

  // Salin tag <style> parent kecuali yang berisi aturan @page print khusus
  document.querySelectorAll("style").forEach((styleNode) => {
    try {
      if (!styleNode.textContent?.includes("@page")) {
        doc.head.appendChild(styleNode.cloneNode(true));
      }
    } catch {
      // Abaikan
    }
  });

  // 3. Tambahkan style cetak A4 Landscape presisi W3C
  // Menggunakan size: A4 landscape dan size: landscape agar Chrome & Edge otomatis Landscape
  const printStyle = doc.createElement("style");
  printStyle.textContent = `
    @page {
      size: A4 landscape;
      margin: 4mm 5mm;
    }
    @page {
      size: landscape;
      margin: 4mm 5mm;
    }
    @media print {
      @page {
        size: A4 landscape;
        margin: 4mm 5mm;
      }
      @page {
        size: landscape;
        margin: 4mm 5mm;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 11px;
      line-height: 1.2;
      overflow: visible !important;
    }
    #${elementId} {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: #ffffff !important;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      break-inside: avoid !important;
    }
    /* Sembunyikan elemen kontrol yang tidak perlu tercetak */
    button, .no-print {
      display: none !important;
    }
    table {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      border-collapse: collapse !important;
      width: 100% !important;
    }
    tr, th, td {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  `;
  doc.head.appendChild(printStyle);

  // 4. Kloning sheet dan sinkronkan nilai input/textarea ke dalam klon
  const clone = sheet.cloneNode(true) as HTMLElement;

  // Hapus class pembatas layar (max-w-5xl, margin auto, padding modal) agar memenuhi 100% landscape
  clone.classList.remove("max-w-5xl", "p-3", "sm:p-5", "rounded-xl", "shadow-md", "mx-auto");
  clone.style.width = "100%";
  clone.style.maxWidth = "100%";
  clone.style.minWidth = "100%";
  clone.style.margin = "0";
  clone.style.padding = "0";

  // Tangkap nilai input asli (Dept Head, Leader, Inspektor, Operator, dll.)
  // dan ganti input di clone menjadi teks statis yang rapi agar tidak menyisakan border input
  const origInputs = sheet.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  const cloneInputs = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");

  origInputs.forEach((orig, idx) => {
    const val = orig.value || orig.getAttribute("value") || "";
    const target = cloneInputs[idx];
    if (target) {
      const span = doc.createElement("span");
      span.textContent = val || "-";
      span.className = target.className;
      span.style.cssText =
        "display:inline-block;width:100%;text-align:center;font-weight:700;color:#0f172a;background:transparent;";
      target.parentNode?.replaceChild(span, target);
    }
  });

  doc.body.appendChild(clone);

  // 5. Tunggu font dan resource selesai termuat
  const waits: Promise<unknown>[] = [];
  doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((l) => {
    waits.push(
      new Promise((res) => {
        l.onload = l.onerror = res;
      })
    );
  });
  Array.from(doc.images).forEach((img) => {
    if (!img.complete) {
      waits.push(
        new Promise((res) => {
          img.onload = img.onerror = res;
        })
      );
    }
  });
  await Promise.all(waits);
  if (doc.fonts && doc.fonts.ready) {
    await doc.fonts.ready;
  }
  await new Promise((r) => setTimeout(r, 150));

  // 6. Jalankan dialog cetak
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win.onafterprint = cleanup;
  win.focus();
  win.print();
  setTimeout(cleanup, 120000);
}
