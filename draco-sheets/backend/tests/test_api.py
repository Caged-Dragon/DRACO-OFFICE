import io

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import convert as conv

c = TestClient(app)


def test_health():
    r = c.get("/health").json()
    assert r["ok"] and r["service"] == "draco-sheets-backend"


def test_describe_matches_numpy():
    v = [2, 4, 4, 4, 5, 5, 7, 9]
    r = c.post("/v1/stats/describe", json={"values": v}).json()
    assert r["count"] == 8 and r["mean"] == 5 and r["median"] == 4.5 and r["mode"] == 4
    assert r["stdev"] == pytest.approx(np.std(v, ddof=1))


def test_regression_exact_line():
    r = c.post("/v1/stats/regression", json={"x": [1, 2, 3, 4], "y": [3, 5, 7, 9]}).json()
    assert r["slope"] == pytest.approx(2) and r["intercept"] == pytest.approx(1) and r["r_squared"] == pytest.approx(1)


def test_ttest_and_anova_and_corr_and_forecast():
    a, b = [5.1, 4.9, 5.6, 5.8, 6.0], [4.1, 4.4, 4.0, 3.9, 4.6]
    t = c.post("/v1/stats/ttest", json={"a": a, "b": b, "kind": "equal"}).json()
    assert t["p_two_tail"] < 0.01 and t["df"] == 8
    assert c.post("/v1/stats/ttest", json={"a": a, "b": b, "kind": "nope"}).status_code == 422
    an = c.post("/v1/stats/anova", json={"groups": [a, b, [3, 3.5, 4, 3.8]]}).json()
    assert an["df_between"] == 2 and an["p_value"] < 0.01
    cor = c.post("/v1/stats/correlation", json={"columns": [[1, 2, 3, 4], [2, 4, 6, 8.5]]}).json()
    assert cor["matrix"][0][1] > 0.99
    f = c.post("/v1/stats/forecast", json={"x": [1, 2, 3], "y": [2, 4, 6], "at": [4, 5]}).json()
    assert f["values"] == pytest.approx([8, 10])


def test_stats_validation_errors():
    assert c.post("/v1/stats/describe", json={"values": []}).status_code == 422
    assert c.post("/v1/stats/regression", json={"x": [1, 2], "y": [1, 2]}).status_code == 422
    assert c.post("/v1/stats/regression", json={"x": [1, 2, 3], "y": [1, 2]}).status_code == 422


def test_convert_rejects_bad_requests():
    assert c.post("/v1/convert?to=docx", files={"file": ("a.csv", b"a,b\n1,2", "text/csv")}).status_code == 422
    assert c.post("/v1/convert?to=xlsx", files={"file": ("a.exe", b"zzz", "application/octet-stream")}).status_code == 422
    assert c.post("/v1/convert?to=xlsx", files={"file": ("a.csv", b"", "text/csv")}).status_code == 400


@pytest.mark.skipif(not conv.available(), reason="LibreOffice not installed")
def test_convert_csv_to_xlsx_and_back_and_pdf():
    csv = b"name,units\nA,3\nB,5\n"
    x = c.post("/v1/convert?to=xlsx", files={"file": ("t.csv", csv, "text/csv")})
    assert x.status_code == 200 and x.content[:2] == b"PK"
    back = c.post("/v1/convert?to=csv", files={"file": ("t.xlsx", x.content, "application/octet-stream")})
    assert back.status_code == 200 and b"name" in back.content and b"5" in back.content
    pdf = c.post("/v1/convert?to=pdf", files={"file": ("t.xlsx", x.content, "application/octet-stream")})
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
