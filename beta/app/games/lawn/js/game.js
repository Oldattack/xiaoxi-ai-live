// 游戏引擎：不依赖任何库，固定 60Hz 步进。
import { BOARD, TUNE, VIEW } from './config.js';
import { PLANTS, PLANT_MAP, FOES, DEMO_NAMES, DEMO_GIFTS } from './data.js';
import { draw } from './draw.js';
import { parseCommand } from './commands.mjs';
import { Sfx } from './sfx.js';

const STEP = 1 / 60;
let pid = 1;

const cellCX = (c) => BOARD.x + c * BOARD.cellW + BOARD.cellW / 2;
const rowTop = (r) => BOARD.y + r * BOARD.cellH;
const plantGround = (r) => rowTop(r) + BOARD.cellH - 16;
const laneGround = (r) => rowTop(r) + BOARD.cellH - 2;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.demo = Boolean(opts.demo);
    this.sfx = new Sfx(Boolean(opts.mute));
    this.users = new Map();
    this.bestWave = 0;
    try { this.bestWave = Number(localStorage.getItem('lawn.bestWave')) || 0; } catch { /* 隐私模式 */ }
    this.round = 0;
    this.paused = false;
    this.conn = this.demo ? 'demo' : 'off';
    this.keyHandler = (e) => this.onKey(e);
    this.clickHandler = (e) => this.onClick(e);
    window.addEventListener('keydown', this.keyHandler);
    canvas.addEventListener('pointerdown', this.clickHandler);
    this.selected = null;
    this.reset(true);
    this.last = 0;
    this.acc = 0;
    this.raf = 0;
  }

  /* ── 生命周期 ───────────────────────────────────── */

  reset(first = false) {
    this.round += 1;
    this.t = 0;
    this.sun = TUNE.startSun;
    this.plants = [];
    this.foes = [];
    this.peas = [];
    this.suns = [];
    this.fx = [];
    this.queue = [];
    this.grid = Array.from({ length: BOARD.rows }, () => Array(BOARD.cols).fill(null));
    this.mowers = Array.from({ length: BOARD.rows }, (_, r) => ({
      row: r, alive: true, active: false, x: BOARD.x + 24, y: laneGround(r) - 4
    }));
    this.typeCd = {};
    this.lastCmdAt = new Map();
    this.wave = 0;
    this.waveTimer = TUNE.firstWaveDelay;
    this.waveGap = TUNE.firstWaveDelay;
    this.kills = 0;
    this.planted = 0;
    this.gameOver = null;
    this.autoRestartLeft = 0;
    this.nextSkySun = 5;
    this.banner = null;
    this.toastMsg = null;
    this.helpAge = null;
    this.shake = 0;
    this.demoT = 0.8;
    this.feed = [];
    this.note('系统', '', true, first ? '新的一局，扣数字开始种' : `第 ${this.round} 局开始`);
  }

  start() {
    this.last = performance.now();
    const frame = (now) => {
      this.raf = requestAnimationFrame(frame);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (!Number.isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.25);
      this.acc += dt;
      let guard = 0;
      while (this.acc >= STEP && guard < 10) {
        this.step(STEP);
        this.acc -= STEP;
        guard += 1;
      }
      draw(this.ctx, this);
    };
    this.raf = requestAnimationFrame(frame);
  }

  warp(seconds) {
    let left = seconds;
    let guard = 0;
    while (left > 0 && guard < seconds * 62 + 20) {
      this.step(STEP);
      left -= STEP;
      guard += 1;
    }
  }

  onKey(e) {
    if (e.code === 'Space' || e.key === 'p' || e.key === 'P') {
      this.paused = !this.paused;
      e.preventDefault();
    } else if (e.key === 'r' || e.key === 'R') {
      this.reset();
    } else if (e.key === 'm' || e.key === 'M') {
      this.toast(this.sfx.toggle() ? '音效已开' : '音效已关', '#f3c34b');
    } else if (e.key >= '1' && e.key <= '6') {
      this.selected = PLANTS[Number(e.key) - 1].id;
      this.toast(`已选中 ${PLANT_MAP[this.selected].name}，点格子部署`, '#f3c34b');
    }
  }

  onClick(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VIEW.W;
    const y = ((e.clientY - r.top) / r.height) * VIEW.H;
    const cw = 176;
    const gap = 8;
    for (let i = 0; i < PLANTS.length; i++) {
      const cx = 320 + i * (cw + gap);
      if (x >= cx && x <= cx + cw && y >= 13 && y <= 97) {
        this.selected = this.selected === PLANTS[i].id ? null : PLANTS[i].id;
        return;
      }
    }
    const col = Math.floor((x - BOARD.x) / BOARD.cellW);
    const row = Math.floor((y - BOARD.y) / BOARD.cellH);
    if (row < 0 || row >= BOARD.rows || col < 0 || col >= BOARD.cols || !this.selected) return;
    this.tryPlant('主播', this.selected, row, col);
    this.selected = null;
  }

  /* ── 模拟 ───────────────────────────────────────── */

  step(dt) {
    if (this.paused) return;
    if (this.gameOver) {
      this.gameOver.age += dt;
      this.autoRestartLeft -= dt;
      if (this.autoRestartLeft <= 0) this.reset();
      this.t += dt;
      return;
    }
    this.t += dt;
    if (this.demo) this.demoTick(dt);
    if (this.banner) this.banner.age += dt;
    if (this.toastMsg) this.toastMsg.age += dt;
    if (this.helpAge != null) this.helpAge += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);

    for (const id of Object.keys(this.typeCd)) {
      this.typeCd[id] = Math.max(0, this.typeCd[id] - dt);
    }

    this.skySun(dt);
    this.waveLogic(dt);
    this.updatePlants(dt);
    this.updatePeas(dt);
    this.updateFoes(dt);
    this.updateMowers(dt);
    this.updateSuns(dt);
    this.updateFx(dt);

    this.foes = this.foes.filter((z) => !z.dead);
    const deadPlants = this.plants.filter((p) => p.hp <= 0);
    for (const p of deadPlants) this.removePlant(p);
  }

  skySun(dt) {
    this.nextSkySun -= dt;
    if (this.nextSkySun > 0) return;
    this.nextSkySun = rand(TUNE.skySunMin, TUNE.skySunMax);
    const x = rand(BOARD.x + 60, BOARD.r - 60);
    this.suns.push({
      x, y: BOARD.y + 10, ty: rand(BOARD.y + 220, BOARD.b - 80),
      value: TUNE.skySunValue, phase: 'fall', age: 0, from: 'sky'
    });
  }

  waveLogic(dt) {
    this.waveTimer -= dt;
    while (this.queue.length && this.queue[0].at <= this.t) {
      const q = this.queue.shift();
      this.spawnFoe(q.type, q.row);
    }
    if (this.waveTimer > 0) return;
    this.startWave();
  }

  startWave() {
    this.wave += 1;
    const big = this.wave % 5 === 0;
    let count = 2 + Math.floor(this.wave * 0.7);
    if (big) count = Math.round(count * 1.8);
    count = Math.min(count, 26);
    const gap = big ? 0.28 : 0.55;
    for (let i = 0; i < count; i++) {
      this.queue.push({ at: this.t + i * gap, type: this.pickFoeType(), row: this.pickRow() });
    }
    this.waveGap = Math.max(15, 27 - this.wave * 0.45) + count * 0.35;
    this.waveTimer = this.waveGap;
    this.banner = {
      text: big ? `一大波怪物正在接近！` : `第 ${this.wave} 波`,
      big, age: 0
    };
    if (big) this.shake = Math.max(this.shake, 5);
    this.note('系统', '', true, big ? `第 ${this.wave} 波 · 一大波怪物` : `第 ${this.wave} 波来袭`);
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
      try { localStorage.setItem('lawn.bestWave', String(this.bestWave)); } catch { /* ignore */ }
    }
  }

  pickFoeType() {
    const w = { normal: 100 };
    if (this.wave >= 3) w.cone = 55;
    if (this.wave >= 4) w.flag = 26;
    if (this.wave >= 5) w.bucket = 34;
    if (this.wave >= 8) w.giant = 6;
    let total = 0;
    for (const k in w) total += w[k];
    let r = Math.random() * total;
    for (const k in w) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return 'normal';
  }

  pickRow() {
    return Math.floor(Math.random() * BOARD.rows);
  }

  spawnFoe(type, row) {
    // 巨人太高，只走中间三路，避免被顶部 HUD 挡住
    if (type === 'giant') row = 1 + Math.floor(Math.random() * 3);
    const def = FOES[type];
    const scale = def.scale * 0.88;
    this.foes.push({
      id: pid++,
      type,
      row,
      x: BOARD.r + rand(110, 190),
      y: laneGround(row),
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      dps: def.dps,
      scale,
      slowT: 0,
      eating: false,
      walkT: rand(0, 10),
      phase: rand(0, 6),
      lastOwner: null,
      dead: false
    });
  }

  updatePlants(dt) {
    for (const p of this.plants) {
      p.tagT = Math.max(0, p.tagT - dt);
      p.recoil = Math.max(0, p.recoil - dt * 7);
      if (p.type === 'glowbud') {
        p.prod -= dt;
        if (p.prod <= 0) {
          p.prod = TUNE.glowbudEvery;
          this.suns.push({
            x: p.x + rand(-8, 8), y: p.y - 96, ty: p.y - 52,
            value: TUNE.glowbudValue, phase: 'fall', age: 0, from: 'flower'
          });
          this.sfx.blip(660, 0.03);
        }
      } else if (p.type === 'peashot' || p.type === 'frostshot') {
        p.cd -= dt;
        if (p.cd <= 0 && this.foeAhead(p)) {
          const icy = p.type === 'frostshot';
          p.cd = icy ? TUNE.snowEvery : TUNE.peaEvery;
          p.recoil = 1;
          this.peas.push({
            x: p.x + 32, y: p.y - 56, row: p.row,
            kind: icy ? 'snow' : 'pea', owner: p.owner,
            damage: icy ? TUNE.snowDamage : TUNE.peaDamage
          });
          this.sfx.shoot(icy);
        }
      } else if (p.type === 'blastfruit') {
        p.fuse -= dt;
        if (p.fuse <= 0) {
          this.explode(p.x, p.row, TUNE.blastfruitRadius, TUNE.blastfruitDamage, p.owner);
          p.hp = 0;
        }
      } else if (p.type === 'quaker') {
        if (!p.armed) {
          p.armLeft -= dt;
          if (p.armLeft <= 0) { p.armed = true; this.sfx.blip(880, 0.05); }
        } else {
          const hit = this.foes.find((z) => z.row === p.row && Math.abs(z.x - p.x) < 46 && z.x > BOARD.x - 20);
          if (hit) {
            this.explode(p.x, p.row, TUNE.quakerRadius, TUNE.quakerDamage, p.owner);
            p.hp = 0;
          }
        }
      }
    }
  }

  foeAhead(p) {
    return this.foes.some((z) => !z.dead && z.row === p.row && z.x > p.x - 20 && z.x < BOARD.r + 260);
  }

  updatePeas(dt) {
    for (const pea of this.peas) {
      pea.x += TUNE.peaSpeed * dt;
      if (pea.x > BOARD.r + 340) { pea.dead = true; continue; }
      let target = null;
      for (const z of this.foes) {
        if (z.dead || z.row !== pea.row) continue;
        if (pea.x >= z.x - 32 && pea.x <= z.x + 30) {
          if (!target || z.x < target.x) target = z;
        }
      }
      if (target) {
        this.hurtFoe(target, pea.damage, pea.owner);
        if (pea.kind === 'snow') {
          target.slowT = Math.max(target.slowT, 3.2);
          this.puff(pea.x, pea.y, '#bfefff', 4);
        }
        this.puff(pea.x, pea.y, pea.kind === 'snow' ? '#9fe6ff' : '#a8e06a', 3);
        pea.dead = true;
        this.sfx.hit();
      }
    }
    this.peas = this.peas.filter((p) => !p.dead);
  }

  updateFoes(dt) {
    for (const z of this.foes) {
      if (z.dead) continue;
      z.walkT += dt;
      if (z.slowT > 0) z.slowT -= dt;

      let target = null;
      for (const p of this.plants) {
        if (p.row !== z.row || p.hp <= 0) continue;
        if (z.x >= p.x - 8 && z.x - 30 <= p.x + 28) {
          if (!target || p.x > target.x) target = p;
        }
      }
      if (target) {
        z.eating = true;
        target.hp -= z.dps * dt;
        if (Math.random() < dt * 2.2) this.sfx.chomp();
        if (target.hp <= 0) {
          this.removePlant(target);
          z.eating = false;
        }
      } else {
        z.eating = false;
        const slow = z.slowT > 0 ? 0.45 : 1;
        z.x -= z.speed * slow * dt;
      }

      if (z.x < BOARD.x + 26) {
        const m = this.mowers[z.row];
        if (m && m.alive && !m.active) {
          m.active = true;
          m.alive = false;
          this.sfx.mower();
          this.shake = Math.max(this.shake, 4);
          this.toast(`第 ${z.row + 1} 路防御锯启动！`, '#ffb347');
        }
      }
      if (z.x < BOARD.x - 34) {
        const m = this.mowers[z.row];
        if (!m || (!m.alive && !m.active)) this.endGame();
      }
    }
  }

  updateMowers(dt) {
    for (const m of this.mowers) {
      if (!m.active) continue;
      m.x += 980 * dt;
      for (const z of this.foes) {
        if (z.dead || z.row !== m.row) continue;
        if (z.x < m.x + 60 && z.x > m.x - 100) this.killFoe(z, null, true);
      }
      if (m.x > BOARD.r + 160) m.active = false;
    }
  }

  updateSuns(dt) {
    for (const s of this.suns) {
      s.age += dt;
      if (s.phase === 'fall') {
        s.y += 90 * dt;
        if (s.y >= s.ty) { s.y = s.ty; s.phase = 'idle'; s.age = 0; }
      } else if (s.phase === 'idle') {
        if (s.age > 0.55) { s.phase = 'fly'; s.age = 0; s.fx0 = s.x; s.fy0 = s.y; }
      } else {
        const k = Math.min(1, s.age / 0.55);
        s.x = s.fx0 + (56 - s.fx0) * k;
        s.y = s.fy0 + (67 - s.fy0) * k;
        if (k >= 1) {
          this.sun += s.value;
          s.dead = true;
          this.sfx.ding();
        }
      }
    }
    this.suns = this.suns.filter((s) => !s.dead);
  }

  updateFx(dt) {
    for (const f of this.fx) {
      f.age += dt;
      if (f.kind === 'part') {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 320 * dt;
      }
    }
    this.fx = this.fx.filter((f) => f.age < f.life);
  }

  /* ── 战斗 ───────────────────────────────────────── */

  hurtFoe(z, dmg, owner) {
    if (z.dead) return;
    z.hp -= dmg;
    if (owner) z.lastOwner = owner;
    if (z.hp <= 0) this.killFoe(z, owner || z.lastOwner, false);
  }

  killFoe(z, owner, byMower) {
    if (z.dead) return;
    z.dead = true;
    this.kills += 1;
    const def = FOES[z.type];
    const bounty = byMower ? 0 : def.sun;
    if (bounty) this.sun += bounty;
    if (owner) this.stat(owner).kills += 1;
    this.fx.push({ kind: 'ring', x: z.x, y: z.y - 50, r: 36 * z.scale, color: byMower ? '#ffd84d' : '#c9f2a0', age: 0, life: 0.35 });
    for (let i = 0; i < 8; i++) {
      this.fx.push({
        kind: 'part', x: z.x, y: z.y - 70, vx: rand(-90, 90), vy: rand(-180, -40),
        size: rand(3, 7), color: byMower ? '#ffd84d' : '#8fbf63', age: 0, life: rand(0.4, 0.8)
      });
    }
    if (bounty) {
      this.fx.push({
        kind: 'text', x: z.x, y: z.y - 100, text: `+${bounty}`, color: '#ffe14d',
        size: 18, age: 0, life: 0.9
      });
    }
    if (z.type === 'giant') this.shake = Math.max(this.shake, 8);
    this.sfx.foeDie();
  }

  explode(x, row, radius, damage, owner) {
    this.fx.push({ kind: 'ring', x, y: rowTop(row) + 70, r: radius * BOARD.cellW, color: '#ffb347', age: 0, life: 0.55 });
    this.fx.push({ kind: 'ring', x, y: rowTop(row) + 70, r: radius * BOARD.cellW * 0.6, color: '#fff3b0', age: 0, life: 0.4 });
    for (let i = 0; i < 26; i++) {
      this.fx.push({
        kind: 'part', x: x + rand(-40, 40), y: rowTop(row) + 60 + rand(-30, 30),
        vx: rand(-260, 260), vy: rand(-320, -60), size: rand(4, 11),
        color: pick(['#ffcc4d', '#ff8a3d', '#ff5b3d', '#ffe9a8']), age: 0, life: rand(0.45, 0.95)
      });
    }
    for (const z of this.foes) {
      if (z.dead) continue;
      const dx = (z.x - x) / BOARD.cellW;
      const dy = z.row - row;
      if (dx * dx + dy * dy <= radius * radius) {
        this.hurtFoe(z, damage, owner);
      }
    }
    this.shake = Math.max(this.shake, 10);
    this.sfx.boom();
  }

  removePlant(p) {
    const i = this.plants.indexOf(p);
    if (i >= 0) this.plants.splice(i, 1);
    if (this.grid[p.row] && this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
    for (let k = 0; k < 5; k++) {
      this.fx.push({
        kind: 'part', x: p.x + rand(-16, 16), y: p.y - 30 + rand(-20, 10),
        vx: rand(-50, 50), vy: rand(-100, -20), size: rand(3, 6),
        color: '#7ab84d', age: 0, life: 0.5
      });
    }
  }

  /* ── 能量 / 特效 ─────────────────────────────────── */

  puff(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      this.fx.push({
        kind: 'part', x, y, vx: rand(-60, 60), vy: rand(-100, -20),
        size: rand(2, 5), color, age: 0, life: rand(0.25, 0.5)
      });
    }
  }

  toast(text, color) {
    this.toastMsg = { text, color, age: 0 };
  }

  note(user, text, ok, msg) {
    this.feed.unshift({ user, text: text || '', msg, ok });
    if (this.feed.length > TUNE.maxFeed) this.feed.pop();
  }

  stat(name) {
    let u = this.users.get(name);
    if (!u) {
      u = { name, plants: 0, kills: 0, gifts: 0 };
      this.users.set(name, u);
    }
    return u;
  }

  endGame() {
    if (this.gameOver) return;
    this.gameOver = { age: 0, wave: this.wave, kills: this.kills };
    this.autoRestartLeft = TUNE.autoRestart;
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
      try { localStorage.setItem('lawn.bestWave', String(this.bestWave)); } catch { /* ignore */ }
    }
    this.note('系统', '', false, `第 ${this.wave} 波，基地失守了`);
    this.sfx.gameOver();
  }

  /* ── 指令 ───────────────────────────────────────── */

  handleChat(user, text) {
    const name = String(user || '').replace(/\s+/g, ' ').trim().slice(0, 12);
    if (!name || name === '小汐' || name === '·') return;
    const cmd = parseCommand(text);
    if (!cmd) return;
    if (cmd.kind === 'help') {
      this.helpAge = 0;
      this.stat(name);
      this.note(name, text, true, '查看了指令表');
      return;
    }
    if (this.gameOver) return;

    const now = this.t;
    const last = this.lastCmdAt.get(name) ?? -99;
    if (now - last < TUNE.userCooldown) {
      const wait = (TUNE.userCooldown - (now - last)).toFixed(1);
      this.note(name, text, false, `手速太快，${wait}s 后再来`);
      return;
    }
    this.lastCmdAt.set(name, now);
    this.stat(name);

    if (cmd.kind === 'shovel') {
      this.shovel(name, text, cmd.row, cmd.col);
    } else {
      this.plantCommand(name, text, cmd);
    }
  }

  plantCommand(user, text, cmd) {
    if (cmd.row == null) {
      const cell = this.autoPlace(cmd.plantId);
      if (!cell) {
        this.note(user, text, false, '没有空地了');
        this.toast('没有空地了，先铲一格', '#ff9b8a');
        return;
      }
      this.tryPlant(user, cmd.plantId, cell[0], cell[1], text, true);
    } else {
      this.tryPlant(user, cmd.plantId, cmd.row, cmd.col, text, false);
    }
  }

  tryPlant(user, plantId, row, col, text = '', auto = false) {
    if (this.gameOver) return false;
    const def = PLANT_MAP[plantId];
    if (!def) return false;
    if (row < 0 || row >= BOARD.rows || col < 0 || col >= BOARD.cols) {
      this.note(user, text, false, `没有 ${row + 1} 行 ${col + 1} 列`);
      this.toast('位置超出范围（5 行 9 列）', '#ff9b8a');
      return false;
    }
    if ((this.typeCd[plantId] || 0) > 0) {
      this.note(user, text, false, `${def.name}冷却中`);
      return false;
    }
    if (this.grid[row][col]) {
      this.note(user, text, false, '这格已经有守卫了');
      this.toast('这格被占了，换一格', '#ff9b8a');
      return false;
    }
    if (this.cellBlocked(row, col)) {
      this.note(user, text, false, '怪物正踩着这格');
      this.toast('有怪物，换一格种', '#ff9b8a');
      return false;
    }
    if (this.sun < def.cost) {
      const lack = Math.ceil(def.cost - this.sun);
      this.note(user, text, false, `能量不够，还差 ${lack}`);
      this.toast(`能量不够，还差 ${lack}`, '#ff9b8a');
      return false;
    }

    this.sun -= def.cost;
    const p = {
      id: pid++, type: plantId, row, col,
      x: cellCX(col), y: plantGround(row),
      hp: def.hp, maxHp: def.hp,
      owner: user, seed: rand(0, 8), tagT: 3.2,
      prod: 6.5, cd: 0.35, recoil: 0,
      fuse: plantId === 'blastfruit' ? TUNE.blastfruitFuse : null,
      armed: plantId !== 'quaker',
      armLeft: TUNE.quakerArm
    };
    this.plants.push(p);
    this.grid[row][col] = p;
    this.typeCd[plantId] = def.cooldown;
    this.planted += 1;
    this.stat(user).plants += 1;
    this.puff(p.x, p.y - 4, '#c9a06a', 8);
    this.sfx.plant();
    this.note(user, text, true, `${auto ? '部署' : '放在'} ${def.name}${auto ? '' : ` ${row + 1}-${col + 1}`}`);
    return true;
  }

  shovel(user, text, row, col) {
    if (row < 0 || row >= BOARD.rows || col < 0 || col >= BOARD.cols) {
      this.note(user, text, false, '位置不对');
      return;
    }
    const p = this.grid[row][col];
    if (!p) {
      this.note(user, text, false, '这格没有守卫');
      return;
    }
    const refund = Math.floor(PLANT_MAP[p.type].cost * 0.3);
    this.sun += refund;
    this.removePlant(p);
    this.fx.push({
      kind: 'text', x: cellCX(col), y: plantGround(row) - 60, text: `+${refund}`, color: '#ffe14d', size: 18, age: 0, life: 0.8
    });
    this.note(user, text, true, `铲掉 ${PLANT_MAP[p.type].name}，退回 ${refund}`);
    this.sfx.shovel();
  }

  cellBlocked(row, col) {
    const cx = cellCX(col);
    return this.foes.some((z) => !z.dead && z.row === row && Math.abs(z.x - cx) < BOARD.cellW * 0.55);
  }

  autoPlace(plantId) {
    const empty = [];
    for (let r = 0; r < BOARD.rows; r++) {
      for (let c = 0; c < BOARD.cols; c++) {
        if (!this.grid[r][c] && !this.cellBlocked(r, c)) empty.push([r, c]);
      }
    }
    if (!empty.length) return null;

    const threat = Array(BOARD.rows).fill(0);
    for (const z of this.foes) {
      if (z.dead) continue;
      threat[z.row] += 1 + Math.max(0, (BOARD.r - z.x) / BOARD.r) * 2.4;
    }
    const glowbuds = Array(BOARD.rows).fill(0);
    for (const p of this.plants) if (p.type === 'glowbud') glowbuds[p.row] += 1;

    if (plantId === 'blastfruit') {
      let best = null;
      let bestScore = -1;
      for (const [r, c] of empty) {
        let sc = 0;
        for (const z of this.foes) {
          if (z.dead || Math.abs(z.row - r) > 1) continue;
          const dx = Math.abs(z.x - cellCX(c)) / BOARD.cellW;
          if (dx <= TUNE.blastfruitRadius) sc += TUNE.blastfruitRadius - dx;
        }
        sc += Math.random() * 0.4;
        if (sc > bestScore) { bestScore = sc; best = [r, c]; }
      }
      return best;
    }

    const pref = {
      glowbud: { col: 0.3, lane: -0.9 },
      peashot: { col: 2.2, lane: 1.0 },
      frostshot: { col: 2.6, lane: 1.0 },
      woodshield: { col: 6.4, lane: 1.3 },
      quaker: { col: 5.2, lane: 1.0 }
    }[plantId] || { col: 3, lane: 1 };

    let best = null;
    let bestScore = -1e9;
    for (const [r, c] of empty) {
      let sc = -Math.abs(c - pref.col) * 1.7;
      sc += threat[r] * pref.lane;
      if (plantId === 'glowbud') sc -= glowbuds[r] * 2.4;
      // 稍微偏向靠后的格子，别把豆炮顶到最前面
      sc -= c * 0.15;
      sc += Math.random() * 0.6;
      if (sc > bestScore) { bestScore = sc; best = [r, c]; }
    }
    return best;
  }

  /* ── 礼物 / 连接 ─────────────────────────────────── */

  handleGift(user, gift, count = 1) {
    const name = String(user || '').trim().slice(0, 12) || '观众';
    const n = Math.max(1, Math.min(10, Number(count) || 1));
    const add = Math.min(400, TUNE.giftSun * n);
    if (!this.gameOver) this.sun += add;
    this.stat(name).gifts += 1;
    this.note(name, `礼物 ${gift}`, true, `+${add} 能量`);
    this.toast(`感谢 ${name} 的${gift}！+${add} 能量`, '#ffd84d');
    for (let i = 0; i < 10; i++) {
      this.fx.push({
        kind: 'part', x: 56, y: 67, vx: rand(-260, 260), vy: rand(-320, -60),
        size: rand(3, 7), color: '#ffd84d', age: 0, life: rand(0.5, 0.9)
      });
    }
    this.sfx.ding();
  }

  setConn(mode) {
    this.conn = mode;
  }

  /* ── 演示弹幕 ───────────────────────────────────── */

  demoTick(dt) {
    this.demoT -= dt;
    if (this.demoT > 0) return;
    this.demoT = rand(1.0, 2.3);
    const name = pick(DEMO_NAMES);
    if (Math.random() < 0.06) {
      this.handleGift(name, pick(DEMO_GIFTS), 1);
      return;
    }
    if (Math.random() < 0.05 && this.plants.length > 16) {
      const cand = this.plants.filter((p) => p.type !== 'peashot' && p.type !== 'frostshot');
      if (cand.length) {
        const t = pick(cand);
        this.handleChat(name, `铲 ${t.row + 1}-${t.col + 1}`);
        return;
      }
    }
    const flowers = this.plants.filter((p) => p.type === 'glowbud').length;
    const shooters = this.plants.filter((p) => p.type === 'peashot' || p.type === 'frostshot').length;
    let chosen = null;
    if (flowers < 4 && this.sun >= 50) chosen = PLANTS[0];
    else if (shooters < 5) {
      if (this.sun < 100) return;
      chosen = PLANTS[1];
    } else if (this.plants.length < 14 && this.sun >= 50) {
      chosen = Math.random() < 0.6 ? PLANTS[0] : PLANTS[2];
    } else if (this.sun >= 150) {
      chosen = pick([PLANTS[3], PLANTS[4], PLANTS[5]]);
    }
    if (!chosen) return;
    const p = chosen;
    const r = Math.random();
    if (r < 0.5) {
      this.handleChat(name, String(p.key));
    } else if (r < 0.82) {
      const row = 1 + Math.floor(Math.random() * 5);
      const col = 1 + Math.floor(Math.random() * 9);
      this.handleChat(name, `${p.name} ${row}-${col}`);
    } else {
      this.handleChat(name, `${p.name}吧`);
    }
  }
}
