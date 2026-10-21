import zipfile
import xml.etree.ElementTree as ET
import re
import json
import sys
import os

def generate_report(template_path, output_path, data):
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at {template_path}")

    with zipfile.ZipFile(template_path, 'r') as z_in:
        sheet_xml_raw = z_in.read('xl/worksheets/sheet1.xml').decode('utf-8')
        orig_root_tag_match = re.search(r'<worksheet[^>]*>', sheet_xml_raw)
        orig_root_tag = orig_root_tag_match.group(0) if orig_root_tag_match else '<worksheet>'

        ET.register_namespace('', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
        ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        tree = ET.fromstring(sheet_xml_raw.encode('utf-8'))
        ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        sheetData = tree.find('.//sheetData', ns)

        def set_cell(ref, text_val, is_num=False, formula_val=None, style_id=None):
            row_num = ''.join([c for c in ref if c.isdigit()])
            row = None
            for r in sheetData.findall('row', ns):
                if r.attrib.get('r') == row_num:
                    row = r
                    break
            if row is None:
                return

            c = None
            for cell in row.findall('c', ns):
                if cell.attrib.get('r') == ref:
                    c = cell
                    break
            if c is None:
                c = ET.SubElement(row, 'c')
                c.attrib['r'] = ref

            for child in list(c):
                c.remove(child)

            if style_id is not None:
                c.attrib['s'] = str(style_id)

            if formula_val is not None:
                c.attrib['t'] = 'str'
                f = ET.SubElement(c, 'f')
                f.text = str(formula_val)
                v = ET.SubElement(c, 'v')
                v.text = str(text_val)
            elif is_num:
                if 't' in c.attrib:
                    del c.attrib['t']
                v = ET.SubElement(c, 'v')
                v.text = str(text_val)
            elif text_val == '' or text_val is None:
                if 't' in c.attrib:
                    del c.attrib['t']
            else:
                c.attrib['t'] = 'inlineStr'
                is_elem = ET.SubElement(c, 'is')
                t_elem = ET.SubElement(is_elem, 't')
                str_val = str(text_val)
                if '\n' in str_val or '  ' in str_val or str_val.startswith(' ') or str_val.endswith(' '):
                    t_elem.attrib['{http://www.w3.org/XML/1998/namespace}space'] = 'preserve'
                t_elem.text = str_val

        # 1. Header Information
        m_code = data.get('machineCode', 'MC01')
        m_ton = data.get('machineTonnage', '100T')
        date_str = data.get('dateStr', '')
        opr_name = data.get('operatorName', '-')
        shift = data.get('shift', 'Shift 1')
        
        set_cell('B4', f"Mesin Molding (   {m_code}   {m_ton} )")
        if date_str:
            set_cell('Z2', f"Tanggal  : {date_str}")
        
        # Approval signatures / names in Row 5
        set_cell('AL5', opr_name)
        inspector1 = data.get('inspector1', '')
        inspector2 = data.get('inspector2', '')
        leader = data.get('leader', '')
        dept_head = data.get('deptHead', '')
        if inspector1:
            set_cell('AD5', inspector1)
        if inspector2:
            set_cell('AH5', inspector2)
        if leader:
            set_cell('Z5', leader)
        if dept_head:
            set_cell('V5', dept_head)

        set_cell('A7', shift)

        # 2. Part Production Rows (Rows 11 to 17)
        parts = data.get('parts', [])
        for i in range(7):
            r_idx = 11 + i
            if i < len(parts):
                p = parts[i]
                set_cell(f'A{r_idx}', str(i + 1), is_num=True)
                set_cell(f'B{r_idx}', str(p.get('partNo', '')))
                set_cell(f'G{r_idx}', str(p.get('partName', '')))
                set_cell(f'N{r_idx}', p.get('qty', 0), is_num=True)
                set_cell(f'Q{r_idx}', round(float(p.get('waktuJam', 0)), 2), is_num=True)
                set_cell(f'T{r_idx}', str(p.get('material', '')))
                # Setting Awal (AF), Setting Akhir (AH), Setting TRY (AJ)
                set_cell(f'AF{r_idx}', str(p.get('settingAwal', 'OK')))
                set_cell(f'AH{r_idx}', str(p.get('settingAkhir', 'OK')))
                set_cell(f'AJ{r_idx}', str(p.get('settingTry', '-')))
                # Total Waktu (AL) & Stop (AP) dalam satuan Jam
                set_cell(f'AL{r_idx}', round(float(p.get('totalWaktu', 0)), 2), is_num=True)
                set_cell(f'AP{r_idx}', round(float(p.get('stopJam', 0)), 2), is_num=True)
                set_cell(f'AT{r_idx}', p.get('partOk', p.get('qty', 0)), is_num=True)
                
                # Defect columns (AX to BD)
                set_cell(f'AX{r_idx}', p.get('suteShort', 0), is_num=True)
                set_cell(f'AY{r_idx}', p.get('silver', 0), is_num=True)
                set_cell(f'AZ{r_idx}', p.get('short', 0), is_num=True)
                set_cell(f'BA{r_idx}', p.get('weld', 0), is_num=True)
                set_cell(f'BB{r_idx}', p.get('cekung', 0), is_num=True)
                set_cell(f'BC{r_idx}', p.get('bendaAsing', 0), is_num=True)
                set_cell(f'BD{r_idx}', p.get('scratch', 0), is_num=True)
                set_cell(f'BG{r_idx}', p.get('buang', 0), is_num=True)
                set_cell(f'BH{r_idx}', p.get('repair', 0), is_num=True)
            else:
                for col in ['B', 'G', 'N', 'Q', 'T', 'AF', 'AH', 'AJ', 'AL', 'AP', 'AT', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BG', 'BH']:
                    set_cell(f'{col}{r_idx}', '')

        # 3. 24-Hour Timeline Data (Hours 7 to 6)
        # Columns in Excel:
        # Hour 7: E, F | 8: G, H | 9: I, J | 10: K, L | 11: M, N | 12: O, P
        # 13: Q, R | 14: S, T | 15: U, V | 16: W, X | 17: Y, Z | 18: AA, AB
        # 19: AC, AD | 20: AE, AF | 21: AG, AH | 22: AI, AJ | 23: AK, AL | 0: AM, AN
        # 1: AO, AP | 2: AQ, AR | 3: AS, AT | 4: AU, AV | 5: AW, AX | 6: AY, AZ
        hour_cols = [
            (7, 'E'), (8, 'G'), (9, 'I'), (10, 'K'), (11, 'M'), (12, 'O'),
            (13, 'Q'), (14, 'S'), (15, 'U'), (16, 'W'), (17, 'Y'), (18, 'AA'),
            (19, 'AC'), (20, 'AE'), (21, 'AG'), (22, 'AI'), (23, 'AK'), (0, 'AM'),
            (1, 'AO'), (2, 'AQ'), (3, 'AS'), (4, 'AU'), (5, 'AW'), (6, 'AY')
        ]
        
        hourly = data.get('hourly', {})
        # Map by hour
        for h, col in hour_cols:
            h_data = hourly.get(str(h), {})
            if h_data:
                # Row 21: Waktu Produksi (Run minutes)
                run_m = h_data.get('runMinutes', 0)
                if run_m > 0:
                    set_cell(f'{col}21', run_m, is_num=True)
                # Row 22: Keterlambatan (Delay minutes)
                delay_m = h_data.get('delayMinutes', 0)
                if delay_m > 0:
                    set_cell(f'{col}22', delay_m, is_num=True)
                # Row 23: Simbol Sebab Lambat (Q - Y)
                delay_sym = h_data.get('delaySymbol', '')
                if delay_sym:
                    set_cell(f'{col}23', delay_sym)
                # Row 24: Berhenti (Stop minutes)
                stop_m = h_data.get('stopMinutes', 0)
                if stop_m > 0:
                    set_cell(f'{col}24', stop_m, is_num=True)
                # Row 25: Simbol Sebab Stop (A - N)
                stop_sym = h_data.get('stopSymbol', '')
                if stop_sym:
                    set_cell(f'{col}25', stop_sym)
                # Row 26: Pengecekan Jumlah (Qty produced/scanned)
                qty_h = h_data.get('checkedQty', 0)
                if qty_h > 0:
                    set_cell(f'{col}26', qty_h, is_num=True)
                # Row 27: QC Inspektor per hour (max 5 chars)
                insp = h_data.get('inspector')
                insp_name = ''
                if isinstance(insp, dict):
                    insp_name = insp.get('shortName', '')
                elif isinstance(insp, str):
                    insp_name = insp
                if insp_name:
                    set_cell(f'{col}27', str(insp_name)[:7])
                # Rows 28-34: Defect Breakdown per hour
                ng = h_data.get('ng', {})
                if ng.get('suteShort', 0) > 0:
                    set_cell(f'{col}28', ng['suteShort'], is_num=True)
                if ng.get('silver', 0) > 0:
                    set_cell(f'{col}29', ng['silver'], is_num=True)
                if ng.get('short', 0) > 0:
                    set_cell(f'{col}30', ng['short'], is_num=True)
                if ng.get('weld', 0) > 0:
                    set_cell(f'{col}31', ng['weld'], is_num=True)
                if ng.get('cekung', 0) > 0:
                    set_cell(f'{col}32', ng['cekung'], is_num=True)
                if ng.get('bendaAsing', 0) > 0:
                    set_cell(f'{col}33', ng['bendaAsing'], is_num=True)
                if ng.get('scratch', 0) > 0:
                    set_cell(f'{col}34', ng['scratch'], is_num=True)

        # 4. Abnormal Notes
        notes = data.get('abnormalNotes', '')
        if notes:
            set_cell('A37', f"Kondisi Actual / Item Masalah / Catatan Penanganan Abnormal:\n{notes}")

        # Save to output zip
        out_xml_bytes = ET.tostring(tree, encoding='utf-8', xml_declaration=True)
        fixed_xml = re.sub(r'<worksheet[^>]*>', orig_root_tag, out_xml_bytes.decode('utf-8'), count=1).encode('utf-8')

        ct_xml = z_in.read('[Content_Types].xml').decode('utf-8')
        fixed_ct = re.sub(r'<Override\s+PartName="/xl/calcChain\.xml"[^>]*/>', '', ct_xml).encode('utf-8')

        wr_xml = z_in.read('xl/_rels/workbook.xml.rels').decode('utf-8')
        fixed_wr = re.sub(r'<Relationship\s+[^>]*Target="calcChain\.xml"[^>]*/>', '', wr_xml).encode('utf-8')

        with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_DEFLATED) as z_out:
            for item in z_in.infolist():
                if item.filename == 'xl/worksheets/sheet1.xml':
                    z_out.writestr(item, fixed_xml)
                elif item.filename == '[Content_Types].xml':
                    z_out.writestr(item, fixed_ct)
                elif item.filename == 'xl/_rels/workbook.xml.rels':
                    z_out.writestr(item, fixed_wr)
                elif item.filename == 'xl/calcChain.xml':
                    continue  # Omit calcChain to avoid formula discrepancy error on opening
                else:
                    z_out.writestr(item, z_in.read(item.filename))

    print(json.dumps({"success": True, "outputPath": output_path}))

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: generate_molding_report.py <template_path> <output_path> [json_payload_or_path]"}))
        sys.exit(1)

    template_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if len(sys.argv) >= 4 and os.path.exists(sys.argv[3]):
        with open(sys.argv[3], 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        # Read from stdin
        raw_input = sys.stdin.read()
        data = json.loads(raw_input) if raw_input.strip() else {}

    try:
        generate_report(template_path, output_path, data)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
