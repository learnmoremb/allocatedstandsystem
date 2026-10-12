/**
 * Record linkage for stand-allocation data.
 *
 * Records are normalised, grouped into blocks (same stand key, same national
 * ID, same phone, same phonetic surname) and compared pairwise inside each
 * block with a weighted similarity score:
 *
 *   national ID  0.45   (exact after normalisation, else partial similarity)
 *   full name    0.35   (Jaro-Winkler on token-sorted names)
 *   phone        0.20   (last 9 digits match)
 *
 * Pairs scoring >= PERSON_MATCH_THRESHOLD are considered the same person.
 */

const PERSON_MATCH_THRESHOLD = 0.8;

// ---------- normalisation ----------
const normText = (s) => String(s ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const normName = (s) => normText(s).split(' ').filter(Boolean).sort().join(' ');
const normId = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normPhone = (s) => {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : d;
};
/** "Stand No. 0123" / "stand 123" / "123" -> "123"; area is prefixed when available. */
const normStand = (stand, area) => {
  const s = String(stand ?? '').toUpperCase().replace(/STAND|NO\.?|NUMBER|#/g, '').replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\w)/, '');
  const a = normText(area).replace(/\s/g, '');
  return a ? `${a}:${s}` : s;
};

// ---------- string similarity ----------
function jaro(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aM = new Array(a.length).fill(false);
  const bM = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bM[j] || a[i] !== b[j]) continue;
      aM[i] = bM[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  for (let i = 0, k = 0; i < a.length; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
}

function jaroWinkler(a, b) {
  const j = jaro(a, b);
  let prefix = 0;
  while (prefix < 4 && a[prefix] && a[prefix] === b[prefix]) prefix++;
  return j + prefix * 0.1 * (1 - j);
}

/** American Soundex, used as a phonetic blocking key on the surname. */
function soundex(s) {
  const str = normText(s).replace(/\s/g, '');
  if (!str) return '';
  const codes = { b: 1, f: 1, p: 1, v: 1, c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2, d: 3, t: 3, l: 4, m: 5, n: 5, r: 6 };
  let out = str[0].toUpperCase();
  let last = codes[str[0]] || 0;
  for (const ch of str.slice(1)) {
    const c = codes[ch] || 0;
    if (c && c !== last) out += c;
    if (ch !== 'h' && ch !== 'w') last = c;
  }
  return (out + '000').slice(0, 4);
}

// ---------- person matching ----------
function personSimilarity(r1, r2) {
  let score = 0;
  let weight = 0;
  const reasons = [];

  if (r1.idKey && r2.idKey) {
    weight += 0.45;
    if (r1.idKey === r2.idKey) {
      score += 0.45;
      reasons.push('national ID matches');
    } else {
      const s = jaroWinkler(r1.idKey, r2.idKey);
      if (s > 0.93) {
        score += 0.45 * s * 0.8; // probable typo in ID
        reasons.push(`national ID nearly matches (${Math.round(s * 100)}%)`);
      }
    }
  }
  if (r1.nameKey && r2.nameKey) {
    weight += 0.35;
    const s = jaroWinkler(r1.nameKey, r2.nameKey);
    score += 0.35 * s;
    if (s >= 0.9) reasons.push(`name similarity ${Math.round(s * 100)}%`);
  }
  if (r1.phoneKey && r2.phoneKey) {
    weight += 0.2;
    if (r1.phoneKey === r2.phoneKey) {
      score += 0.2;
      reasons.push('phone matches');
    }
  }
  return { score: weight ? score / weight : 0, reasons };
}

function prepare(rec, idx) {
  const fullName = rec.fullName || [rec.firstName, rec.surname].filter(Boolean).join(' ');
  const surname = rec.surname || normText(fullName).split(' ').pop();
  return {
    ...rec,
    _idx: idx,
    fullName,
    standKey: normStand(rec.standNumber, rec.area),
    nameKey: normName(fullName),
    idKey: normId(rec.nationalId),
    phoneKey: normPhone(rec.phone),
    phoneticKey: soundex(surname),
  };
}

const standLabel = (r) => r.standKey.split(':').pop() || r.standNumber;

const publicRecord = (r) => ({
  row: r.row,
  source: r.source || 'csv',
  standNumber: r.standNumber,
  area: r.area,
  fullName: r.fullName,
  nationalId: r.nationalId,
  phone: r.phone,
  allocationDate: r.allocationDate,
});

function groupBy(list, keyFn) {
  const m = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

/**
 * Detect duplicates in a list of allocation records.
 * @param {Array} rawRecords [{standNumber, area, fullName, nationalId, phone, allocationDate, row, source}]
 * @param {Array} systemRecords optional active allocations from the database in the same shape
 */
function detectDuplicates(rawRecords, systemRecords = []) {
  const records = rawRecords.map(prepare);
  const findings = [];

  // Union-find over records judged to be the same person
  const parent = records.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => (parent[find(a)] = find(b));

  // 1. Same stand appearing more than once
  for (const [standKey, group] of groupBy(records, (r) => r.standKey)) {
    if (group.length < 2) continue;
    // cluster the rows on this stand into distinct people
    const clusters = [];
    for (const r of group) {
      const c = clusters.find((cl) => personSimilarity(cl[0], r).score >= PERSON_MATCH_THRESHOLD);
      c ? c.push(r) : clusters.push([r]);
    }
    for (const cl of clusters) {
      if (cl.length > 1) {
        findings.push({
          type: 'duplicate_record',
          severity: 'low',
          score: 1,
          standKey,
          reason: `Stand ${standLabel(cl[0])} is listed ${cl.length} times for the same person`,
          records: cl.map(publicRecord),
        });
      }
    }
    if (clusters.length > 1) {
      findings.push({
        type: 'double_allocation',
        severity: 'high',
        score: 1,
        standKey,
        reason: `Stand ${standLabel(group[0])}${group[0].area ? ` (${group[0].area})` : ''} is allocated to ${clusters.length} different people`,
        records: group.map(publicRecord),
      });
    }
  }

  // 2. Same person holding multiple stands (blocked comparisons)
  const blocks = [
    groupBy(records, (r) => r.idKey && `id:${r.idKey}`),
    groupBy(records, (r) => r.phoneKey && r.phoneKey.length >= 9 && `ph:${r.phoneKey}`),
    groupBy(records, (r) => r.phoneticKey && `sx:${r.phoneticKey}`),
  ];
  const pairReasons = new Map();
  for (const blockMap of blocks) {
    for (const group of blockMap.values()) {
      if (group.length < 2 || group.length > 500) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          if (find(a._idx) === find(b._idx)) continue;
          const { score, reasons } = personSimilarity(a, b);
          if (score >= PERSON_MATCH_THRESHOLD) {
            union(a._idx, b._idx);
            pairReasons.set(`${Math.min(a._idx, b._idx)}-${Math.max(a._idx, b._idx)}`, { score, reasons });
          }
        }
      }
    }
  }
  const people = groupBy(records, (r) => String(find(r._idx)));
  for (const group of people.values()) {
    const stands = new Set(group.map((r) => r.standKey));
    if (stands.size < 2) continue;
    const idxs = new Set(group.map((g) => g._idx));
    const top = [...pairReasons.entries()]
      .filter(([k]) => k.split('-').every((i) => idxs.has(Number(i))))
      .map(([, v]) => v)
      .sort((x, y) => y.score - x.score)[0] || { score: 1, reasons: [] };
    findings.push({
      type: 'same_person_multiple_stands',
      severity: 'medium',
      score: Math.round(top.score * 100) / 100,
      reason: `${group[0].fullName} appears to hold ${stands.size} stands (${[...new Set(top.reasons)].join(', ')})`,
      records: group.map(publicRecord),
    });
  }

  // 3. Conflicts with allocations already recorded in the system
  if (systemRecords.length) {
    const sys = groupBy(systemRecords.map((r, i) => prepare({ ...r, source: 'system' }, -1 - i)), (r) => r.standKey);
    for (const r of records) {
      const holders = sys.get(r.standKey) || [];
      for (const h of holders) {
        const { score } = personSimilarity(r, h);
        if (score < PERSON_MATCH_THRESHOLD) {
          findings.push({
            type: 'conflict_with_system',
            severity: 'high',
            score: Math.round((1 - score) * 100) / 100,
            standKey: r.standKey,
            reason: `Stand ${standLabel(r)} is allocated in the system to ${h.fullName}, but the file lists ${r.fullName}`,
            records: [publicRecord(r), publicRecord(h)],
          });
        }
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || b.score - a.score);

  const count = (t) => findings.filter((f) => f.type === t).length;
  return {
    totalRecords: records.length,
    findings,
    summary: {
      doubleAllocations: count('double_allocation'),
      samePersonMultipleStands: count('same_person_multiple_stands'),
      duplicateRecords: count('duplicate_record'),
      conflictsWithSystem: count('conflict_with_system'),
    },
  };
}

module.exports = { detectDuplicates, personSimilarity, jaroWinkler, soundex, normStand, normName, normId, normPhone, prepare };
