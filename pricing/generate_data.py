"""
Generate a synthetic history of stand sales to train the price model on.

Price = size x base rate of the location x land-use multiplier x size discount x random noise.
Base rates are USD per m² for a residential stand and are calibrated so the demo stands
(e.g. Hatfield Extension 400 m² residential = 12 000) land in a realistic place.
Edit LOCATIONS to match your council's real market, then retrain.

    python generate_data.py --rows 6000 --out data/stands.csv
"""
import argparse
import csv
import math
import random

from features import LAND_USES, norm_area

# location -> residential base rate (USD per m²)
LOCATIONS = {
    "Borrowdale": 85, "Mount Pleasant": 72, "Avondale": 62, "Greendale": 50, "Marlborough": 45,
    "Hatfield": 34, "Hatfield Extension": 30, "Westgate": 33, "Westgate Phase 2": 30,
    "Ruwa": 20, "Waterfalls": 22, "Kuwadzana": 15, "Budiriro": 13, "Glen View": 12,
    "Mabvuku": 11, "Norton": 12, "Chitungwiza": 10, "Epworth": 8,
}

# land use -> (price multiplier, min size, max size)
LAND_USE = {
    "residential": (1.00, 200, 2000),
    "commercial": (1.50, 300, 3000),
    "industrial": (1.10, 1000, 10000),
    "institutional": (0.85, 800, 8000),
}
# share of each land use in the generated data
LAND_USE_WEIGHTS = [0.65, 0.15, 0.10, 0.10]
assert list(LAND_USE) == LAND_USES


def price_for(base_rate: float, land_use: str, size: float, rng: random.Random) -> float:
    mult = LAND_USE[land_use][0]
    size_discount = (size / 500) ** -0.12  # bigger stands cost less per m²
    noise = math.exp(rng.gauss(0, 0.08))  # ~±8% market variation
    return round(size * base_rate * mult * size_discount * noise / 50) * 50


def generate(rows: int, seed: int = 42):
    rng = random.Random(seed)
    names = list(LOCATIONS)
    for _ in range(rows):
        area = rng.choice(names)
        land_use = rng.choices(LAND_USES, LAND_USE_WEIGHTS)[0]
        _, lo, hi = LAND_USE[land_use]
        size = round(math.exp(rng.uniform(math.log(lo), math.log(hi))) / 10) * 10
        yield {"area": norm_area(area), "landUse": land_use, "sizeSqm": size,
               "price": price_for(LOCATIONS[area], land_use, size, rng)}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--rows", type=int, default=6000)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default="data/stands.csv")
    a = p.parse_args()
    with open(a.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["area", "landUse", "sizeSqm", "price"])
        w.writeheader()
        w.writerows(generate(a.rows, a.seed))
    print(f"Wrote {a.rows} rows to {a.out}")
