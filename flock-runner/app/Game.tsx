"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================================
 * Flock Runner — Count Masters tarzı kuş sürüsü koşu oyunu
 * ----------------------------------------------------------------------------
 * Kuşbakışı (top-down), dikey scroll. Sürü sabit hızla otomatik ilerler,
 * oyuncu yalnızca yatay (X) hareketi kontrol eder. Tüm mantık bu tek client
 * component içinde; sıfır harici oyun bağımlılığı, Canvas 2D.
 * ========================================================================== */

// ---- Sabitler ----------------------------------------------------------------
const FLOCK_Y_RATIO = 0.74; // Sürünün ekrandaki dikey konumu (alt-orta).
const MAX_DRAWN_BIRDS = 120; // Performans için çizilen maksimum kuş.
const SPACING_X = 13;
const SPACING_Y = 12;
const START_COUNT = 1;
const X_MARGIN = 36;
const FLAP_SPEED = 11;

type GateOp =
  | { kind: "add"; value: number }
  | { kind: "mul"; value: number }
  | { kind: "sub"; value: number };

type Entity =
  | { type: "gate"; worldY: number; resolved: boolean; left: GateOp; right: GateOp }
  | {
      type: "obstacle";
      worldY: number;
      resolved: boolean;
      kind: "storm" | "hawk" | "wire";
      bandX: number; // 0..1 oranı (yeniden boyutta ekran genişliğine çarpılır)
      bandW: number; // 0..1 oranı
    }
  | { type: "boss"; worldY: number; resolved: boolean; num: number };

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
}

interface GameState {
  status: "start" | "playing" | "gameover";
  count: number;
  best: number;
  level: number;
  progress: number; // Sürünün kat ettiği mesafe (px cinsinden, dünya birimi).
  worldSpeed: number;
  cx: number; // Sürü merkezinin ekran X'i.
  targetX: number; // İmleç/parmak/ok tuşu hedef X'i.
  cssW: number;
  cssH: number;
  entities: Entity[];
  particles: Particle[];
  shake: number;
  t: number; // Animasyon zamanı (kanat çırpma / jitter için).
  bannerTime: number; // "Level X" banner'ı için geri sayım.
  keys: { left: boolean; right: boolean };
}

// ---- Yardımcılar -------------------------------------------------------------
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

function vibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch {
    /* yoksay */
  }
}

const opText = (op: GateOp) =>
  op.kind === "add" ? `+${op.value}` : op.kind === "mul" ? `x${op.value}` : `-${op.value}`;

// Bir kapı işlemi sürüyü artırıyor mu? (yeşil mi kırmızı mı)
const opIsGood = (op: GateOp) => op.kind !== "sub";

function applyOp(count: number, op: GateOp): number {
  if (op.kind === "add") return count + op.value;
  if (op.kind === "mul") return Math.floor(count * op.value);
  return count - op.value;
}

// Üçgen "V" formasyonunda i'nci kuşun merkeze göre ofseti (kararlı/deterministik).
function flockSlot(i: number): { ox: number; oy: number } {
  const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
  const rowStart = (row * (row + 1)) / 2;
  const posInRow = i - rowStart;
  const w = row + 1;
  const ox = (posInRow - (w - 1) / 2) * SPACING_X;
  const oy = row * SPACING_Y; // Lider önde (üst), kalanı geride (alt = +y).
  return { ox, oy };
}

// ---- Level üretimi -----------------------------------------------------------
function makeGateOp(allowBad: boolean): GateOp {
  const r = Math.random();
  if (r < 0.45) return { kind: "add", value: randInt(3, 12) };
  if (r < 0.78) return { kind: "mul", value: randInt(2, 3) };
  if (allowBad) return { kind: "sub", value: randInt(2, 9) };
  return { kind: "add", value: randInt(3, 12) };
}

function makeGate(worldY: number, bothGood: boolean): Entity {
  let left = makeGateOp(!bothGood);
  let right = makeGateOp(!bothGood);
  // En az bir taraf iyi olsun (düşük sayılarda anında ölümü engelle).
  if (!opIsGood(left) && !opIsGood(right)) {
    right = makeGateOp(false);
  }
  // İki taraf birebir aynıysa biraz çeşitlendir.
  if (opText(left) === opText(right)) {
    right = makeGateOp(!bothGood);
    if (!opIsGood(left) && !opIsGood(right)) right = makeGateOp(false);
  }
  return { type: "gate", worldY, resolved: false, left, right };
}

function makeObstacle(worldY: number, level: number): Entity {
  const kinds: Array<"storm" | "hawk" | "wire"> = ["storm", "hawk", "wire"];
  const kind = kinds[randInt(0, kinds.length - 1)];
  if (kind === "wire") {
    // Tel: tüm genişliği kaplar, sadece bir boşluktan geçilir.
    const gapW = clamp(0.32 - level * 0.015, 0.16, 0.32);
    const gapX = rand(gapW / 2 + 0.05, 1 - gapW / 2 - 0.05);
    return { type: "obstacle", worldY, resolved: false, kind, bandX: gapX, bandW: gapW };
  }
  // Storm / hawk: tehlikeli bir bant; dışına kayarak kaçılır.
  const bandW = rand(0.22, 0.4);
  const bandX = rand(bandW / 2 + 0.04, 1 - bandW / 2 - 0.04);
  return { type: "obstacle", worldY, resolved: false, kind, bandX, bandW };
}

function generateLevel(level: number): Entity[] {
  const list: Entity[] = [];
  let y = 560;
  const numGates = Math.min(4 + level, 8);
  for (let g = 0; g < numGates; g++) {
    list.push(makeGate(y, g === 0)); // İlk kapı her iki taraf da iyi.
    y += 380;
    if (g < numGates - 1 && Math.random() < 0.72) {
      list.push(makeObstacle(y, level));
      y += 360;
    }
  }
  const bossNum = 20 + level * 15;
  list.push({ type: "boss", worldY: y + 240, resolved: false, num: bossNum });
  return list;
}

// =============================================================================
export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);

  // Yalnızca overlay/HUD DOM'u için React state (her frame değil).
  const [uiStatus, setUiStatus] = useState<"start" | "playing" | "gameover">(
    "start",
  );
  const [uiBest, setUiBest] = useState(0);
  const [uiScore, setUiScore] = useState(0);

  // ---- State başlat ----
  const freshState = useCallback((best: number): GameState => {
    const cssW = typeof window !== "undefined" ? window.innerWidth : 390;
    const cssH = typeof window !== "undefined" ? window.innerHeight : 780;
    return {
      status: "start",
      count: START_COUNT,
      best,
      level: 1,
      progress: 0,
      worldSpeed: 240,
      cx: cssW / 2,
      targetX: cssW / 2,
      cssW,
      cssH,
      entities: generateLevel(1),
      particles: [],
      shake: 0,
      t: 0,
      bannerTime: 0,
      keys: { left: false, right: false },
    };
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const best = s.best;
    Object.assign(s, freshState(best), {
      status: "playing",
      bannerTime: 1.6,
    });
    setUiStatus("playing");
  }, [freshState]);

  // ---- Particle üreticileri ----
  const spawnBurst = (
    s: GameState,
    x: number,
    y: number,
    n: number,
    color: string,
    speed: number,
  ) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(speed * 0.3, speed);
      s.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        maxLife: rand(0.5, 1.1),
        size: rand(2, 5),
        color,
      });
    }
  };

  const spawnText = (s: GameState, x: number, y: number, text: string, color: string) => {
    s.particles.push({
      x,
      y,
      vx: 0,
      vy: -42,
      life: 1,
      maxLife: 1.1,
      size: 26,
      color,
      text,
    });
  };

  // ---- Bir entity sürü hattını geçtiğinde çöz ----
  const resolveEntity = (s: GameState, e: Entity) => {
    const flockY = s.cssH * FLOCK_Y_RATIO;

    if (e.type === "gate") {
      const op = s.cx < s.cssW / 2 ? e.left : e.right;
      const before = s.count;
      s.count = Math.max(0, applyOp(s.count, op));
      const good = s.count >= before;
      const color = good ? "#46dc82" : "#f05050";
      spawnText(s, s.cx, flockY - 70, opText(op), color);
      if (op.kind === "mul" && op.value >= 2) {
        spawnBurst(s, s.cx, flockY, 18, "#ffe27a", 260);
      }
      if (!good) {
        s.shake = Math.max(s.shake, 8);
        vibrate(50);
        spawnBurst(s, s.cx, flockY, 12, "#f05050", 200);
      } else {
        spawnBurst(s, s.cx, flockY, 8, color, 160);
      }
    } else if (e.type === "obstacle") {
      const bandPx = e.bandX * s.cssW;
      const halfPx = (e.bandW * s.cssW) / 2;
      const inBand = s.cx >= bandPx - halfPx && s.cx <= bandPx + halfPx;
      // Tel için boşluk güvenli (içerideyken hasarsız); diğerlerinde bant tehlikeli.
      const hit = e.kind === "wire" ? !inBand : inBand;
      if (hit && s.count > 0) {
        let loss: number;
        if (e.kind === "storm") loss = Math.ceil(s.count * 0.3);
        else if (e.kind === "wire") loss = Math.ceil(s.count * 0.25);
        else loss = Math.min(s.count, 8 + s.level * 2); // hawk
        loss = Math.min(loss, s.count);
        s.count -= loss;
        s.shake = Math.max(s.shake, 11);
        vibrate(50);
        spawnText(s, s.cx, flockY - 70, `-${loss}`, "#f05050");
        spawnBurst(s, s.cx, flockY, 16, "#ffffff", 220);
        spawnBurst(s, s.cx, flockY, 10, "#9a9a9a", 180);
      }
    } else if (e.type === "boss") {
      const cx = s.cssW / 2;
      if (s.count > e.num) {
        // Kazandın: düşman sürüsü tüy patlamasıyla dağılır.
        const casualties = Math.floor(e.num / 2);
        s.count = Math.max(1, s.count - casualties);
        s.shake = Math.max(s.shake, 14);
        spawnBurst(s, cx, flockY - 110, 60, "#ffffff", 360);
        spawnBurst(s, cx, flockY - 110, 30, "#cfcfcf", 300);
        spawnText(s, cx, flockY - 150, "KAZANDIN!", "#46dc82");
        vibrate(40);
        // Sonraki level.
        s.level += 1;
        s.progress = 0;
        s.worldSpeed = Math.min(380, 240 + (s.level - 1) * 16);
        s.entities = generateLevel(s.level);
        s.bannerTime = 1.6;
        return; // entity'ler değişti, döngü güvenli biter.
      } else {
        // Kaybettin.
        s.shake = Math.max(s.shake, 16);
        spawnBurst(s, s.cx, flockY, 40, "#f05050", 320);
        vibrate(120);
        endGame(s);
      }
    }
  };

  const endGame = (s: GameState) => {
    s.status = "gameover";
    if (s.count > s.best) s.best = s.count;
    try {
      localStorage.setItem("flockRunnerBest", String(s.best));
    } catch {
      /* yoksay */
    }
    setUiScore(s.count);
    setUiBest(s.best);
    setUiStatus("gameover");
  };

  // ---- Update ----
  const update = (s: GameState, dt: number) => {
    s.t += dt;
    if (s.status !== "playing") return;

    if (s.bannerTime > 0) s.bannerTime = Math.max(0, s.bannerTime - dt);

    // Ok tuşları hedef X'i kaydırır.
    const keySpeed = 620;
    if (s.keys.left) s.targetX -= keySpeed * dt;
    if (s.keys.right) s.targetX += keySpeed * dt;
    s.targetX = clamp(s.targetX, X_MARGIN, s.cssW - X_MARGIN);

    // Sürü merkezi hedefe yumuşak (lerp/damping) yaklaşır — jitter olmasın.
    s.cx += (s.targetX - s.cx) * Math.min(1, dt * 12);
    s.cx = clamp(s.cx, X_MARGIN, s.cssW - X_MARGIN);

    // Sabit ileri hız.
    s.progress += s.worldSpeed * dt;

    // Sürü hattını geçen entity'leri çöz.
    for (const e of s.entities) {
      if (!e.resolved && s.progress >= e.worldY) {
        e.resolved = true;
        resolveEntity(s, e);
        if (s.status !== "playing") break;
      }
    }

    if (s.count > s.best) s.best = s.count;
    if (s.count <= 0 && s.status === "playing") {
      s.count = 0;
      endGame(s);
    }

    // Particles.
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.life -= dt / p.maxLife;
      if (p.life <= 0) {
        s.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }

    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 26);
  };

  // ---- Çizim yardımcıları ----
  const worldToScreenY = (s: GameState, worldY: number) =>
    s.cssH * FLOCK_Y_RATIO - (worldY - s.progress);

  const drawBackground = (ctx: CanvasRenderingContext2D, s: GameState) => {
    const grad = ctx.createLinearGradient(0, 0, 0, s.cssH);
    grad.addColorStop(0, "#cdecff");
    grad.addColorStop(0.55, "#dff1ec");
    grad.addColorStop(1, "#eef7e6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s.cssW, s.cssH);

    // Aşağı akan hareket çizgileri — "yukarı ilerliyoruz" hissi.
    const gap = 120;
    const off = (s.progress * 0.5) % gap;
    ctx.strokeStyle = "rgba(120,150,120,0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = -gap + off; y < s.cssH + gap; y += gap) {
      for (let lane = 0; lane < 5; lane++) {
        const x = (lane + 0.5) * (s.cssW / 5) + ((lane % 2) * gap) / 2;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 26);
      }
    }
    ctx.stroke();
  };

  const drawBird = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    phase: number,
  ) => {
    const flap = Math.sin(phase);
    const tip = y + size * 0.5 + flap * size * 0.35;
    ctx.moveTo(x - size, tip);
    ctx.lineTo(x, y);
    ctx.lineTo(x + size, tip);
  };

  const drawFlock = (ctx: CanvasRenderingContext2D, s: GameState) => {
    const flockY = s.cssH * FLOCK_Y_RATIO;
    const drawn = Math.min(s.count, MAX_DRAWN_BIRDS);

    // Normal kuşları tek path'te toplu çiz (performans).
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(60,80,90,0.35)";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    for (let i = 1; i < drawn; i++) {
      const slot = flockSlot(i);
      const jx = Math.sin(s.t * 3 + i * 1.3) * 2.2;
      const jy = Math.cos(s.t * 2.5 + i * 0.7) * 2.2;
      const x = s.cx + slot.ox + jx;
      const y = flockY + slot.oy + jy;
      drawBird(ctx, x, y, 6, s.t * FLAP_SPEED + i * 0.9);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lider kuş — turuncu vurgulu, biraz daha büyük.
    const lead = flockSlot(0);
    const lx = s.cx + lead.ox;
    const ly = flockY + lead.oy;
    ctx.strokeStyle = "#ff8a3d";
    ctx.lineWidth = 4;
    ctx.beginPath();
    drawBird(ctx, lx, ly, 10, s.t * FLAP_SPEED);
    ctx.stroke();

    // Lider üstündeki büyük sayaç.
    const label = String(s.count);
    ctx.font = "900 38px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.strokeText(label, lx, ly - 42);
    ctx.fillStyle = "#27384a";
    ctx.fillText(label, lx, ly - 42);
  };

  const drawGate = (ctx: CanvasRenderingContext2D, s: GameState, e: Entity) => {
    if (e.type !== "gate") return;
    const y = worldToScreenY(s, e.worldY);
    const h = 92;
    const top = y - h;
    const mid = s.cssW / 2;
    const panels: Array<[number, number, GateOp]> = [
      [0, mid, e.left],
      [mid, mid, e.right],
    ];
    for (const [px, pw, op] of panels) {
      const good = opIsGood(op);
      ctx.fillStyle = good ? "rgba(70,220,130,0.30)" : "rgba(240,80,80,0.30)";
      ctx.fillRect(px, top, pw, h);
      ctx.strokeStyle = good ? "#33c878" : "#e84a4a";
      ctx.lineWidth = 4;
      ctx.strokeRect(px + 2, top, pw - 4, h);
      ctx.font = "900 34px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.strokeStyle = good ? "#2aa863" : "#c23636";
      ctx.strokeText(opText(op), px + pw / 2, top + h / 2);
      ctx.fillText(opText(op), px + pw / 2, top + h / 2);
    }
    // Orta direk.
    ctx.fillStyle = "rgba(60,70,80,0.5)";
    ctx.fillRect(mid - 2, top, 4, h);
  };

  const drawObstacle = (ctx: CanvasRenderingContext2D, s: GameState, e: Entity) => {
    if (e.type !== "obstacle") return;
    const y = worldToScreenY(s, e.worldY);
    const bandPx = e.bandX * s.cssW;
    const halfPx = (e.bandW * s.cssW) / 2;

    if (e.kind === "wire") {
      // Elektrik teli: tam genişlik, boşluk hariç.
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(bandPx - halfPx, y);
      ctx.moveTo(bandPx + halfPx, y);
      ctx.lineTo(s.cssW, y);
      ctx.stroke();
      // Kıvılcım/uyarı.
      ctx.strokeStyle = "rgba(255,210,60,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < s.cssW; x += 26) {
        if (x > bandPx - halfPx && x < bandPx + halfPx) continue;
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 8, y + 6);
      }
      ctx.stroke();
      return;
    }

    if (e.kind === "storm") {
      // Fırtına bulutu — gri bulut bandı.
      ctx.fillStyle = "rgba(90,100,115,0.55)";
      for (let i = 0; i < 6; i++) {
        const cx = bandPx - halfPx + (i / 5) * halfPx * 2;
        const r = 22 + Math.sin(s.t * 2 + i) * 4;
        ctx.beginPath();
        ctx.arc(cx, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Atmaca (yırtıcı kuş) — koyu bir V şekli.
      ctx.strokeStyle = "#403a35";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      const wob = Math.sin(s.t * 6) * 6;
      ctx.moveTo(bandPx - halfPx, y + 10 + wob);
      ctx.lineTo(bandPx, y - 14);
      ctx.lineTo(bandPx + halfPx, y + 10 - wob);
      ctx.stroke();
    }
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, s: GameState, e: Entity) => {
    if (e.type !== "boss") return;
    const y = worldToScreenY(s, e.worldY);
    const cx = s.cssW / 2;
    const drawn = Math.min(e.num, MAX_DRAWN_BIRDS);
    ctx.strokeStyle = "#3a2f3a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < drawn; i++) {
      const slot = flockSlot(i);
      // Düşman sürüsü aşağı bakar (bize doğru): formasyonu ters çevir.
      const x = cx - slot.ox + Math.sin(s.t * 3 + i) * 2;
      const by = y - slot.oy + Math.cos(s.t * 2.4 + i) * 2;
      const flap = Math.sin(s.t * FLAP_SPEED + i);
      const size = 6;
      const tip = by - size * 0.5 - flap * size * 0.35;
      ctx.moveTo(x - size, tip);
      ctx.lineTo(x, by);
      ctx.lineTo(x + size, tip);
    }
    ctx.stroke();

    const label = String(e.num);
    ctx.font = "900 40px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.strokeText(label, cx, y + 46);
    ctx.fillStyle = "#7a2f3a";
    ctx.fillText(label, cx, y + 46);
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, s: GameState) => {
    for (const p of s.particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      if (p.text) {
        ctx.font = `900 ${p.size}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawHud = (ctx: CanvasRenderingContext2D, s: GameState) => {
    ctx.font = "800 16px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(40,55,70,0.8)";
    ctx.textAlign = "left";
    ctx.fillText(`Rekor: ${s.best}`, 16, 16);
    ctx.textAlign = "right";
    ctx.fillText(`Level ${s.level}`, s.cssW - 16, 16);

    if (s.bannerTime > 0) {
      const a = clamp(s.bannerTime / 1.6, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = "900 44px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(40,55,70,0.85)";
      ctx.fillText(`LEVEL ${s.level}`, s.cssW / 2, s.cssH * 0.32);
      ctx.globalAlpha = 1;
    }
  };

  // ---- Ana döngü ----
  const draw = (ctx: CanvasRenderingContext2D, s: GameState) => {
    ctx.save();
    if (s.shake > 0) {
      ctx.translate(rand(-s.shake, s.shake), rand(-s.shake, s.shake));
    }
    drawBackground(ctx, s);

    // Yalnızca ekrana yakın entity'leri çiz.
    for (const e of s.entities) {
      if (e.resolved) continue;
      const y = worldToScreenY(s, e.worldY);
      if (y < -260 || y > s.cssH + 160) continue;
      if (e.type === "gate") drawGate(ctx, s, e);
      else if (e.type === "obstacle") drawObstacle(ctx, s, e);
      else drawBoss(ctx, s, e);
    }

    drawFlock(ctx, s);
    drawParticles(ctx, s);
    drawHud(ctx, s);
    ctx.restore();
  };

  // ---- Mount: state, input, rAF döngüsü ----
  useEffect(() => {
    let best = 0;
    try {
      best = parseInt(localStorage.getItem("flockRunnerBest") || "0", 10) || 0;
    } catch {
      /* yoksay */
    }
    stateRef.current = freshState(best);
    setUiBest(best);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ---- Boyutlandırma (DPR ölçekli) ----
    const resize = () => {
      const s = stateRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.cssW = window.innerWidth;
      s.cssH = window.innerHeight;
      canvas.width = Math.floor(s.cssW * dpr);
      canvas.height = Math.floor(s.cssH * dpr);
      canvas.style.width = `${s.cssW}px`;
      canvas.style.height = `${s.cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Başlangıçta merkezi koru.
      if (s.status === "start") {
        s.cx = s.cssW / 2;
        s.targetX = s.cssW / 2;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- Pointer / touch kontrolü ----
    const setTargetFromClient = (clientX: number) => {
      const s = stateRef.current!;
      const rect = canvas.getBoundingClientRect();
      s.targetX = clamp(clientX - rect.left, X_MARGIN, s.cssW - X_MARGIN);
    };
    const onPointerMove = (ev: PointerEvent) => {
      // Fare hover'la, dokunmatikte sürüklerken takip et.
      if (ev.pointerType === "mouse" || ev.pressure > 0 || ev.buttons > 0) {
        setTargetFromClient(ev.clientX);
      }
    };
    const onPointerDown = (ev: PointerEvent) => setTargetFromClient(ev.clientX);
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length > 0) setTargetFromClient(ev.touches[0].clientX);
      ev.preventDefault();
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchstart", onTouchMove, { passive: false });

    // ---- Klavye ----
    const onKeyDown = (ev: KeyboardEvent) => {
      const s = stateRef.current!;
      if (ev.key === "ArrowLeft") s.keys.left = true;
      else if (ev.key === "ArrowRight") s.keys.right = true;
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      const s = stateRef.current!;
      if (ev.key === "ArrowLeft") s.keys.left = false;
      else if (ev.key === "ArrowRight") s.keys.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ---- rAF ----
    let last = performance.now();
    const loop = (now: number) => {
      const s = stateRef.current!;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05; // büyük sıçramaları sınırla
      update(s, dt);
      draw(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchstart", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />

      {/* Tap-to-start overlay */}
      {uiStatus === "start" && (
        <Overlay>
          <h1 style={titleStyle}>🕊️ Flock Runner</h1>
          <p style={subStyle}>
            Sürünü topla, kapılardan geç, engellerden kaç.
            <br />
            Parmağını / fareni sürükle veya ok tuşlarını kullan.
          </p>
          <button style={btnStyle} onClick={startGame}>
            Başlamak için dokun
          </button>
          {uiBest > 0 && <p style={bestStyle}>En iyi: {uiBest}</p>}
        </Overlay>
      )}

      {/* Game over overlay */}
      {uiStatus === "gameover" && (
        <Overlay>
          <h1 style={titleStyle}>Oyun Bitti</h1>
          <p style={subStyle}>
            Skorun: <b>{uiScore}</b>
            <br />
            En iyi: <b>{uiBest}</b>
          </p>
          <button style={btnStyle} onClick={startGame}>
            Tekrar oyna
          </button>
        </Overlay>
      )}
    </div>
  );
}

// ---- Overlay / stiller -------------------------------------------------------
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        textAlign: "center",
        padding: 24,
        background:
          "radial-gradient(120% 80% at 50% 40%, rgba(255,255,255,0.55), rgba(190,225,255,0.75))",
        backdropFilter: "blur(2px)",
      }}
    >
      {children}
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 900,
  color: "#27384a",
  letterSpacing: -1,
};

const subStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.5,
  color: "#3c4f63",
  fontWeight: 600,
  maxWidth: 340,
};

const bestStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#5a6b7d",
  fontWeight: 700,
};

const btnStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#fff",
  background: "linear-gradient(180deg,#41c878,#2ba35e)",
  border: "none",
  borderRadius: 999,
  padding: "16px 34px",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(43,163,94,0.4)",
  WebkitTapHighlightColor: "transparent",
};
