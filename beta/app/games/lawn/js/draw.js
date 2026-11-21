// 所有画面都用 canvas 画，不依赖外部素材，断网也能播。
import { VIEW, HUD_H, BOARD, SIDE } from './config.js';
import { PLANTS, PLANT_MAP } from './data.js';

const W = VIEW.W;
const H = VIEW.H;
const PI = Math.PI;
export const FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC","Hiragino Sans GB",sans-serif';

const C = {
  gold: '#f3c34b',
  goldDim: '#b98a2c',
  cream: '#fff3d2',
  ink: '#3a2412',
  wood: '#2a1a0e',
  wood2: '#1a1009',
  green: '#63b23c',
  green2: '#57a333',
  panel: 'rgba(17,28,14,0.82)',
  panel2: 'rgba(24,38,18,0.9)',
  line: 'rgba(243,195,75,0.28)',
  red: '#e05a4a'
};

export function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function txt(ctx, text, x, y, size, color, o = {}) {
  ctx.save();
  ctx.font = `${o.weight || 'bold'} ${size}px ${FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'middle';
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 8; }
  if (o.outline) {
    ctx.lineWidth = o.outline;
    ctx.strokeStyle = o.outlineColor || 'rgba(0,0,0,0.6)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function cut(str, n) {
  const s = String(str == null ? '' : str);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function ell(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function groundShadow(ctx, x, y, rx, alpha = 0.22) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.32);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fill();
  ctx.restore();
}

/* ───────────────────────── 场景 ───────────────────────── */

function drawLawn(ctx, t) {
  const { x, y, cellW, cellH, cols, rows } = BOARD;
  ctx.fillStyle = '#4f942b';
  ctx.fillRect(x, y, cellW * cols, cellH * rows);

  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = r % 2 === 0 ? '#63b23c' : '#5aa634';
    ctx.fillRect(x, y + r * cellH, cellW * cols, cellH);
    // 割草机压出来的浅色竖条
    for (let bx = 0; bx < cols * cellW; bx += 62) {
      ctx.fillStyle = (Math.floor(bx / 62) + r) % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(20,70,10,0.045)';
      ctx.fillRect(x + bx, y + r * cellH, 30, cellH);
    }
    // 草叶
    for (let c = 0; c < cols; c++) {
      for (let k = 0; k < 3; k++) {
        const px = x + c * cellW + 14 + hash(r * 17 + c, k) * (cellW - 28);
        const py = y + r * cellH + 26 + hash(c * 31 + r, k + 9) * (cellH - 48);
        const lean = (hash(c, r + k) - 0.5) * 6;
        ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(30,90,20,0.20)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py + 5);
        ctx.quadraticCurveTo(px + lean, py - 2, px + lean * 1.8, py - 7);
        ctx.stroke();
      }
    }
  }

  // 网格
  ctx.strokeStyle = 'rgba(24,72,14,0.24)';
  ctx.lineWidth = 1.5;
  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(x + c * cellW, y);
    ctx.lineTo(x + c * cellW, y + rows * cellH);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * cellH);
    ctx.lineTo(x + cols * cellW, y + r * cellH);
    ctx.stroke();
  }

  // 土边
  ctx.fillStyle = '#5c3a20';
  ctx.fillRect(x, y + rows * cellH, cellW * cols, 8);
  ctx.fillStyle = '#4a2e19';
  ctx.fillRect(x, y + rows * cellH + 8, cellW * cols, 5);

  // 右侧渐入阴影，怪物从阴影里出来
  const g = ctx.createLinearGradient(x + cols * cellW - 110, 0, x + cols * cellW + 20, 0);
  g.addColorStop(0, 'rgba(8,16,6,0)');
  g.addColorStop(1, 'rgba(8,16,6,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(x + cols * cellW - 110, y, 130, rows * cellH);
}

function drawPatio(ctx) {
  const { x, y, rows, cellH } = BOARD;
  const h = rows * cellH;
  const g = ctx.createLinearGradient(0, 0, x, 0);
  g.addColorStop(0, '#9d8f74');
  g.addColorStop(1, '#c3b596');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, x, h);
  // 石板缝
  ctx.strokeStyle = 'rgba(70,58,38,0.28)';
  ctx.lineWidth = 2;
  for (let py = y; py < y + h; py += 56) {
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(x, py);
    ctx.stroke();
  }
  for (let px = 34; px < x; px += 38) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + h);
    ctx.stroke();
  }
  // 台阶边
  ctx.fillStyle = 'rgba(60,48,30,0.22)';
  ctx.fillRect(x - 8, y, 8, h);
}

function drawStreet(ctx) {
  const x = BOARD.r;
  ctx.fillStyle = '#33322d';
  ctx.fillRect(x, HUD_H, W - x, BOARD.b - HUD_H);
  // 路缘
  ctx.fillStyle = '#8d897c';
  ctx.fillRect(x, HUD_H, 12, BOARD.b - HUD_H);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 12, HUD_H, 6, BOARD.b - HUD_H);
  // 柏油颗粒
  for (let i = 0; i < 160; i++) {
    const px = x + 24 + hash(i, 3) * (W - x - 30);
    const py = HUD_H + hash(i, 7) * (BOARD.b - HUD_H);
    ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect(px, py, 2, 2);
  }
  // 路灯杆，藏在侧栏后面
  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(1700, 150, 10, 810);
}

function drawBackdrop(ctx, st) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#152312');
  g.addColorStop(1, '#0e180b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawStreet(ctx);
  drawLawn(ctx, st.t);
  drawPatio(ctx);
}

/* ───────────────────────── 守卫 ───────────────────────── */

function leaf(ctx, x, y, rx, ry, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawGlowbud(ctx, p, t) {
  const sway = Math.sin(t * 1.7 + p.seed) * 0.03;
  ctx.save();
  ctx.rotate(sway);
  ctx.strokeStyle = '#3f7d2a';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(3, -32, 0, -56);
  ctx.stroke();
  leaf(ctx, -4, -38, 20, 9, -0.55, '#4f9a32');
  leaf(ctx, 5, -48, 17, 8, 0.65, '#5cae3c');

  const hy = -86 + Math.sin(t * 2 + p.seed) * 2;
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * PI * 2 + Math.sin(t * 0.7 + p.seed) * 0.05;
    ctx.save();
    ctx.translate(Math.cos(a) * 30, hy + Math.sin(a) * 30);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.5, 19, 0, 0, PI * 2);
    ctx.fillStyle = i % 2 ? '#ffd23f' : '#ffb703';
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,105,10,0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, hy, 23, 0, PI * 2);
  ctx.fillStyle = '#7a4a1c';
  ctx.fill();
  ctx.strokeStyle = '#5a3412';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, hy, 18, 0, PI * 2);
  ctx.fillStyle = '#8d5a24';
  ctx.fill();
  // 脸
  ctx.fillStyle = '#2d1a0c';
  ell(ctx, -8, hy - 4, 3.2, 4.4, '#2d1a0c');
  ell(ctx, 8, hy - 4, 3.2, 4.4, '#2d1a0c');
  ctx.strokeStyle = '#2d1a0c';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, hy + 3, 8, 0.25 * PI, 0.75 * PI);
  ctx.stroke();
  ctx.restore();
}

function drawShooter(ctx, p, t, icy) {
  const recoil = p.recoil || 0;
  const body = icy ? '#8fe0f2' : '#6fc23f';
  const dark = icy ? '#3f8fa8' : '#2f6b1f';
  const light = icy ? '#d7f8ff' : '#a6e06a';

  ctx.save();
  ctx.rotate(Math.sin(t * 1.5 + p.seed) * 0.015);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(2, -30, 0, -52);
  ctx.stroke();
  leaf(ctx, -5, -34, 18, 8, -0.5, icy ? '#63b6c9' : '#4f9a32');
  // 脖子上的小叶子，把头从草地里托出来
  leaf(ctx, -14, -58, 13, 6, -2.1, dark);

  ctx.translate(-recoil * 7, 0);
  const g = ctx.createLinearGradient(0, -100, 0, -50);
  g.addColorStop(0, light);
  g.addColorStop(0.55, body);
  g.addColorStop(1, body);
  ctx.beginPath();
  ctx.arc(0, -74, 26, 0, PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  ctx.stroke();
  // 炮口
  ctx.save();
  ctx.translate(19, -82);
  rr(ctx, 0, -14, 31, 28, 13);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(28, 0, 9, 0, PI * 2);
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, 0, 11, 0, PI * 2);
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(31, 0, 6.8, 0, PI * 2);
  ctx.fillStyle = 'rgba(8,24,8,0.8)';
  ctx.fill();
  ctx.restore();
  // 眼睛
  ctx.beginPath();
  ctx.arc(-4, -82, 9.5, 0, PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,60,20,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ell(ctx, -2, -82, 4.2, 5, '#20140a');
  ell(ctx, 0, -84, 1.4, 1.6, 'rgba(255,255,255,0.9)');
  // 高光
  ctx.beginPath();
  ctx.arc(-7, -86, 6, PI * 0.9, PI * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (icy) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.6;
    const sx = 8;
    const sy = -108;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI;
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(a) * 5, sy - Math.sin(a) * 5);
      ctx.lineTo(sx + Math.cos(a) * 5, sy + Math.sin(a) * 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWoodshield(ctx, p, t) {
  const ratio = p.hp / p.maxHp;
  const g = ctx.createLinearGradient(0, -110, 0, 0);
  g.addColorStop(0, '#c98c4b');
  g.addColorStop(0.55, '#b5793c');
  g.addColorStop(1, '#8a5527');
  ctx.beginPath();
  ctx.ellipse(0, -55, 39, 55, 0, 0, PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,20,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // 顶部亮面
  ctx.beginPath();
  ctx.ellipse(-6, -92, 26, 14, -0.15, 0, PI * 2);
  ctx.fillStyle = 'rgba(255,220,160,0.22)';
  ctx.fill();
  // 脸
  const blink = Math.sin(t * 0.9 + p.seed) > 0.96 ? 0.2 : 1;
  ctx.fillStyle = '#2d1a0c';
  ctx.beginPath();
  ctx.ellipse(-13, -64, 4.5, 6 * blink, 0, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(13, -64, 4.5, 6 * blink, 0, 0, PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2d1a0c';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, -54, 11, 0.15 * PI, 0.85 * PI);
  ctx.stroke();
  // 裂纹
  if (ratio < 0.66) {
    ctx.strokeStyle = 'rgba(60,30,10,0.75)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-26, -88);
    ctx.lineTo(-16, -74);
    ctx.lineTo(-22, -62);
    ctx.stroke();
  }
  if (ratio < 0.33) {
    ctx.beginPath();
    ctx.moveTo(28, -80);
    ctx.lineTo(18, -68);
    ctx.lineTo(26, -50);
    ctx.lineTo(16, -36);
    ctx.stroke();
  }
}

function drawBlastfruit(ctx, p, t) {
  const pulse = p.fuse != null ? 1 + Math.sin(t * 18) * 0.04 + (1 - p.fuse) * 0.12 : 1;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#4f8a2f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, -50);
  ctx.quadraticCurveTo(-6, -78, 0, -84);
  ctx.quadraticCurveTo(8, -78, 16, -52);
  ctx.stroke();
  leaf(ctx, 2, -84, 12, 6, -0.5, '#5cae3c');
  for (const [cx, cy, r] of [[-17, -40, 23], [17, -36, 25]]) {
    const g = ctx.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, r + 4);
    g.addColorStop(0, '#ff6b5e');
    g.addColorStop(0.55, '#d92b2b');
    g.addColorStop(1, '#9d1414');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#7d1010';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#20100a';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 4, 3.4, 4.6, 0, 0, PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy - 4, 3.4, 4.6, 0, 0, PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20100a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 12);
    ctx.lineTo(cx - 3, cy - 8);
    ctx.moveTo(cx + 9, cy - 12);
    ctx.lineTo(cx + 3, cy - 8);
    ctx.stroke();
  }
  // 引线火花
  const spark = 2 + Math.sin(t * 20) * 1.6;
  ctx.fillStyle = '#ffd84d';
  ctx.beginPath();
  ctx.arc(0, -88, spark, 0, PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawQuaker(ctx, p, t) {
  if (!p.armed) {
    ctx.beginPath();
    ctx.ellipse(0, -10, 40, 17, 0, 0, PI * 2);
    ctx.fillStyle = '#6b4a2a';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -14, 30, 11, 0, 0, PI * 2);
    ctx.fillStyle = '#8a6238';
    ctx.fill();
    ctx.strokeStyle = '#5cae3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(4, -32, 2, -38);
    ctx.stroke();
    leaf(ctx, 6, -36, 8, 4, 0.6, '#5cae3c');
    // 读条
    const prog = 1 - Math.max(0, p.armLeft) / 11;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, -26, -54, 52, 7, 3.5);
    ctx.fill();
    ctx.fillStyle = '#f3c34b';
    rr(ctx, -26, -54, 52 * prog, 7, 3.5);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(-8, -34, 6, 0, -26, 42);
    g.addColorStop(0, '#c08a50');
    g.addColorStop(1, '#8a5a2d');
    ctx.beginPath();
    ctx.ellipse(0, -26, 38, 27, 0, 0, PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#5f3a1a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#2d1a0c';
    ell(ctx, -11, -32, 4, 5, '#2d1a0c');
    ell(ctx, 11, -32, 4, 5, '#2d1a0c');
    ctx.strokeStyle = '#2d1a0c';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -22, 9, 0.2 * PI, 0.8 * PI);
    ctx.stroke();
    if (Math.sin(t * 7) > 0) {
      ctx.fillStyle = '#ff4b3a';
      ctx.beginPath();
      ctx.arc(0, -62, 5, 0, PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,75,58,0.25)';
      ctx.beginPath();
      ctx.arc(0, -62, 12, 0, PI * 2);
      ctx.fill();
    }
    leaf(ctx, 0, -50, 9, 5, -1.1, '#5cae3c');
  }
}

export function drawPlantSprite(ctx, type, t, p) {
  if (type === 'glowbud') drawGlowbud(ctx, p, t);
  else if (type === 'peashot') drawShooter(ctx, p, t, false);
  else if (type === 'frostshot') drawShooter(ctx, p, t, true);
  else if (type === 'woodshield') drawWoodshield(ctx, p, t);
  else if (type === 'blastfruit') drawBlastfruit(ctx, p, t);
  else if (type === 'quaker') drawQuaker(ctx, p, t);
}

export function drawIcon(ctx, type, cx, cy, size, t = 1) {
  const p = { hp: 1, maxHp: 1, seed: 0, recoil: 0, armed: true, fuse: null, armLeft: 0 };
  const k = size / 150;
  ctx.save();
  ctx.translate(cx, cy + size * 0.34);
  ctx.scale(k, k);
  drawPlantSprite(ctx, type, t, p);
  ctx.restore();
}

export function drawPlant(ctx, p, t) {
  groundShadow(ctx, p.x, p.y + 2, 46, 0.2);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1.28, 1.28);
  drawPlantSprite(ctx, p.type, t, p);
  ctx.restore();
  // 刚部署时显示是谁种的
  if (p.tagT > 0) {
    const a = Math.min(1, p.tagT * 1.5);
    const y = p.y - 152 - (3 - p.tagT) * 6;
    ctx.save();
    ctx.globalAlpha = a;
    const label = cut('@' + p.owner, 9);
    ctx.font = `bold 13px ${FONT}`;
    const w = ctx.measureText(label).width + 16;
    rr(ctx, p.x - w / 2, y - 11, w, 22, 11);
    ctx.fillStyle = 'rgba(14,26,10,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(243,195,75,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    txt(ctx, label, p.x, y + 1, 13, '#ffe6a6', { align: 'center' });
    ctx.restore();
  }
}

/* ───────────────────────── 怪物 ───────────────────────── */

function foeLeg(ctx, x, swing, color) {
  ctx.save();
  ctx.translate(x, -46);
  ctx.rotate(swing * 0.34);
  rr(ctx, -7, 0, 14, 50, 6);
  ctx.fillStyle = color;
  ctx.fill();
  // 鞋
  rr(ctx, -11, 42, 18, 11, 5);
  ctx.fillStyle = '#2a1a0e';
  ctx.fill();
  ctx.restore();
}

function drawFoeBody(ctx, z, t) {
  const walking = !z.eating;
  const swing = walking ? Math.sin(z.walkT * 6 + z.phase) : 0.25;
  const skin = z.type === 'giant' ? '#8aa477' : '#9fb68a';
  const suit = z.type === 'giant' ? '#3a2f4a' : '#4b3d5e';

  // 后腿 / 后手
  foeLeg(ctx, 10, -swing, '#3f3352');
  ctx.save();
  ctx.strokeStyle = '#8aa176';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -88);
  ctx.quadraticCurveTo(-30, -80, -46, -72);
  ctx.stroke();
  ctx.restore();

  // 前腿
  foeLeg(ctx, -10, swing, '#54456b');

  // 身体
  const g = ctx.createLinearGradient(0, -104, 0, -46);
  g.addColorStop(0, suit);
  g.addColorStop(1, '#372b47');
  rr(ctx, -24, -104, 48, 60, 12);
  ctx.fillStyle = g;
  ctx.fill();
  // 破衣角
  ctx.beginPath();
  ctx.moveTo(-24, -58);
  ctx.lineTo(-18, -48);
  ctx.lineTo(-10, -58);
  ctx.lineTo(-2, -47);
  ctx.lineTo(6, -58);
  ctx.lineTo(14, -48);
  ctx.lineTo(24, -58);
  ctx.lineTo(24, -46);
  ctx.lineTo(-24, -46);
  ctx.closePath();
  ctx.fillStyle = '#372b47';
  ctx.fill();
  // 领子 + 领带
  ctx.fillStyle = '#d9d2c2';
  ctx.beginPath();
  ctx.moveTo(-10, -104);
  ctx.lineTo(0, -94);
  ctx.lineTo(10, -104);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a83232';
  ctx.beginPath();
  ctx.moveTo(-4, -96);
  ctx.lineTo(4, -96);
  ctx.lineTo(7, -66);
  ctx.lineTo(0, -58);
  ctx.lineTo(-7, -66);
  ctx.closePath();
  ctx.fill();

  // 前手
  ctx.save();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-16, -92);
  ctx.quadraticCurveTo(-38, -86, -54, -78);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-57, -77, 8.5, 0, PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  // 手指
  ctx.strokeStyle = '#7e9770';
  ctx.lineWidth = 2.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-62, -77 + i * 3);
    ctx.lineTo(-68, -75 + i * 4);
    ctx.stroke();
  }
  ctx.restore();

  // 头
  ctx.save();
  ctx.translate(0, -122);
  if (z.eating) ctx.rotate(Math.sin(z.walkT * 9) * 0.06 + 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 27, 0, 0, PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  // 耳朵
  ctx.beginPath();
  ctx.ellipse(23, 2, 6, 9, 0, 0, PI * 2);
  ctx.fill();
  // 头发
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.ellipse(-4, -22, 20, 9, 0.15, PI, PI * 2);
  ctx.fill();
  // 眼窝
  ctx.fillStyle = 'rgba(30,40,20,0.45)';
  ell(ctx, -10, -4, 8, 9, 'rgba(30,40,20,0.35)');
  ell(ctx, 7, -4, 7, 8, 'rgba(30,40,20,0.35)');
  ell(ctx, -11, -3, 5, 6, '#f2f0dc');
  ell(ctx, 6, -3, 4.5, 5.5, '#f2f0dc');
  ell(ctx, -13, -3, 2.4, 3, '#1a140c');
  ell(ctx, 4, -3, 2.2, 2.8, '#1a140c');
  // 嘴
  ctx.fillStyle = '#2a1a12';
  rr(ctx, -17, 10, 26, 9, 4);
  ctx.fill();
  ctx.fillStyle = '#e8e0c8';
  ctx.fillRect(-14, 10, 4, 5);
  ctx.fillRect(-4, 10, 4, 4);
  ctx.fillRect(8, 10, 4, 5);

  // 帽子
  if (z.type === 'cone') {
    ctx.beginPath();
    ctx.moveTo(-25, -20);
    ctx.lineTo(0, -78);
    ctx.lineTo(25, -20);
    ctx.closePath();
    ctx.fillStyle = '#e08a2e';
    ctx.fill();
    ctx.strokeStyle = '#b96a1c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f6e7cf';
    ctx.fillRect(-17, -46, 34, 8);
  } else if (z.type === 'bucket') {
    rr(ctx, -27, -74, 54, 52, 8);
    ctx.fillStyle = '#9aa3a8';
    ctx.fill();
    ctx.strokeStyle = '#6e777c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#c3cacd';
    rr(ctx, -28, -78, 56, 10, 5);
    ctx.fill();
    ctx.strokeStyle = '#5c6468';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-20, -64);
    ctx.lineTo(-12, -50);
    ctx.moveTo(16, -62);
    ctx.lineTo(22, -48);
    ctx.stroke();
  } else if (z.type === 'giant') {
    ctx.strokeStyle = '#2c2238';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -26);
    ctx.lineTo(-8, -20);
    ctx.moveTo(8, -26);
    ctx.lineTo(20, -20);
    ctx.stroke();
  }
  ctx.restore();

  if (z.type === 'flag') {
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, -70);
    ctx.lineTo(28, -190);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(28, -190);
    ctx.lineTo(70, -176);
    ctx.lineTo(28, -158);
    ctx.closePath();
    ctx.fillStyle = '#c0392b';
    ctx.fill();
    ctx.fillStyle = '#fff3d2';
    ctx.beginPath();
    ctx.arc(38, -174, 5, 0, PI * 2);
    ctx.fill();
  }

  // 减速
  if (z.slowT > 0) {
    ctx.strokeStyle = 'rgba(140,225,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -66, 42, 74, 0, 0, PI * 2);
    ctx.stroke();
  }
}

export function drawFoe(ctx, z, t) {
  const s = z.scale || 1;
  groundShadow(ctx, z.x, z.y + 2, 42 * s, 0.24);
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.scale(s, s);
  drawFoeBody(ctx, z, t);
  ctx.restore();

  if (z.hp < z.maxHp) {
    const w = 60 * s;
    const bx = z.x - w / 2;
    const by = z.y - 168 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rr(ctx, bx - 2, by - 2, w + 4, 10, 5);
    ctx.fill();
    const ratio = Math.max(0, z.hp / z.maxHp);
    ctx.fillStyle = ratio > 0.55 ? '#7ed957' : ratio > 0.25 ? '#f3c34b' : '#e05a4a';
    rr(ctx, bx, by, Math.max(3, w * ratio), 6, 3);
    ctx.fill();
  }
}

/* ───────────────────────── 子弹 / 能量 / 防御锯 ───────────────────────── */

export function drawPea(ctx, p) {
  const icy = p.kind === 'snow';
  const g = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, 10);
  g.addColorStop(0, icy ? '#e6fbff' : '#b8ef7a');
  g.addColorStop(1, icy ? '#6fc9e4' : '#4f9e2c');
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = icy ? 'rgba(180,240,255,0.6)' : 'rgba(50,110,25,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawSunToken(ctx, s, t) {
  const pulse = 1 + Math.sin(t * 5 + s.x) * 0.06;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(pulse, pulse);
  const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
  g.addColorStop(0, '#fff9c0');
  g.addColorStop(0.55, '#ffd83d');
  g.addColorStop(1, 'rgba(255,180,0,0.15)');
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.rotate(t * 0.8);
  for (let i = 0; i < 8; i++) {
    ctx.rotate(PI / 4);
    ctx.fillStyle = 'rgba(255,225,90,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-4, -34);
    ctx.lineTo(4, -34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, PI * 2);
  ctx.fillStyle = '#ffe873';
  ctx.fill();
  ctx.restore();
}

function drawMower(ctx, m, t) {
  if (!m.alive && !m.active) return;
  ctx.save();
  ctx.translate(m.x, m.y);
  if (m.active) ctx.rotate(0.04);
  // 手柄
  ctx.strokeStyle = '#8f9498';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(16, -20);
  ctx.lineTo(34, -52);
  ctx.stroke();
  // 车身
  const g = ctx.createLinearGradient(0, -30, 0, -6);
  g.addColorStop(0, '#e14b3b');
  g.addColorStop(1, '#a82a1e');
  rr(ctx, -28, -30, 56, 24, 8);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = '#7d1d14';
  rr(ctx, -30, -28, 10, 18, 4);
  ctx.fill();
  // 轮子
  for (const wx of [-20, 14]) {
    ctx.beginPath();
    ctx.arc(wx, 0, 9, 0, PI * 2);
    ctx.fillStyle = '#26241f';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wx, 0, 3.5, 0, PI * 2);
    ctx.fillStyle = '#b9b4a6';
    ctx.fill();
  }
  // 刀片
  ctx.save();
  ctx.translate(28, -18);
  ctx.rotate(m.active ? t * 30 : 0);
  ctx.fillStyle = '#cfd4d6';
  for (let i = 0; i < 3; i++) {
    ctx.rotate((PI * 2) / 3);
    rr(ctx, 0, -2, 12, 4, 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

/* ───────────────────────── HUD ───────────────────────── */

export function sunIcon(ctx, x, y, r, t) {
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.15, x, y, r);
  g.addColorStop(0, '#fffbd6');
  g.addColorStop(0.5, '#ffd83d');
  g.addColorStop(1, '#f2a81d');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.5);
  for (let i = 0; i < 10; i++) {
    ctx.rotate((PI * 2) / 10);
    ctx.fillStyle = 'rgba(255,205,60,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -r - 2);
    ctx.lineTo(-r * 0.16, -r - 9);
    ctx.lineTo(r * 0.16, -r - 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.3, r * 0.22, 0, PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

function drawSeedCard(ctx, p, x, y, w, h, st, t) {
  const afford = st.sun >= p.cost;
  const cd = st.typeCd[p.id] || 0;
  const cdMax = p.cooldown;
  ctx.save();
  // 底
  rr(ctx, x, y, w, h, 12);
  ctx.fillStyle = afford ? '#f6e6bd' : '#c9bda2';
  ctx.fill();
  ctx.strokeStyle = afford ? '#7a4c22' : '#6c6150';
  ctx.lineWidth = 3;
  ctx.stroke();
  // 内高光
  rr(ctx, x + 4, y + 4, w - 8, h * 0.4, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  // 热键
  ctx.beginPath();
  ctx.arc(x + 25, y + 25, 16, 0, PI * 2);
  ctx.fillStyle = afford ? '#8a2f1d' : '#6b5f4e';
  ctx.fill();
  txt(ctx, String(p.key), x + 25, y + 26, 18, '#fff3d2', { align: 'center' });
  // 图标
  ctx.save();
  ctx.globalAlpha = afford ? 1 : 0.6;
  drawIcon(ctx, p.id, x + 28, y + h - 20, 48, t);
  ctx.restore();
  // 名字
  txt(ctx, p.name, x + 54, y + 27, 17, afford ? C.ink : '#6f6656');
  // 价格
  sunIcon(ctx, x + 62, y + 55, 8, t);
  txt(ctx, String(p.cost), x + 74, y + 56, 16, afford ? '#c8871a' : '#a33a2c');
  // 冷却
  if (cd > 0.01) {
    const frac = Math.min(1, cd / cdMax);
    ctx.save();
    rr(ctx, x, y, w, h, 12);
    ctx.clip();
    ctx.fillStyle = 'rgba(20,18,12,0.55)';
    ctx.fillRect(x, y, w, h * frac);
    ctx.restore();
    txt(ctx, cd.toFixed(1), x + w - 22, y + h - 18, 14, '#ffe6a6', { align: 'right' });
  }
  // 能量不够蒙层
  if (!afford) {
    rr(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(30,26,18,0.22)';
    ctx.fill();
  }
  ctx.restore();
}

function drawHud(ctx, st, t) {
  const g = ctx.createLinearGradient(0, 0, 0, HUD_H);
  g.addColorStop(0, '#33200f');
  g.addColorStop(1, '#1b1109');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HUD_H);
  // 木纹
  ctx.strokeStyle = 'rgba(255,220,150,0.045)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 12 + i * 15);
    ctx.bezierCurveTo(500, 6 + i * 16, 1200, 20 + i * 14, W, 10 + i * 16);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9a43b';
  ctx.fillRect(0, HUD_H - 4, W, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, HUD_H, W, 6);

  // 标题
  txt(ctx, '弹幕草坪守卫战', 26, 22, 15, '#d8b57a');
  // 能量
  sunIcon(ctx, 56, 67, 20, t);
  txt(ctx, String(Math.floor(st.sun)), 88, 68, 40, '#ffe14d', { shadow: 'rgba(0,0,0,0.5)' });
  txt(ctx, '能量', 90, 97, 12, '#b8965c');

  // 卡片
  const cw = 176;
  const gap = 8;
  let cx = 320;
  for (const p of PLANTS) {
    drawSeedCard(ctx, p, cx, 13, cw, 84, st, t);
    cx += cw + gap;
  }

  // 波次
  const wx = 1460;
  txt(ctx, '波次', wx + 2, 26, 14, '#b8965c');
  txt(ctx, String(st.wave), wx + 46, 30, 40, C.gold, { shadow: 'rgba(0,0,0,.5)' });
  txt(ctx, '最远 ' + st.bestWave, wx + 130, 24, 14, '#d8b57a');
  // 进度
  const barW = 400;
  const frac = Math.max(0, Math.min(1, 1 - st.waveTimer / Math.max(1, st.waveGap)));
  rr(ctx, wx, 64, barW, 16, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  const pg = ctx.createLinearGradient(wx, 0, wx + barW, 0);
  pg.addColorStop(0, '#e05a4a');
  pg.addColorStop(1, '#f3c34b');
  rr(ctx, wx, 64, Math.max(6, barW * frac), 16, 8);
  ctx.fillStyle = pg;
  ctx.fill();
  txt(ctx, '下一波 ' + Math.ceil(Math.max(0, st.waveTimer)) + 's', wx, 91, 13, '#cbb17c');
}

/* ───────────────────────── 侧栏 ───────────────────────── */

function panel(ctx, x, y, w, h) {
  rr(ctx, x, y, w, h, 18);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  rr(ctx, x + 1, y + 1, w - 2, 44, 17);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(x, y, w, 44);
  ctx.restore();
}

function panelTitle(ctx, x, y, w, text, right) {
  ctx.fillStyle = C.gold;
  rr(ctx, x + 18, y + 17, 4, 18, 2);
  ctx.fill();
  txt(ctx, text, x + 30, y + 27, 17, C.cream);
  if (right) txt(ctx, right, x + w - 18, y + 27, 13, '#a9bd93', { align: 'right' });
}

function drawSidebar(ctx, st, t) {
  const { x, w } = SIDE;
  // 指令
  let y = SIDE.y;
  const h1 = 286;
  panel(ctx, x, y, w, h1);
  panelTitle(ctx, x, y, w, '弹幕指令', '扣数字最快');
  const colW = 190;
  PLANTS.forEach((p, i) => {
    const ix = x + 16 + (i % 2) * colW;
    const iy = y + 40 + Math.floor(i / 2) * 56;
    ctx.beginPath();
    ctx.arc(ix + 17, iy + 24, 15, 0, PI * 2);
    ctx.fillStyle = 'rgba(243,195,75,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(243,195,75,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    txt(ctx, String(p.key), ix + 17, iy + 25, 16, C.gold, { align: 'center' });
    txt(ctx, p.name, ix + 40, iy + 16, 16, C.cream);
    sunIcon(ctx, ix + 46, iy + 37, 6.5, t);
    txt(ctx, String(p.cost), ix + 56, iy + 38, 13, '#e8c87a');
  });
  txt(ctx, '精确种：豆炮 3-2（第3行第2列）', x + 18, y + h1 - 22, 13, '#a9bd93');
  txt(ctx, '铲掉：铲 3-2', x + 252, y + h1 - 22, 13, '#a9bd93');

  // 战报
  y += h1 + 12;
  const h2 = 330;
  panel(ctx, x, y, w, h2);
  panelTitle(ctx, x, y, w, '战场播报');
  const online = st.conn === 'on' || st.conn === 'demo';
  ctx.beginPath();
  ctx.arc(x + w - 74, y + 27, 4.5, 0, PI * 2);
  ctx.fillStyle = online ? '#7ed957' : '#e05a4a';
  ctx.fill();
  txt(ctx, st.conn === 'demo' ? '演示中' : online ? '已连接' : '未连接', x + w - 18, y + 27, 12,
    online ? '#a9d88a' : '#ef9d92', { align: 'right' });
  const items = st.feed.slice(0, 5);
  items.forEach((f, i) => {
    const fy = y + 56 + i * 54;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 18, fy - 8);
      ctx.lineTo(x + w - 18, fy - 8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x + 27, fy + 8, 9, 0, PI * 2);
    ctx.fillStyle = f.ok ? 'rgba(126,217,87,0.18)' : 'rgba(224,90,74,0.18)';
    ctx.fill();
    txt(ctx, f.ok ? '✓' : '×', x + 27, fy + 8, 13, f.ok ? '#9ce86f' : '#ff9b8a', { align: 'center' });
    txt(ctx, cut(f.user, 7), x + 44, fy + 8, 15, '#ffd97a');
    txt(ctx, cut(f.text, 10), x + w - 18, fy + 8, 12, 'rgba(220,225,200,0.45)', { align: 'right' });
    txt(ctx, cut(f.msg, 18), x + 44, fy + 29, 14, f.ok ? C.cream : '#ffb3a6');
  });
  if (!items.length) {
    txt(ctx, '观众发「1」就能种光芽', x + w / 2, y + 140, 16, 'rgba(220,225,200,0.5)', { align: 'center' });
    txt(ctx, '发「豆炮 3-2」精确到格子', x + w / 2, y + 170, 16, 'rgba(220,225,200,0.5)', { align: 'center' });
  }

  // 贡献榜
  y += h2 + 12;
  const h3 = 300;
  panel(ctx, x, y, w, h3);
  panelTitle(ctx, x, y, w, '指挥官榜', '累计');
  const list = [...st.users.values()].filter((u) => u.plants > 0 || u.kills > 0)
    .sort((a, b) => (b.kills * 3 + b.plants) - (a.kills * 3 + a.plants)).slice(0, 5);
  list.forEach((u, i) => {
    const ry = y + 62 + i * 44;
    const rankColor = i === 0 ? '#ffd84d' : i === 1 ? '#d7dde2' : i === 2 ? '#e09a5b' : '#8ea17f';
    txt(ctx, String(i + 1), x + 30, ry, 18, rankColor, { align: 'center' });
    txt(ctx, cut(u.name, 9), x + 50, ry, 15, C.cream);
    txt(ctx, `${u.plants} 株 · ${u.kills} 杀`, x + w - 20, ry, 13, '#b9c9a6', { align: 'right' });
  });
  if (!list.length) {
    txt(ctx, '还没有人上榜', x + w / 2, y + 135, 16, 'rgba(220,225,200,0.45)', { align: 'center' });
  }
  txt(ctx, `本局击杀 ${st.kills} · 能量 ${Math.floor(st.sun)}`, x + 20, y + h3 - 22, 13, '#a9bd93');
  txt(ctx, st.gameOver ? '本局结束' : '直播中', x + w - 20, y + h3 - 22, 13, st.gameOver ? '#ff9b8a' : '#9ce86f', { align: 'right' });
}

/* ───────────────────────── 底部 & 浮层 ───────────────────────── */

function drawBottom(ctx, st) {
  const y = BOARD.b;
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, '#241609');
  g.addColorStop(1, '#150d05');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = '#d9a43b';
  ctx.fillRect(0, y, BOARD.r, 3);

  txt(ctx, '扣 1-6 直接种', 40, y + 40, 20, C.cream);
  txt(ctx, '·', 216, y + 40, 20, 'rgba(255,255,255,0.25)');
  txt(ctx, '「豆炮 3-2」精确放', 236, y + 40, 20, C.cream);
  txt(ctx, '·', 470, y + 40, 20, 'rgba(255,255,255,0.25)');
  txt(ctx, '「铲 3-2」铲掉', 490, y + 40, 20, C.cream);
  txt(ctx, '·', 666, y + 40, 20, 'rgba(255,255,255,0.25)');
  const shooters = st.plants.filter((p) => p.type === 'peashot' || p.type === 'frostshot').length;
  let tip = shooters < 6 ? '先扣 2 补豆炮' : '补 1 攒能量';
  if (st.wave % 5 === 4 && st.waveTimer < 8) tip = '大波要来，留着能量';
  if (st.sun < 100 && shooters < 3) tip = '能量不够，先扣 1';
  txt(ctx, tip, 686, y + 40, 20, '#f3c34b');

  txt(ctx, `本局：部署 ${st.planted} · 击杀 ${st.kills} · 最远 第 ${st.bestWave} 波`, 40, y + 78, 16, '#a9bd93');
}

function drawBanner(ctx, st) {
  if (!st.banner) return;
  const b = st.banner;
  const life = 3.0;
  if (b.age > life) { st.banner = null; return; }
  const fadeIn = Math.min(1, b.age / 0.25);
  const fadeOut = Math.min(1, (life - b.age) / 0.6);
  const a = Math.max(0, Math.min(fadeIn, fadeOut));
  const y = 300;
  ctx.save();
  ctx.globalAlpha = a;
  const text = b.text;
  ctx.font = `bold ${b.big ? 64 : 52}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  rr(ctx, W / 2 - tw / 2 - 40, y - 52, tw + 80, 104, 20);
  ctx.fillStyle = b.big ? 'rgba(90,10,10,0.78)' : 'rgba(16,28,12,0.78)';
  ctx.fill();
  ctx.strokeStyle = b.big ? 'rgba(255,120,90,0.8)' : 'rgba(243,195,75,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  txt(ctx, text, W / 2, y + 2, b.big ? 64 : 52, b.big ? '#ff8b74' : '#ffe6a6', {
    align: 'center', shadow: 'rgba(0,0,0,0.7)'
  });
  ctx.restore();
}

function drawToast(ctx, st) {
  if (!st.toastMsg) return;
  const age = st.toastMsg.age;
  if (age > 1.6) { st.toastMsg = null; return; }
  const a = Math.min(1, age / 0.12) * Math.min(1, (1.6 - age) / 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.font = `bold 26px ${FONT}`;
  const tw = ctx.measureText(st.toastMsg.text).width;
  rr(ctx, W / 2 - tw / 2 - 26, 138, tw + 52, 48, 24);
  ctx.fillStyle = 'rgba(12,20,9,0.86)';
  ctx.fill();
  ctx.strokeStyle = st.toastMsg.color || 'rgba(243,195,75,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  txt(ctx, st.toastMsg.text, W / 2, 163, 26, st.toastMsg.color || '#ffe6a6', { align: 'center' });
  ctx.restore();
}

function drawHelp(ctx, st) {
  if (!st.helpAge || st.helpAge > 7) return;
  const a = Math.min(1, st.helpAge / 0.2) * Math.min(1, (7 - st.helpAge) / 0.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  const w = 780;
  const h = 430;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  rr(ctx, x, y, w, h, 24);
  ctx.fillStyle = 'rgba(14,24,10,0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(243,195,75,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  txt(ctx, '弹幕怎么指挥', x + w / 2, y + 52, 34, C.gold, { align: 'center' });
  const lines = [
    ['扣 1-6', '直接种，位置系统帮你挑'],
    ['豆炮 3-2', '第 3 行、第 2 列，位置自己定'],
    ['铲 3-2', '把那一格铲掉，不花能量'],
    ['指令', '再喊一次这个面板'],
    ['礼物', '直接加能量，感谢老板']
  ];
  lines.forEach((ln, i) => {
    const ly = y + 112 + i * 56;
    rr(ctx, x + 60, ly - 20, 170, 40, 10);
    ctx.fillStyle = 'rgba(243,195,75,0.12)';
    ctx.fill();
    txt(ctx, ln[0], x + 145, ly + 1, 20, '#ffe6a6', { align: 'center' });
    txt(ctx, ln[1], x + 260, ly + 1, 20, '#d8e4c8');
  });
  txt(ctx, '能量是全直播间共用的，别乱花', x + w / 2, y + h - 34, 15, '#9fb38a', { align: 'center' });
  ctx.restore();
}

function drawGameOver(ctx, st) {
  if (!st.gameOver) return;
  const g = st.gameOver;
  ctx.fillStyle = 'rgba(6,10,5,0.74)';
  ctx.fillRect(0, 0, W, H);
  const w = 980;
  const h = 560;
  const x = (W - w) / 2;
  const y = (H - h) / 2 - 20;
  rr(ctx, x, y, w, h, 28);
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, '#2a1a0e');
  bg.addColorStop(1, '#160e07');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(243,195,75,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  txt(ctx, '怪物冲进了你的基地', W / 2, y + 92, 52, '#ff8b74', { align: 'center', shadow: 'rgba(0,0,0,.6)' });
  txt(ctx, `坚持到第 ${g.wave} 波 · 击杀 ${g.kills}`, W / 2, y + 158, 26, C.cream, { align: 'center' });
  txt(ctx, `最远纪录 第 ${st.bestWave} 波`, W / 2, y + 196, 18, '#cbb17c', { align: 'center' });

  const users = [...st.users.values()].filter((u) => u.kills > 0 || u.plants > 0)
    .sort((a, b) => (b.kills * 3 + b.plants) - (a.kills * 3 + a.plants)).slice(0, 3);
  users.forEach((u, i) => {
    const uy = y + 252 + i * 52;
    ctx.beginPath();
    ctx.arc(x + 250, uy, 17, 0, PI * 2);
    ctx.fillStyle = i === 0 ? 'rgba(255,216,77,0.2)' : 'rgba(255,255,255,0.07)';
    ctx.fill();
    txt(ctx, String(i + 1), x + 250, uy + 1, 18, i === 0 ? '#ffd84d' : '#d8e4c8', { align: 'center' });
    txt(ctx, cut(u.name, 10), x + 290, uy, 22, C.cream);
    txt(ctx, `${u.plants} 株 · ${u.kills} 杀`, x + w - 250, uy, 20, '#e8c87a', { align: 'right' });
  });

  const left = Math.max(0, Math.ceil(st.autoRestartLeft));
  txt(ctx, `${left} 秒后自动开下一局`, W / 2, y + h - 82, 20, '#bfe0a0', { align: 'center' });
  // 进度
  const bw = 420;
  rr(ctx, W / 2 - bw / 2, y + h - 52, bw, 10, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();
  rr(ctx, W / 2 - bw / 2, y + h - 52, bw * (1 - st.autoRestartLeft / 12), 10, 5);
  ctx.fillStyle = C.gold;
  ctx.fill();
}

/* ───────────────────────── 主绘制 ───────────────────────── */

export function draw(ctx, st) {
  const t = st.t;
  ctx.save();
  if (st.shake > 0.01) {
    ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
  }
  drawBackdrop(ctx, st);

  for (const m of st.mowers) drawMower(ctx, m, t);

  // 底部说明条要先画，右侧侧栏才能压在它上面
  drawBottom(ctx, st);

  // 守卫
  const plants = [...st.plants].sort((a, b) => a.row - b.row);
  for (const p of plants) drawPlant(ctx, p, t);

  // 怪物
  const zs = [...st.foes].sort((a, b) => a.row - b.row || a.x - b.x);
  for (const z of zs) drawFoe(ctx, z, t);

  for (const p of st.peas) drawPea(ctx, p);
  for (const s of st.suns) drawSunToken(ctx, s, t);

  // 粒子 / 浮动文字
  for (const f of st.fx) {
    if (f.kind === 'text') {
      const a = Math.max(0, 1 - f.age / f.life);
      txt(ctx, f.text, f.x, f.y - f.age * 34, f.size || 18, f.color, {
        align: 'center', alpha: a, outline: 3, outlineColor: 'rgba(0,0,0,0.55)'
      });
    } else if (f.kind === 'ring') {
      const k = f.age / f.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 6 * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (0.2 + k), 0, PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      const a = Math.max(0, 1 - f.age / f.life);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (1 - f.age / f.life * 0.5), 0, PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawHud(ctx, st, t);
  drawSidebar(ctx, st, t);
  drawBanner(ctx, st);
  drawToast(ctx, st);
  drawHelp(ctx, st);
  drawGameOver(ctx, st);
  if (st.paused) {
    ctx.fillStyle = 'rgba(4,8,3,0.6)';
    ctx.fillRect(0, 0, W, H);
    txt(ctx, '已暂停', W / 2, H / 2 - 10, 64, '#ffe6a6', { align: 'center', shadow: 'rgba(0,0,0,.7)' });
    txt(ctx, '空格继续 · R 重开 · M 静音', W / 2, H / 2 + 58, 20, '#cbb17c', { align: 'center' });
  }
  ctx.restore();
}
