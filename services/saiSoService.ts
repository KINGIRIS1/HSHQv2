
// Dữ liệu và Logic tính toán sai số (Chuyển đổi từ HTML mẫu)

interface EdgeRuleSegment {
  type: 'const' | 'step';
  upper: number;
  base?: number; // Cho type const
  lower?: number; // Cho type step
  inc?: number;   // Cho type step
  baseAtLower?: number; // Được tính toán lúc init
}

interface AreaRuleSegment {
  type: 'const' | 'lin';
  upper: number;
  base?: number; // Cho type const
  lower?: number; // Cho type lin
  incPer10?: number; // Cho type lin
  baseAtLower?: number; // Được tính toán lúc init
}

// Sai số tương hỗ cạnh (cm)
const EDGE_RULES: Record<string, EdgeRuleSegment[]> = {
  "1:200": [
    { type: "const", upper: 2.0, base: 1.5 },
    { type: "step",  lower: 2.0,  upper: 8.0,  inc: 0.6 },
    { type: "step",  lower: 8.0,  upper: 15.0, inc: 0.25 },
    { type: "step",  lower: 15.0, upper: 30.0, inc: 0.2 },
    { type: "step",  lower: 30.0, upper: 50.0, inc: 0.15 },
    { type: "step",  lower: 50.0, upper: Infinity, inc: 0.1 },
  ],
  "1:500": [
    { type: "const", upper: 3.0, base: 1.8 },
    { type: "step",  lower: 3.0,  upper: 8.0,  inc: 0.65 },
    { type: "step",  lower: 8.0,  upper: 15.0, inc: 0.3 },
    { type: "step",  lower: 15.0, upper: 30.0, inc: 0.25 },
    { type: "step",  lower: 30.0, upper: 50.0, inc: 0.2 },
    { type: "step",  lower: 50.0, upper: Infinity, inc: 0.1 },
  ],
  "1:1.000": [
    { type: "const", upper: 3.5, base: 2.0 },
    { type: "step",  lower: 3.5,  upper: 10.0, inc: 0.7 },
    { type: "step",  lower: 10.0, upper: 30.0, inc: 0.3 },
    { type: "step",  lower: 30.0, upper: 50.0, inc: 0.25 },
    { type: "step",  lower: 50.0, upper: Infinity, inc: 0.1 },
  ],
  "1:2.000": [
    { type: "const", upper: 4.0, base: 3.0 },
    { type: "step",  lower: 4.0,  upper: 10.0, inc: 0.75 },
    { type: "step",  lower: 10.0, upper: 30.0, inc: 0.35 },
    { type: "step",  lower: 30.0, upper: 50.0, inc: 0.25 },
    { type: "step",  lower: 50.0, upper: Infinity, inc: 0.1 },
  ],
  "1:5.000": [
    { type: "const", upper: 5.0, base: 4.0 },
    { type: "step",  lower: 5.0,  upper: 10.0, inc: 0.8 },
    { type: "step",  lower: 10.0, upper: 30.0, inc: 0.4 },
    { type: "step",  lower: 30.0, upper: 50.0, inc: 0.35 },
    { type: "step",  lower: 50.0, upper: Infinity, inc: 0.15 },
  ],
  "1:10.000": [
    { type: "const", upper: 5.0, base: 4.0 },
    { type: "step",  lower: 5.0,  upper: 10.0, inc: 0.85 },
    { type: "step",  lower: 10.0, upper: 30.0, inc: 0.45 },
    { type: "step",  lower: 30.0, upper: 50.0, inc: 0.4 },
    { type: "step",  lower: 50.0, upper: Infinity, inc: 0.2 },
  ],
};

const EDGE_ALLOW_12X = new Set(["1:1.000", "1:2.000"]);

// Giới hạn sai diện tích (m²)
const AREA_RULES: Record<string, AreaRuleSegment[]> = {
  "1:200": [
    { type: "const", upper: 30, base: 0.23 },
    { type: "lin",   lower: 30,   upper: 100,  incPer10: 0.07 },
    { type: "lin",   lower: 100,  upper: 300,  incPer10: 0.05 },
    { type: "lin",   lower: 300,  upper: 500,  incPer10: 0.04 },
    { type: "lin",   lower: 500,  upper: 1000, incPer10: 0.03 },
    { type: "lin",   lower: 1000, upper: 2000, incPer10: 0.02 },
    { type: "lin",   lower: 2000, upper: Infinity, incPer10: 0.01 },
  ],
  "1:500": [
    { type: "const", upper: 30, base: 0.25 },
    { type: "lin",   lower: 30,   upper: 100,  incPer10: 0.08 },
    { type: "lin",   lower: 100,  upper: 300,  incPer10: 0.05 },
    { type: "lin",   lower: 300,  upper: 500,  incPer10: 0.04 },
    { type: "lin",   lower: 500,  upper: 1000, incPer10: 0.03 },
    { type: "lin",   lower: 1000, upper: 2000, incPer10: 0.02 },
    { type: "lin",   lower: 2000, upper: Infinity, incPer10: 0.01 },
  ],
  "1:1.000": [
    { type: "const", upper: 40, base: 0.35 },
    { type: "lin",   lower: 40,   upper: 300,  incPer10: 0.08 },
    { type: "lin",   lower: 300,  upper: 1000, incPer10: 0.05 },
    { type: "lin",   lower: 1000, upper: 2000, incPer10: 0.04 },
    { type: "lin",   lower: 2000, upper: 5000, incPer10: 0.03 },
    { type: "lin",   lower: 5000, upper: 10000, incPer10: 0.02 },
    { type: "lin",   lower: 10000, upper: Infinity, incPer10: 0.01 },
  ],
  "1:2.000": [
    { type: "const", upper: 40, base: 0.4 },
    { type: "lin",   lower: 40,   upper: 300,  incPer10: 0.09 },
    { type: "lin",   lower: 300,  upper: 1000, incPer10: 0.05 },
    { type: "lin",   lower: 1000, upper: 2000, incPer10: 0.04 },
    { type: "lin",   lower: 2000, upper: 5000, incPer10: 0.03 },
    { type: "lin",   lower: 5000, upper: 10000, incPer10: 0.02 },
    { type: "lin",   lower: 10000, upper: Infinity, incPer10: 0.01 },
  ],
  "1:5.000": [
    { type: "const", upper: 50, base: 0.5 },
    { type: "lin",   lower: 50,   upper: 300,  incPer10: 0.09 },
    { type: "lin",   lower: 300,  upper: 1000, incPer10: 0.05 },
    { type: "lin",   lower: 1000, upper: 2000, incPer10: 0.04 },
    { type: "lin",   lower: 2000, upper: 5000, incPer10: 0.03 },
    { type: "lin",   lower: 5000, upper: 10000, incPer10: 0.02 },
    { type: "lin",   lower: 10000, upper: Infinity, incPer10: 0.01 },
  ],
  "1:10.000": [
    { type: "const", upper: 50, base: 0.5 },
    { type: "lin",   lower: 50,   upper: 300,  incPer10: 0.09 },
    { type: "lin",   lower: 300,  upper: 1000, incPer10: 0.06 },
    { type: "lin",   lower: 1000, upper: 2000, incPer10: 0.05 },
    { type: "lin",   lower: 2000, upper: 5000, incPer10: 0.04 },
    { type: "lin",   lower: 5000, upper: 10000, incPer10: 0.03 },
    { type: "lin",   lower: 10000, upper: Infinity, incPer10: 0.02 },
  ],
};

// INIT: Tính toán các giá trị baseAtLower
function initRules() {
  // Edge Rules
  for (const [scale, segs] of Object.entries(EDGE_RULES)) {
    let lastUpperTol: number | null = null;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (i === 0) {
        lastUpperTol = seg.base ?? 0;
        continue;
      }
      seg.baseAtLower = lastUpperTol || 0;
      const span = seg.upper === Infinity ? null : (seg.upper - (seg.lower || 0));
      if (span !== null && seg.inc) {
        const fullMeters = Math.floor(span);
        lastUpperTol = (seg.baseAtLower || 0) + fullMeters * seg.inc;
      }
    }
  }

  // Area Rules
  for (const [scale, segs] of Object.entries(AREA_RULES)) {
    let lastUpperTol: number | null = null;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (i === 0) {
        lastUpperTol = seg.base ?? 0;
        continue;
      }
      if (!seg.baseAtLower) seg.baseAtLower = lastUpperTol || 0;
      const span = seg.upper === Infinity ? null : (seg.upper - (seg.lower || 0));
      if (span !== null && seg.incPer10) {
        lastUpperTol = (seg.baseAtLower || 0) + (span/10) * seg.incPer10;
      }
    }
  }
}

// Chạy init ngay khi import
initRules();

export function round(n: number, digits=2){
  if (!isFinite(n)) return n;
  const p = Math.pow(10, digits);
  return Math.round(n*p)/p;
}

export function calculateEdgeError(scale: string, D: number, apply12x: boolean) {
  if (!isFinite(D) || D <= 0) return { tolCm: null, detail: "D không hợp lệ" };
  const segs = EDGE_RULES[scale];
  if (!segs) return { tolCm: null, detail: "Không có quy tắc cho tỷ lệ này" };

  let tol = null;
  let used = null;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (D <= seg.upper) {
      if (seg.type === "const") {
        tol = seg.base || 0;
        used = `D ≤ ${seg.upper}: tol = ${seg.base} cm`;
      } else {
        // step by 1m, lấy cận dưới
        const fullMeters = Math.floor(Math.max(0, D - (seg.lower || 0)));
        tol = (seg.baseAtLower || 0) + fullMeters * (seg.inc || 0);
        used = `${seg.lower} < D ≤ ${seg.upper}: tol = base(${seg.lower}) ${round(seg.baseAtLower || 0, 2)} + floor(D-${seg.lower}) ${fullMeters} × ${seg.inc}`;
      }
      break;
    }
  }

  if (tol === null) {
    tol = segs[segs.length-1].baseAtLower || 0; // Fallback
    used = "fallback";
  }

  let mul = 1;
  if (apply12x && EDGE_ALLOW_12X.has(scale)) mul = 1.2;
  
  const tol2 = tol * mul;
  return {
    tolCm: tol2,
    detail: `${used}${mul !== 1 ? ` → ×${mul}` : ""}`,
    mul
  };
}

export function calculateAreaError(scale: string, S: number) {
  if (!isFinite(S) || S <= 0) return { tolM2: null, detail: "S không hợp lệ" };
  const segs = AREA_RULES[scale];
  if (!segs) return { tolM2: null, detail: "Không có quy tắc cho tỷ lệ này" };

  let tol = null;
  let used = null;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (S <= seg.upper) {
      if (seg.type === "const") {
        tol = seg.base || 0;
        used = `S ≤ ${seg.upper}: tol = ${seg.base} m²`;
      } else {
        const delta = Math.max(0, S - (seg.lower || 0));
        tol = (seg.baseAtLower || 0) + (delta/10) * (seg.incPer10 || 0);
        used = `${seg.lower} < S ≤ ${seg.upper}: tol = base(${seg.lower}) ${round(seg.baseAtLower || 0, 4)} + (S-${seg.lower})/10 × ${seg.incPer10}`;
      }
      break;
    }
  }

  return { tolM2: tol, detail: used };
}

export const ALLOWED_12X_SCALES = EDGE_ALLOW_12X;
