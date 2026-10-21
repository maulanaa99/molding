import sqlite3
import datetime
import json

def to_ms(dt):
    return int(dt.timestamp() * 1000)

def seed_mc02():
    conn = sqlite3.connect('prisma/dev.db')
    c = conn.cursor()

    # 1. First, remove the previously inserted dummy runs on MC01 (runs 50, 51, 52, 53, 54, 55)
    print("Cleaning up dummy runs on MC01...")
    dummy_mc01_runs = [50, 51, 52, 53, 54, 55]
    for r_id in dummy_mc01_runs:
        c.execute("DELETE FROM ScanLog WHERE runId = ?", (r_id,))
        c.execute("DELETE FROM RunReject WHERE runId = ?", (r_id,))
        c.execute("DELETE FROM AuditLog WHERE entity = 'ProductionRun' AND entityId = ?", (r_id,))
        c.execute("DELETE FROM ProductionRun WHERE id = ?", (r_id,))

    # 2. Update parts with material
    print("Updating materials for parts...")
    c.execute("UPDATE Part SET material = 'ABS 3001M' WHERE id IN (151, 152);")
    c.execute("UPDATE Part SET material = 'ABS 3001M' WHERE id = 80;")
    c.execute("UPDATE Part SET material = 'PP T20' WHERE id = 81;")
    c.execute("UPDATE Part SET material = 'PMMA 830A' WHERE id = 82;")

    # Machine MC02 (id: 17)
    machine_id = 17
    operator_id = 8 # Ridwan
    qc_user_id = 2  # Syarip Hidayat (Supervisor / QC)

    today = datetime.date.today()
    print(f"Target date for MC02 dummy data: {today}")

    # Remove existing dummy runs on MC02 for today to allow clean re-runs
    # Today range in ms
    start_of_day_dt = datetime.datetime(today.year, today.month, today.day, 0, 0, 0)
    end_of_day_dt = datetime.datetime(today.year, today.month, today.day, 23, 59, 59, 999000)
    start_day_ms = to_ms(start_of_day_dt)
    end_day_ms = to_ms(end_of_day_dt)

    c.execute("""
        SELECT id FROM ProductionRun 
        WHERE machineId = ? AND (
            (startTime >= ? AND startTime <= ?) OR
            (startTime LIKE ?)
        )
    """, (machine_id, start_day_ms, end_day_ms, f"{today.strftime('%Y-%m-%d')}%"))
    old_run_ids = [row[0] for row in c.fetchall()]
    print("Existing runs on MC02 today to clean:", old_run_ids)
    for r_id in old_run_ids:
        c.execute("DELETE FROM ScanLog WHERE runId = ?", (r_id,))
        c.execute("DELETE FROM RunReject WHERE runId = ?", (r_id,))
        c.execute("DELETE FROM AuditLog WHERE entity = 'ProductionRun' AND entityId = ?", (r_id,))
        c.execute("DELETE FROM ProductionRun WHERE id = ?", (r_id,))

    # Ensure Kanbans exist for parts 151, 152, and 80
    for p_id in [151, 152, 80]:
        c.execute("SELECT id FROM Kanban WHERE partId = ? LIMIT 1", (p_id,))
        if not c.fetchone():
            c.execute("""
                INSERT INTO Kanban (code, partId, standardQty, currentTrollyNo, isActive)
                VALUES (?, ?, 100, 1, 1)
            """, (f"KB-{p_id}-01", p_id))

    c.execute("SELECT id FROM Kanban WHERE partId = 151 LIMIT 1")
    kb_rh_id = c.fetchone()[0]
    c.execute("SELECT id FROM Kanban WHERE partId = 152 LIMIT 1")
    kb_lh_id = c.fetchone()[0]
    c.execute("SELECT id FROM Kanban WHERE partId = 80 LIMIT 1")
    kb_80_id = c.fetchone()[0]

    # --- RUN 1: Family Mold SET mode (07:30 - 10:00) ---
    # Stopped at 10:00 with Mold Trouble (StopReason ID 18 = 'G: Kerusakan Mold')
    dt_r1_start = datetime.datetime(today.year, today.month, today.day, 7, 30, 0)
    dt_r1_stop = datetime.datetime(today.year, today.month, today.day, 10, 0, 0)
    ms_r1_start = to_ms(dt_r1_start)
    ms_r1_stop = to_ms(dt_r1_stop)

    c.execute("""
        INSERT INTO ProductionRun (
            machineId, partId, operatorId, shift, status, moldMode,
            remainderQty, qtyReject,
            startTime, stopTime, stopReasonId, notes
        ) VALUES (
            ?, 151, ?, 'Shift 1', 'STOPPED', 'SET',
            50, 6,
            ?, ?, 18, 'Terjadi kendala mold flashing pada cavity RH (Simbol G)'
        )
    """, (machine_id, operator_id, ms_r1_start, ms_r1_stop))
    run1_id = c.lastrowid
    print(f"Created Run 1 on MC02 (Family Mold SET, Stopped Mold Trouble G): ID {run1_id}")

    # Scans for Run 1
    # 08:15: Scan trolly 1 RH & LH (100 pcs each)
    ms_scan1 = to_ms(datetime.datetime(today.year, today.month, today.day, 8, 15, 0))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 100, ?, 0, ?)", (run1_id, kb_rh_id, ms_scan1, operator_id))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 100, ?, 0, ?)", (run1_id, kb_lh_id, ms_scan1, operator_id))

    # 09:20: Scan trolly 2 RH & LH (100 pcs each)
    ms_scan2 = to_ms(datetime.datetime(today.year, today.month, today.day, 9, 20, 0))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 100, ?, 0, ?)", (run1_id, kb_rh_id, ms_scan2, operator_id))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 100, ?, 0, ?)", (run1_id, kb_lh_id, ms_scan2, operator_id))

    # Rejects for Run 1:
    # DF-01 (Short Mold / Sute Short): 2 pcs
    # DF-02 (Silver): 1 pcs
    # DF-08 (Weld): 2 pcs
    # DF-07 (Scratch): 1 pcs
    ms_rj1 = to_ms(datetime.datetime(today.year, today.month, today.day, 8, 30, 0))
    ms_rj2 = to_ms(datetime.datetime(today.year, today.month, today.day, 8, 45, 0))
    ms_rj3 = to_ms(datetime.datetime(today.year, today.month, today.day, 9, 30, 0))
    ms_rj4 = to_ms(datetime.datetime(today.year, today.month, today.day, 9, 45, 0))

    c.execute("INSERT INTO RunReject (runId, defectTypeId, partId, qty, updatedAt) VALUES (?, 1, 151, 2, ?)", (run1_id, ms_rj1))
    c.execute("INSERT INTO RunReject (runId, defectTypeId, partId, qty, updatedAt) VALUES (?, 2, 151, 1, ?)", (run1_id, ms_rj2))
    c.execute("INSERT INTO RunReject (runId, defectTypeId, partId, qty, updatedAt) VALUES (?, 8, 152, 2, ?)", (run1_id, ms_rj3))
    c.execute("INSERT INTO RunReject (runId, defectTypeId, partId, qty, updatedAt) VALUES (?, 7, 152, 1, ?)", (run1_id, ms_rj4))

    # AuditLog for reject entry (tracks defect logging timestamp at hour 8 and hour 9)
    audit_new_val_h8 = json.dumps({
        "qtyReject": 3,
        "breakdown": [{"defectTypeId": 1, "qty": 2}, {"defectTypeId": 2, "qty": 1}]
    })
    ms_audit8 = to_ms(datetime.datetime(today.year, today.month, today.day, 8, 50, 0))
    c.execute("""
        INSERT INTO AuditLog (entity, entityId, action, oldValue, newValue, userId, createdAt)
        VALUES ('ProductionRun', ?, 'UPDATE_REJECTS', '{}', ?, ?, ?)
    """, (run1_id, audit_new_val_h8, qc_user_id, ms_audit8))

    audit_new_val_h9 = json.dumps({
        "qtyReject": 6,
        "breakdown": [{"defectTypeId": 1, "qty": 2}, {"defectTypeId": 2, "qty": 1}, {"defectTypeId": 8, "qty": 2}, {"defectTypeId": 7, "qty": 1}]
    })
    ms_audit9 = to_ms(datetime.datetime(today.year, today.month, today.day, 9, 50, 0))
    c.execute("""
        INSERT INTO AuditLog (entity, entityId, action, oldValue, newValue, userId, createdAt)
        VALUES ('ProductionRun', ?, 'UPDATE_REJECTS', '{}', ?, ?, ?)
    """, (run1_id, audit_new_val_h9, qc_user_id, ms_audit9))

    # --- RUN 2: Melanjutkan setelah mold diperbaiki (10:45 - 12:00) ---
    # Selesai Produksi (Target Tercapai, StopReason ID 100 = 'OK')
    dt_r2_start = datetime.datetime(today.year, today.month, today.day, 10, 45, 0)
    dt_r2_stop = datetime.datetime(today.year, today.month, today.day, 12, 0, 0)
    ms_r2_start = to_ms(dt_r2_start)
    ms_r2_stop = to_ms(dt_r2_stop)

    c.execute("""
        INSERT INTO ProductionRun (
            machineId, partId, operatorId, shift, status, moldMode,
            remainderQty, qtyReject,
            startTime, stopTime, stopReasonId, notes
        ) VALUES (
            ?, 151, ?, 'Shift 1', 'COMPLETED', 'SET',
            0, 0,
            ?, ?, 100, 'Target 400 Set tercapai sempurna setelah perbaikan mold.'
        )
    """, (machine_id, operator_id, ms_r2_start, ms_r2_stop))
    run2_id = c.lastrowid
    print(f"Created Run 2 on MC02 (Family Mold SET, Selesai Produksi OK): ID {run2_id}")

    # Scans for Run 2: final trolly (100 pcs each)
    ms_scan3 = to_ms(datetime.datetime(today.year, today.month, today.day, 11, 45, 0))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 100, ?, 0, ?)", (run2_id, kb_rh_id, ms_scan3, operator_id))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 100, ?, 0, ?)", (run2_id, kb_lh_id, ms_scan3, operator_id))

    # --- RUN 3: Part Reguler / Trial (13:00 - 15:30) ---
    # Part 80: 5D45W MARK NISSAN REAR (Trial Lot Material Baru)
    dt_r3_start = datetime.datetime(today.year, today.month, today.day, 13, 0, 0)
    dt_r3_stop = datetime.datetime(today.year, today.month, today.day, 15, 30, 0)
    ms_r3_start = to_ms(dt_r3_start)
    ms_r3_stop = to_ms(dt_r3_stop)

    c.execute("""
        INSERT INTO ProductionRun (
            machineId, partId, operatorId, shift, status, moldMode,
            remainderQty, qtyReject,
            startTime, stopTime, stopReasonId, notes
        ) VALUES (
            ?, 80, ?, 'Shift 1', 'COMPLETED', 'STANDARD',
            0, 3,
            ?, ?, 100, 'Trial molding resin lot baru (ABS 3001M grade B)'
        )
    """, (machine_id, operator_id, ms_r3_start, ms_r3_stop))
    run3_id = c.lastrowid
    print(f"Created Run 3 on MC02 (Trial Part 80, Setting TRY = OK): ID {run3_id}")

    # Scans for Run 3:
    ms_scan4 = to_ms(datetime.datetime(today.year, today.month, today.day, 14, 15, 0))
    ms_scan5 = to_ms(datetime.datetime(today.year, today.month, today.day, 15, 15, 0))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 250, ?, 0, ?)", (run3_id, kb_80_id, ms_scan4, operator_id))
    c.execute("INSERT INTO ScanLog (runId, kanbanId, qty, scannedAt, isVoid, scannedById) VALUES (?, ?, 250, ?, 0, ?)", (run3_id, kb_80_id, ms_scan5, operator_id))

    # Reject for Run 3 (Black Dot / Gosong: 3 pcs at jam 14)
    ms_rj5 = to_ms(datetime.datetime(today.year, today.month, today.day, 14, 30, 0))
    c.execute("INSERT INTO RunReject (runId, defectTypeId, qty, updatedAt) VALUES (?, 5, 3, ?)", (run3_id, ms_rj5))
    audit_new_val_h14 = json.dumps({
        "qtyReject": 3,
        "breakdown": [{"defectTypeId": 5, "qty": 3}]
    })
    ms_audit14 = to_ms(datetime.datetime(today.year, today.month, today.day, 14, 35, 0))
    c.execute("""
        INSERT INTO AuditLog (entity, entityId, action, oldValue, newValue, userId, createdAt)
        VALUES ('ProductionRun', ?, 'UPDATE_REJECTS', '{}', ?, ?, ?)
    """, (run3_id, audit_new_val_h14, qc_user_id, ms_audit14))

    conn.commit()
    conn.close()
    print("SUCCESS: Realistic dummy test data for MC02 successfully created!")

if __name__ == '__main__':
    seed_mc02()
