<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Context & Architecture Memory

### Core Technology Stack
- Next.js (App Router), TypeScript, Tailwind CSS, Prisma ORM.
- Local dev server runs in the background on port 3000 (`http://localhost:3000`).

### Core Architecture & Key Files
- `src/lib/actions.ts`: Core server actions (`startProductionRun`, `finishProductionRun`, `stopProductionRun`, `scanKanban`, `createNgLog`, production planning CRUD, master data).
- `src/components/MachineControlModal.tsx`: Operator interface for running/stopping machines, scanning trolleys, selecting mold mode, and recording NG.
- `src/components/ProductionPlanningView.tsx`: PPIC interface for scheduling runs, setting targets, assigning operators, and defining mold modes.
- `src/components/MachineCard.tsx`: Real-time machine dashboard cards, status indicators, and live run metrics.
- `src/components/MMSMainApp.tsx`: Main dashboard coordinator managing active machine states, modals, and auto-refresh.
- `prisma/schema.prisma`: Schema models (`Machine`, `Part`, `ProductionRun`, `ScanLog`, `ProductionPlan`, `NgLog`, `User`).

### Critical Business Rules
- **Family Mold (LH & RH)**:
  - Linked parts have `pairPartId` (e.g. LH and RH pairs).
  - Target Planning: Target 400 Set = **400 pcs LH + 400 pcs RH** (membutuhkan 400 shot cetakan, total 800 pcs). Bukan 200 LH + 200 RH.
  - Sisa Trolly Scan: Perhitungan sisa target non-full trolly dihitung independen per sisi part yang di-scan (LH vs RH) terhadap target set.
  - Selesai Produksi: Plan dinyatakan selesai saat kedua sisi (LH dan RH) telah memenuhi target set.
  - When selecting an LH part: choices are strictly `SET` (1 shot = 1 LH + 1 RH, Cavity: 2) or `SINGLE_LH` (Cavity: 1, RH cavity closed).
  - When selecting an RH part: choices are strictly `SET` or `SINGLE_RH` (Cavity: 1, LH cavity closed).
  - In `SINGLE` mode, kanban scanning strictly accepts only the active part and rejects the opposite side.
- **Multi-Cavity Reguler (Bukan Family Mold)**:
  - Contoh: `5D45W MARK NISSAN REAR` (Cavity: 2, menghasilkan 2 pcs part yang SAMA PERSIS dalam 1 kali shot).
  - Part ini **TIDAK memiliki pasangan** (`pairPartId = null`).
  - Opsi pilihan mode Family Mold (Set / Single) **tidak muncul**.
  - Target diisi dalam satuan pcs biasa, dan jumlah shot cetakan dihitung otomatis: `Target ÷ Cavity` (misal target 1.000 pcs butuh 500 shot).
- **Family Mold Scanner Alarm & Anti-Lupa**:
  - Pada modal Scan Kanban Trolly, target dan trolly sisa dievaluasi independen per sisi (LH vs RH).
  - Tombol sisi menampilkan badge progres (misal LH: 100% Lengkap vs RH: Belum).
  - Jika satu sisi sudah mencapai target (misal LH 200 pcs) tapi sisi pasangannya belum, scanner otomatis mengarahkan ke sisi yang belum selesai.
  - Jika operator memilih sisi yang sudah lengkap, alarm audio (buzzer) dan visual (banner merah berkedip) berbunyi untuk mengingatkan agar tidak lupa menginput sisi pasangannya.
- **Trolley / Kanban Scanning**:
  - Automatic calculation for non-full final trolleys based on remaining target quantity.
  - Anti-duplicate scan cooldown (10 seconds) prevents accidental double-tap scans.
- **Master Part Management & CSV Overwrite**:
  - Single Part CRUD: Dilakukan langsung via tombol "+ Tambah Part Baru" atau tombol "Edit" di tabel `MasterDataView.tsx`.
  - CSV Import & Overwrite: Parser di `src/lib/actions.ts` (`importPartsWithRelationsFromCsv`) mendukung delimiter koma (`,`) dan titik koma (`;` dari Excel Indonesia), RFC 4180 parsing untuk tanda kutip nama part yang ada koma, pemetaan header dinamis, dan sinkronisasi relasi mesin secara otomatis.
  - Live Data Export: Tombol "Unduh Data Live (CSV)" mengekspor seluruh master part aktif saat ini dalam format CSV siap edit untuk di-upload kembali.
  - Live State: `MMSMainApp.tsx` mengelola `liveMasterData` di state React agar perubahan part langsung ter-update di antarmuka tanpa perlu reload browser.
  - Multi-Machine Auto-Grouping: Saat CSV memiliki baris ganda untuk part yang sama dengan mesin berbeda (misal baris 1 di `MC01` dan baris lain di `MC02`), parser otomatis menggabungkan relasi mesin (`MachinePart`) sehingga part tersebut dapat diproses di kedua mesin sekaligus (`targetMachineIds` digabung).
- **Hak Akses Hapus Data Produksi Mesin (Admin Only)**:
  - Hanya pengguna dengan `role === "ADMIN"` yang memiliki izin untuk menghapus data produksi mesin (`deleteMachineProductionData`), menghapus run individu (`deleteProductionRun`), dan membatalkan scan trolly (`voidScan`).
  - Operator, Supervisor, dan Planner tidak memiliki akses ini. Tombol penghapusan data produksi disembunyikan dari antarmuka mereka, dan server action memverifikasi role secara ketat dengan penolakan akses dan pencatatan audit log jika dilanggar.
- **Pencarian Part per Mesin dengan TomSelect & Fitur Clear**:
  - Pemilihan part pada kontrol modal mesin (`MachineControlModal.tsx`) dan perencanaan produksi PPIC (`ProductionPlanningView.tsx`) menggunakan komponen `TomSelectInput` dengan integrasi live-search (pencarian instan berdasarkan kode part, nama part, cavity, dan cycle time).
  - Dilengkapi fitur Clear ganda: tombol plugin clear bawaan TomSelect (icon silang) dan tombol aksi cepat "Bersihkan (Clear)" di sisi label untuk mengosongkan pilihan secara instan.
  - Saat part dikosongkan/clear, tombol mulai produksi otomatis non-aktif dengan status "SILAKAN PILIH PART TERLEBIH DAHULU".
- **Laporan Harian Standar Mesin Molding (Form FO/MLD/009 Rev.08)**:
  - Mengikuti format standar dokumen pabrik: *Catatan proses / laporan penanganan abnormal* (`FO/MLD/009 Rev.08`).
  - **Setting Awal & Setting Akhir**: Setting awal diambil dari waktu klik START mesin (`run.startTime`, format `HH:mm`), dan setting akhir diambil dari waktu penekanan STOP (`run.stopTime`, format `HH:mm`, atau "Jalan" jika masih aktif).
  - **Total Waktu (Jam)**: `(Setting Akhir - Setting Awal)` dalam satuan jam desimal.
  - **Waktu Produksi (Jam)**: `(Jumlah Qty OK × CycleTime) ÷ Cavity ÷ 3600`.
  - **Stop / Waktu Berhenti (Jam)**: Dihitung sesuai formula standar lembar kerja pabrik (`Total Waktu = Waktu Produksi + Waktu Berhenti`), yaitu `Waktu Berhenti (Stop) = Total Waktu - Waktu Produksi` (bukan angka perkiraan/dummy).
  - **Katalog Kode & Simbol Sebab Stop (A s/d N)**: A = Cek sheet harian/mingguan, B = Kerusakan Auto Loader, C = Meeting, D = Pengangkutan, E = Material Habis, F = Masalah Qualitas, G = Kerusakan Mold, H = Kerusakan Mesin, I = Kerusakan Robot, J = Ganti Material, K = Ganti Dies/Setting Robot, L = Kerusakan Dryer, M = Kondisi Lain, N = Dies Belum diganti.
  - **Katalog Kode & Simbol Sebab Lambat / Delay (Q s/d Y)**: Q = 5S, R = Meeting , Training, S = Pengecekan alat, T = Tidak ada trolly, U = Makan, V = Trial, W = Sesuai Intruksi, X = Listrik mati, Y = Pengecekan Qualitas.
  - **Selesai Produksi**: OK = Selesai Produksi (Target Tercapai), CHG = Selesai Produksi (Ganti Part / Job Baru).
  - **Pemetaan Timeline 24 Jam**: Shift 1, 2, dan 3 berurutan dari jam 07:00 hingga 06:00 pagi berikutnya. Setiap jam memetakan menit jalan, keterlambatan (delay menit) beserta simbol sebab lambat (Q s/d Y), waktu berhenti (stop menit) beserta simbol sebab stop (A s/d N), jumlah qty diperiksa, dan 7 kategori cacat/NG (Sute Short, Silver, Short, Weld, Cekung, Benda Asing, Scratch).
  - **Generator Excel Berbasis Template Asli**: `scripts/generate_molding_report.py` menginjeksi data langsung ke OpenXML `sheet1.xml` dari template `contoh laporan harian molding.xlsx` menggunakan pustaka standar Python (`zipfile` & `xml.etree.ElementTree`), mempertahankan 100% tata letak, border tebal/tipis, font, formula, dan kop persetujuan manajemen (Disetujui, Diperiksa, Inspektor 1, Inspektor 2, Dibuat).
  - **Endpoint Unduhan Excel**: `GET /api/export-daily-report?machineId={id}&date={YYYY-MM-DD}` mengalirkan file `.xlsx` siap pakai.
  - **Web Preview & Cetak Siap Pakai**: Komponen `DailyMachineReportModal.tsx` menampilkan formulir visual presisi tinggi, pilihan mesin & tanggal kalender, tombol Cetak A4 Landscape (`window.print()`), dan tombol Unduh Excel langsung.
- **Poka-Yoke Wajib Scan Sebelum Next Proses**:
  - Jika part yang diproses sebelumnya pada suatu mesin belum memiliki catatan kuantiti scan trolly (atau input sisa part > 0), operator **tidak dapat beralih ke next proses / part berikutnya**.
  - Server action `startRun` memvalidasi riwayat run terakhir pada mesin: jika operator mencoba memulai part atau job rencana yang berbeda (`isNextProcess`) sementara part sebelumnya memiliki kuantiti 0, server menolak dengan pesan error.
  - Modal kontrol mesin (`MachineControlModal.tsx`) mendeteksi kondisi ini secara instan: menampilkan banner peringatan merah berlatar jelas dan mengunci tombol "START JOB PLANNING" serta tombol "MULAI PRODUKSI MANUAL" dengan label `"TERKUNCI: SCAN PART SEBELUMNYA ({partNo}) DAHULU"`.
  - Pada modal stop mesin (`StopReasonModal.tsx` & server action `stopRun`), jika operator memilih alasan kategori "Selesai Produksi" (OK / CHG) sementara kuantiti scan dan sisa part masih 0, sistem menolak penyelesaian job untuk mencegah job ditutup tanpa ada catatan hasil produksi.
  - Operator tetap diizinkan memulai part yang sama untuk melanjutkan proses dan men-scan trolly kanban.


