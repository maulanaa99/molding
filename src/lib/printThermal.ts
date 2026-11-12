"use client";

// ============================================================
// printKanbanCard — cetak kartu lewat halaman terisolasi (iframe)
//
// Cara pakai (ganti window.print() pada tombol "Cetak Label Kanban"):
//   <button onClick={() => printKanbanCard("kanban-trolley-card")}>
//     Cetak Label Kanban (Print)
//   </button>
//
// Opsi (semua dalam mm):
//   widthMm / heightMm   : ukuran kartu landscape            (default 95 x 65)
//   rotate               : "cw"  = diputar 90° searah jarum jam (judul di kanan) [default]
//                          "ccw" = diputar 90° berlawanan jarum jam (judul di kiri)
//                          "none"= tidak diputar (printer label landscape)
//   paperWidthMm         : lebar kertas roll                  (default 80)
//   printableWidthMm     : lebar area cetak printer           (default 72, Epson TM-T82II 80mm)
//   scale                : paksa skala tertentu (opsional; default = otomatis memenuhi lebar cetak)
//
// Mode "cw"/"ccw": kartu diputar lalu DIPERBESAR otomatis agar mengisi lebar cetak
// (72mm / 65mm = 1,108x), dan diletakkan di tengah kertas 80mm.
// ============================================================
export interface PrintKanbanCardOptions {
  widthMm?: number;
  heightMm?: number;
  rotate?: "cw" | "ccw" | "none";
  paperWidthMm?: number;
  printableWidthMm?: number;
  scale?: number;
}

export async function printKanbanCard(
  elementId: string = "kanban-trolley-card",
  options: PrintKanbanCardOptions = {}
) {
  if (typeof window === "undefined") return;

  const {
    widthMm = 95,
    heightMm = 65,
    rotate = "cw",
    paperWidthMm = 80,
    printableWidthMm = 72,
  } = options;

  const card = document.getElementById(elementId);
  if (!card) {
    console.error(`printKanbanCard: elemen #${elementId} tidak ditemukan`);
    return;
  }

  // --- hitung skala, ukuran halaman, dan transform ---
  const rotated = rotate !== "none";
  const s = options.scale ?? (rotated ? printableWidthMm / heightMm : 1);
  const contentW = (rotated ? heightMm : widthMm) * s;
  const contentH = (rotated ? widthMm : heightMm) * s;
  const pageW = rotated ? paperWidthMm : contentW;
  const pageH = contentH;
  const offsetX = rotated ? (paperWidthMm - contentW) / 2 : 0;
  const f = (n: number) => Number(n.toFixed(3));

  let transform = `scale(${f(s)})`;
  if (rotate === "cw")
    transform = `translate(${f(offsetX)}mm, 0) scale(${f(s)}) translateX(${heightMm}mm) rotate(90deg)`;
  if (rotate === "ccw")
    transform = `translate(${f(offsetX)}mm, 0) scale(${f(s)}) translateY(${widthMm}mm) rotate(-90deg)`;

  // --- iframe di luar layar (bukan 0x0, supaya pengukuran font akurat) ---
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${f(pageW)}mm;height:${f(pageH)}mm;border:0;`;
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    window.print();
    return;
  }
  const doc = win.document;
  doc.open();
  doc.write("<!doctype html><html><head><meta charset='utf-8'><title>Kanban Trolly</title></head><body></body></html>");
  doc.close();

  // salin semua stylesheet aplikasi (Tailwind, font, dll.)
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
    doc.head.appendChild(n.cloneNode(true));
  });

  // CSS cetak dipasang TERAKHIR + !important agar mengalahkan CSS print global aplikasi
  const style = doc.createElement("style");
  style.textContent = `
    @page { size: ${f(pageW)}mm ${f(pageH)}mm; margin: 0; }
    html, body {
      margin: 0 !important; padding: 0 !important; background: #fff !important;
      width: ${f(pageW)}mm; height: ${f(pageH - 0.1)}mm; overflow: hidden;
    }
    body * { visibility: visible !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #kanban-print-sheet { position: relative; width: ${f(pageW)}mm; height: ${f(pageH - 0.1)}mm; overflow: hidden; }
    #kanban-print-sheet > * {
      position: absolute !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important;
      margin: 0 !important; box-shadow: none !important;
      width: ${widthMm}mm !important; height: ${heightMm}mm !important;
      transform-origin: 0 0 !important; transform: ${transform} !important;
    }
  `;
  doc.head.appendChild(style);

  // salin kartu
  const sheet = doc.createElement("div");
  sheet.id = "kanban-print-sheet";
  const clone = card.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  sheet.appendChild(clone);
  doc.body.appendChild(sheet);

  // --- tunggu stylesheet, gambar (QR), dan font selesai dimuat ---
  const waits: Promise<unknown>[] = [];
  doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((l) => {
    waits.push(new Promise((res) => { l.onload = l.onerror = res; }));
  });
  Array.from(doc.images).forEach((img) => {
    if (!img.complete) waits.push(new Promise((res) => { img.onload = img.onerror = res; }));
  });
  await Promise.all(waits);
  if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
  await new Promise((r) => setTimeout(r, 100));

  // --- hitung ulang ukuran font di halaman cetak (font terbesar yang masih muat) ---
  clone.querySelectorAll<HTMLElement>("[data-fit-max]").forEach((el) => {
    const max = parseFloat(el.dataset.fitMax || "0");
    const min = parseFloat(el.dataset.fitMin || "0");
    let size = max;
    el.style.fontSize = `${size}pt`;
    if (!el.clientWidth) return;
    const fits = () => el.scrollWidth <= el.clientWidth * 0.97 && el.scrollHeight <= el.clientHeight + 1;
    while (size > min && !fits()) {
      size -= 0.25;
      el.style.fontSize = `${size}pt`;
    }
  });

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  win.onafterprint = cleanup;
  win.focus();
  win.print();
  setTimeout(cleanup, 60000); // cadangan jika afterprint tidak terpanggil
}

// Backward-compatibility alias
export const printThermalKanbanElement = (elementId: string = "kanban-trolley-card") => printKanbanCard(elementId);
