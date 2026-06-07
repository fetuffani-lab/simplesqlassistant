from backend.export.exporter import to_csv, to_xlsx

ROWS = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]


def test_csv_basic():
    data = to_csv(ROWS).decode()
    assert "id,name" in data
    assert "Alice" in data


def test_csv_no_header():
    data = to_csv(ROWS, include_header=False).decode()
    assert "id" not in data
    assert "Alice" in data


def test_csv_separator():
    data = to_csv(ROWS, separator=";").decode()
    assert "id;name" in data


def test_csv_empty():
    data = to_csv([]).decode()
    assert data == ""


def test_xlsx_basic():
    data = to_xlsx(ROWS)
    # XLSX magic bytes: PK
    assert data[:2] == b"PK"


def test_xlsx_empty():
    data = to_xlsx([])
    assert data[:2] == b"PK"
