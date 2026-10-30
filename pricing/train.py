"""
Train the stand price model.

A small gradient-boosted tree model is fitted on log(price) to give the suggested price.
The range shown to staff is the 10th-90th percentile of the model's errors on held-out data
(a calibrated band), applied around each suggestion.

    python train.py                                   # synthetic data only
    python train.py --extra real_sales.csv            # also learn from real records
                                                      # (columns: area,landUse,sizeSqm,price)
"""
import argparse
import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder

from features import FEATURES, LAND_USES, norm_area


def make_pipeline(**gbr_kwargs) -> Pipeline:
    prep = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["area", "landUse"]),
        ("size", FunctionTransformer(np.log), ["sizeSqm"]),
    ])
    gbr = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.08, max_leaf_nodes=31, random_state=0, **gbr_kwargs)
    return Pipeline([("prep", prep), ("gbr", gbr)])


def load(paths) -> pd.DataFrame:
    df = pd.concat([pd.read_csv(p) for p in paths], ignore_index=True)
    df["area"] = df["area"].map(norm_area)
    df["landUse"] = df["landUse"].fillna("residential").str.strip().str.lower()
    df = df[df["landUse"].isin(LAND_USES) & (df["sizeSqm"] > 0) & (df["price"] > 0)]
    return df.dropna(subset=FEATURES + ["price"])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data/stands.csv")
    p.add_argument("--extra", nargs="*", default=[], help="additional CSVs of real sales")
    p.add_argument("--out", default="model/price_model.joblib")
    a = p.parse_args()

    df = load([a.data, *a.extra])
    X, y = df[FEATURES], np.log(df["price"])
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=0)

    model = make_pipeline(loss="absolute_error")
    model.fit(X_tr, y_tr)

    log_pred = model.predict(X_te)
    resid_low, resid_high = np.quantile(y_te - log_pred, [0.1, 0.9])
    pred, actual = np.exp(log_pred), np.exp(y_te)
    low, high = pred * np.exp(resid_low), pred * np.exp(resid_high)
    metrics = {
        "rows": len(df),
        "mae": round(float(mean_absolute_error(actual, pred)), 2),
        "mape": round(float(mean_absolute_percentage_error(actual, pred)), 4),
        "r2": round(float(r2_score(actual, pred)), 4),
        "rangeCoverage": round(float(((actual >= low) & (actual <= high)).mean()), 4),
    }

    # refit on all data for serving
    model.fit(X, y)

    bundle = {
        "model": model,
        "band": [float(resid_low), float(resid_high)],
        "areas": sorted(df["area"].unique().tolist()),
        "metrics": metrics,
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "version": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
    }
    joblib.dump(bundle, a.out)
    with open(a.out.replace(".joblib", ".metrics.json"), "w") as f:
        json.dump({k: v for k, v in bundle.items() if k != "model"}, f, indent=2)
    print(f"Saved {a.out}  {json.dumps(metrics)}")


if __name__ == "__main__":
    main()
