"""Statistics used by the Analysis ToolPak, computed with numpy / scipy for large ranges."""
from __future__ import annotations

import numpy as np
from scipy import stats as st


def _arr(values: list[float]) -> np.ndarray:
    a = np.asarray(values, dtype=float)
    a = a[np.isfinite(a)]
    return a


def describe(values: list[float]) -> dict:
    a = _arr(values)
    n = int(a.size)
    if n == 0:
        raise ValueError("No numeric values.")
    out: dict = {"count": n, "sum": float(a.sum()), "mean": float(a.mean()), "median": float(np.median(a)), "min": float(a.min()), "max": float(a.max()), "range": float(a.max() - a.min())}
    mode = st.mode(a, keepdims=False)
    out["mode"] = float(mode.mode) if int(mode.count) > 1 else None
    if n > 1:
        sd = float(a.std(ddof=1))
        out.update(stdev=sd, variance=float(a.var(ddof=1)), standard_error=sd / n**0.5)
        out["skewness"] = float(st.skew(a, bias=False)) if n > 2 else None
        out["kurtosis"] = float(st.kurtosis(a, bias=False)) if n > 3 else None
        h = st.t.ppf(0.975, n - 1) * sd / n**0.5
        out["confidence_95"] = float(h)
    return out


def regression(x: list[float], y: list[float]) -> dict:
    xa, ya = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    if xa.size != ya.size:
        raise ValueError("x and y must be the same length.")
    keep = np.isfinite(xa) & np.isfinite(ya)
    xa, ya = xa[keep], ya[keep]
    if xa.size < 3:
        raise ValueError("At least 3 pairs are needed.")
    r = st.linregress(xa, ya)
    n = xa.size
    pred = r.intercept + r.slope * xa
    sse = float(((ya - pred) ** 2).sum())
    return {"n": int(n), "slope": float(r.slope), "intercept": float(r.intercept), "r": float(r.rvalue), "r_squared": float(r.rvalue**2), "slope_stderr": float(r.stderr), "intercept_stderr": float(r.intercept_stderr), "p_value": float(r.pvalue), "standard_error": (sse / (n - 2)) ** 0.5}


def ttest(a: list[float], b: list[float], kind: str = "welch") -> dict:
    xa, xb = _arr(a), _arr(b)
    if xa.size < 2 or xb.size < 2:
        raise ValueError("Each sample needs at least 2 values.")
    if kind == "paired":
        if xa.size != xb.size:
            raise ValueError("Paired samples must be the same length.")
        t = st.ttest_rel(xa, xb)
    elif kind in ("equal", "pooled"):
        t = st.ttest_ind(xa, xb, equal_var=True)
    elif kind == "welch":
        t = st.ttest_ind(xa, xb, equal_var=False)
    else:
        raise ValueError("kind must be welch, equal or paired.")
    return {"kind": kind, "t": float(t.statistic), "df": float(t.df), "p_two_tail": float(t.pvalue), "mean_a": float(xa.mean()), "mean_b": float(xb.mean())}


def anova(groups: list[list[float]]) -> dict:
    gs = [_arr(g) for g in groups]
    if len(gs) < 2 or any(g.size < 2 for g in gs):
        raise ValueError("Need at least 2 groups with 2+ values each.")
    f = st.f_oneway(*gs)
    return {"groups": len(gs), "f": float(f.statistic), "p_value": float(f.pvalue), "df_between": len(gs) - 1, "df_within": int(sum(g.size for g in gs) - len(gs))}


def correlation(columns: list[list[float]]) -> dict:
    m = np.asarray(columns, dtype=float)
    if m.ndim != 2 or m.shape[0] < 2 or m.shape[1] < 2:
        raise ValueError("Need at least 2 columns with 2+ rows each.")
    return {"matrix": np.corrcoef(m).tolist()}


def forecast_linear(x: list[float], y: list[float], at: list[float]) -> dict:
    reg = regression(x, y)
    return {"values": [reg["intercept"] + reg["slope"] * v for v in at], "r_squared": reg["r_squared"]}
