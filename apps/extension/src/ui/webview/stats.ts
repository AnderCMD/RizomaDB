/** Quick statistics of one column over the rows loaded in the grid (cell text, as shown). */
export interface ColumnStats {
  count: number; nulls: number; distinct: number;
  min?: string; max?: string;
  numeric?: { sum: number; avg: number; min: number; max: number; histogram: { from: number; to: number; count: number }[] };
  top: { value: string; count: number }[];
}

const NUMERIC = new Set(["integer", "float", "decimal"]);

export function columnStats(values: readonly (string | null)[], kind: string, opts: { top?: number; buckets?: number } = {}): ColumnStats {
  const topN = opts.top ?? 10, buckets = Math.max(1, opts.buckets ?? 10);
  const freq = new Map<string, number>();
  let nulls = 0, min: string | undefined, max: string | undefined;
  const nums: number[] = [];
  for (const v of values) {
    if (v === null) { nulls++; continue; }
    freq.set(v, (freq.get(v) ?? 0) + 1);
    if (NUMERIC.has(kind)) { const n = Number(v); if (v.trim() !== "" && Number.isFinite(n)) nums.push(n); }
    else { if (min === undefined || v < min) min = v; if (max === undefined || v > max) max = v; }
  }
  const out: ColumnStats = {
    count: values.length, nulls, distinct: freq.size,
    top: [...freq].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, topN).map(([value, count]) => ({ value, count })),
  };
  if (nums.length) {
    let lo = nums[0]!, hi = nums[0]!, sum = 0;
    for (const n of nums) { if (n < lo) lo = n; if (n > hi) hi = n; sum += n; }
    const width = (hi - lo) / buckets || 1, histogram = Array.from({ length: buckets }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0 }));
    for (const n of nums) histogram[Math.min(buckets - 1, Math.floor((n - lo) / width))]!.count++;
    out.numeric = { sum, avg: sum / nums.length, min: lo, max: hi, histogram: hi === lo ? [{ from: lo, to: hi, count: nums.length }] : histogram };
    out.min = String(lo); out.max = String(hi);
  } else if (min !== undefined) { out.min = min; out.max = max!; }
  return out;
}
