from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services import stats as svc

router = APIRouter(prefix="/v1/stats", tags=["stats"])
Vec = list[float]
MAX_N = 2_000_000


class Values(BaseModel):
    values: Vec = Field(max_length=MAX_N)


class XY(BaseModel):
    x: Vec = Field(max_length=MAX_N)
    y: Vec = Field(max_length=MAX_N)


class TTest(BaseModel):
    a: Vec = Field(max_length=MAX_N)
    b: Vec = Field(max_length=MAX_N)
    kind: str = "welch"


class Groups(BaseModel):
    groups: list[Vec]


class Columns(BaseModel):
    columns: list[Vec]


class Forecast(XY):
    at: Vec


def _call(fn, *a):
    try:
        return fn(*a)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@router.post("/describe")
def describe(b: Values) -> dict:
    return _call(svc.describe, b.values)


@router.post("/regression")
def regression(b: XY) -> dict:
    return _call(svc.regression, b.x, b.y)


@router.post("/ttest")
def ttest(b: TTest) -> dict:
    return _call(svc.ttest, b.a, b.b, b.kind)


@router.post("/anova")
def anova(b: Groups) -> dict:
    return _call(svc.anova, b.groups)


@router.post("/correlation")
def correlation(b: Columns) -> dict:
    return _call(svc.correlation, b.columns)


@router.post("/forecast")
def forecast(b: Forecast) -> dict:
    return _call(svc.forecast_linear, b.x, b.y, b.at)
