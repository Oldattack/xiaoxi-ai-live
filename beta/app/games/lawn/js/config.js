// 画面尺寸与玩法参数集中在这里，调手感只改这个文件。
export const VIEW = { W: 1920, H: 1080 };

export const HUD_H = 110;

export const BOARD = {
  x: 110,
  y: 120,
  cellW: 150,
  cellH: 168,
  cols: 9,
  rows: 5
};
BOARD.r = BOARD.x + BOARD.cellW * BOARD.cols; // 1460
BOARD.b = BOARD.y + BOARD.cellH * BOARD.rows; // 960

export const SIDE = { x: 1480, y: 120, w: 420, h: 940 };

export const TUNE = {
  startSun: 300,
  firstWaveDelay: 20,

  skySunMin: 8,
  skySunMax: 12,
  skySunValue: 25,
  glowbudEvery: 20,
  glowbudValue: 25,

  killSun: 8,
  giftSun: 40,

  userCooldown: 2.2,      // 同一个人两条指令的最小间隔（秒）
  shovelCooldown: 0.8,
  autoRestart: 12,        // 团灭后自动重开倒计时

  maxFeed: 6,
  peaSpeed: 780,
  peaDamage: 25,
  peaEvery: 1.3,

  snowDamage: 20,
  snowEvery: 1.4,

  foeEatDps: 45,

  blastfruitFuse: 1.1,
  blastfruitDamage: 2200,
  blastfruitRadius: 2.15,

  quakerArm: 11,
  quakerDamage: 2200,
  quakerRadius: 1.15
};
