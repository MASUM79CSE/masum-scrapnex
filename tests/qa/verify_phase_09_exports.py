"""Independently read the real browser downloads produced by the Phase 09 fixture."""

import csv
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

import openpyxl

folder = Path(sys.argv[1])
base = folder / 'scrapnexs-phase-09-fixture'
notes = 'Lamp, "large"\nবাংলা <gear> & tags'

csv_path = base.with_suffix('.csv')
assert csv_path.read_bytes().startswith(b'\xef\xbb\xbf')
with csv_path.open(encoding='utf-8-sig', newline='') as stream:
    records = list(csv.reader(stream, strict=True))
assert records == [
    ['Item', 'Stock', 'Notes'],
    ['Trail lamp', '0042', notes],
    ["'=1+1", '', ''],
    ['ক্যাম্প প্যাক', '15', ''],
]
print(f'CSV: strict stdlib parse, BOM, 3 rows, quoting, Unicode, formula prefix; {csv_path.stat().st_size} bytes')

json_path = base.with_suffix('.json')
with json_path.open(encoding='utf-8') as stream:
    json_data = json.load(stream)
assert json_data['version'] == 1
assert [column['label'] for column in json_data['columns']] == ['Item', 'Stock', 'Notes']
assert [row['values'] for row in json_data['records']] == [
    dict(Item='Trail lamp', Stock='0042', Notes=notes),
    dict(Item='=1+1', Stock='', Notes=''),
    dict(Item='ক্যাম্প প্যাক', Stock='15', Notes=None),
]
print(f'JSON: stdlib parse, schema, literal strings, empty vs missing; {json_path.stat().st_size} bytes')

xlsx_path = base.with_suffix('.xlsx')
with zipfile.ZipFile(xlsx_path) as container:
    assert container.testzip() is None
    assert set(container.namelist()) == {
        '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml',
    }
    for member in container.namelist():
        assert 'TargetMode="External"' not in container.read(member).decode('utf-8')
        ElementTree.fromstring(container.read(member))
workbook = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=False)
try:
    assert workbook.sheetnames == ['Captured records']
    sheet = workbook.active
    assert sheet.max_row == 4 and sheet.max_column == 3
    assert list(sheet.values) == [
        ('Item', 'Stock', 'Notes'),
        ('Trail lamp', '0042', notes),
        ('=1+1', '', ''),
        ('ক্যাম্প প্যাক', '15', None),
    ]
    assert sheet['A3'].data_type == 's'
    assert all(cell.data_type != 'f' for row in sheet.iter_rows() for cell in row)
finally:
    workbook.close()
print(f'XLSX: ZIP integrity and XML parse, openpyxl {openpyxl.__version__}, literal strings, no formulas; {xlsx_path.stat().st_size} bytes')
