import { Dataset } from './types';

export type NumericStats = {
  column: string;
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  std: number;
  missingPct: number;
};
export type CategoricalStats = {
  column: string;
  uniques: number;
  top: string;
  topCount: number;
  missingPct: number;
};

export function computeStats(ds: Dataset) {
  const rows = ds.sampleRows;
  const numeric: NumericStats[] = [];
  const categorical: CategoricalStats[] = [];
  for (const col of ds.columns) {
    const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const nums = vals.map(v => Number(String(v).replace(',', '.'))).filter(v => !isNaN(v));
    const missingPct = Math.round(100 * (rows.length - vals.length) / Math.max(1, rows.length));
    if (nums.length >= vals.length * 0.6) {
      nums.sort((a,b)=>a-b);
      const mean = nums.reduce((a,b)=>a+b,0)/Math.max(1, nums.length);
      const median = nums[Math.floor(nums.length/2)] ?? 0;
      const min = nums[0] ?? 0, max = nums[nums.length-1] ?? 0;
      const std = Math.sqrt(nums.reduce((a,b)=>a + Math.pow(b - mean,2),0) / Math.max(1, nums.length));
      numeric.push({ column: col, count: nums.length, mean, median, min, max, std, missingPct });
    } else {
      const freq = new Map<string, number>();
      for (const v of vals) {
        const s = String(v);
        freq.set(s, (freq.get(s)||0)+1);
      }
      let top = '', topCount = 0;
      for (const [k,v] of freq.entries()) if (v > topCount) { top = k; topCount = v; }
      categorical.push({ column: col, uniques: freq.size, top, topCount, missingPct });
    }
  }
  return { numeric, categorical };
}
