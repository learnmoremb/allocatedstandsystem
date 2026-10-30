"""
Stand price suggestion API (used by the Node backend, not exposed to the internet).

    GET  /health
    GET  /meta                    model version, metrics and known areas
    POST /predict                 {"area": "...", "sizeSqm": 400, "landUse": "residential"}
    POST /predict/batch           {"items": [ ...same objects... ]}
"""
import os
from typing import List, Literal

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field

from features import FEATURES, to_row

MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(os.path.dirname(__file__), "model", "price_model.joblib"))
bundle = joblib.load(MODEL_PATH)
known_areas = set(bundle["areas"])

app = FastAPI(title="Stand price model")


class StandIn(BaseModel):
    area: str = Field(min_length=1)
    sizeSqm: float = Field(gt=0)
    landUse: Literal["residential", "commercial", "industrial", "institutional"] = "residential"


class BatchIn(BaseModel):
    items: List[StandIn] = Field(max_length=5000)


def round_price(v: float) -> float:
    return float(round(v / 50) * 50)


def predict(items: List[StandIn]) -> list:
    rows = [to_row(i.area, i.landUse, i.sizeSqm) for i in items]
    X = pd.DataFrame(rows, columns=FEATURES)
    log_mid = bundle["model"].predict(X)
    band_low, band_high = bundle["band"]
    out = []
    for r, lm in zip(rows, log_mid):
        md = float(np.exp(lm))
        out.append({
            "suggestedPrice": round_price(md),
            "low": round_price(md * np.exp(band_low)),
            "high": round_price(md * np.exp(band_high)),
            "pricePerSqm": round(float(md) / r["sizeSqm"], 2),
            # unknown locations fall back to an average location, so the estimate is rough
            "knownArea": r["area"] in known_areas,
            "modelVersion": bundle["version"],
        })
    return out


@app.get("/health")
def health():
    return {"status": "ok", "modelVersion": bundle["version"]}


@app.get("/meta")
def meta():
    return {k: bundle[k] for k in ("version", "trainedAt", "metrics", "areas")}


@app.post("/predict")
def predict_one(item: StandIn):
    return predict([item])[0]


@app.post("/predict/batch")
def predict_batch(body: BatchIn):
    return {"results": predict(body.items) if body.items else []}
