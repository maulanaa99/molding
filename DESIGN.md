# Design Direction: MMS Molding Management System

## Identity & Purpose
- **System Name:** MMS (Molding Management System)
- **Domain:** Lantai produksi injection molding (15 mesin IMM-01 s/d IMM-15)
- **Audience:** Operator mesin (touch-first pada tablet/HP), supervisor lapangan, dan admin pabrik.

## Personality & Aesthetic
- **Character:** Industrial utilitarian, kokoh, fokus efisiensi lantai pabrik, tanpa distraksi.
- **Mood:** Sederhana, fungsionalitas tinggi, tombol besar touch-friendly (bisa ditekan cepat atau dengan sarung tangan), visual kontras tinggi agar terbaca dari jarak kerja.

## Dials
- **ENERGY:** 1 (Calm, utilitarian, fungsional)
- **RHYTHM:** 1 (Seragam, terstruktur, grid status mesin konsisten dan mudah dipindai)
- **MOTION:** 1 (Hover/tap feedback instan, tanpa animasi lambat yang menghambat pekerjaan)

## Palette (2-3 Core + 1 Deliberate Accent)
- **Backgrounds:** Off-white (`#f8fafc`), light industrial slate (`#f1f5f9`), panel white (`#ffffff`).
- **Surface / Borders:** Industrial slate border (`#cbd5e1`, `#94a3b8`), text dark slate (`#0f172a`, `#334155`).
- **Core Accent:** Precision Blue (`#0284c7`, hover `#0369a1`) untuk aksi primer, navigasi, dan seleksi aktif.
- **Machine & Production Status Colors (High Contrast):**
  - **RUNNING:** Industrial Green (`#16a34a` / text `#15803d` / bg `#dcfce7`)
  - **DOWN / STOP:** Industrial Red (`#dc2626` / text `#b91c1c` / bg `#fee2e2`)
  - **IDLE / CHANGEOVER:** Industrial Amber / Slate (`#d97706` / text `#b45309` / bg `#fef3c7`)

## Typography
- **Font Family:** Clean industrial sans-serif (`system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`).
- **Tabular Numbers:** Wajib untuk semua timer durasi, hitungan trolly, counter pcs, target, dan efisiensi (`tabular-nums font-mono`).
- **Readability:** Hierarchy tegas, label kontras tinggi, terbaca jelas pada layar tablet jarak 50 cm.

## Interaction & Touch Target
- **Touch-first:** Tombol aksi utama (START, STOP, SCAN KANBAN) memiliki tinggi minimal 48px-56px dengan target tap luas.
- **Safety Dialogs:** Dialog konfirmasi tegas untuk STOP (wajib isi alasan stop) dan Void Scan.
- **States:** Setiap modul memiliki 3 state lengkap: Loading, Empty, dan Error.
