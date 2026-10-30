/**
 * Client for the Python price model (pricing/ service).
 * Suggests a stand price from its location (area), size and land use.
 */
const { httpError } = require('../utils/helpers');

const PRICING_URL = (process.env.PRICING_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const TIMEOUT_MS = 5000;

async function call(path, body) {
  let res;
  try {
    res = await fetch(PRICING_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error('pricing service unreachable:', e.message);
    throw httpError(503, 'The price suggestion service is not available right now');
  }
  if (res.status === 422) throw httpError(400, 'Enter a valid area, size and land use to get a suggested price');
  if (!res.ok) throw httpError(502, `Price suggestion failed (${res.status})`);
  return res.json();
}

const toInput = (s) => ({ area: s.area, sizeSqm: Number(s.sizeSqm), landUse: s.landUse || 'residential' });

/** -> { suggestedPrice, low, high, pricePerSqm, knownArea, modelVersion } */
const suggestPrice = (stand) => call('/predict', toInput(stand));

/** Same as suggestPrice for many stands, in the same order. */
const suggestPrices = async (stands) => (await call('/predict/batch', { items: stands.map(toInput) })).results;

module.exports = { suggestPrice, suggestPrices };
