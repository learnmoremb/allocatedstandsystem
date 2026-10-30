"""Shared feature definitions so training and serving prepare inputs the same way."""
import re

LAND_USES = ["residential", "commercial", "industrial", "institutional"]
FEATURES = ["area", "landUse", "sizeSqm"]


def norm_area(area: str) -> str:
    """'  hatfield   EXTENSION ' -> 'hatfield extension' (matching is case/space-insensitive)."""
    return re.sub(r"\s+", " ", str(area or "")).strip().lower()


def to_row(area: str, land_use: str, size_sqm: float) -> dict:
    land_use = (land_use or "residential").strip().lower()
    return {"area": norm_area(area), "landUse": land_use, "sizeSqm": float(size_sqm)}
