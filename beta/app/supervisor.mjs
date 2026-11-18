/**
 * 守护进程：拉起主程序，退出就自动重启
 *
 * - 更新后主程序 exit(0) → 立刻重启
 * - 崩溃 → 退避重启（2s → 30s）
 * - 父进程（窗口/DSH）没了 → 默认仍常驻，避免直播中关窗口把 AI 停掉
 * - 想退出即停：加 --exit-with-parent
 * - 想彻底停：关窗口后点「关闭服务」/ 停止.cmd / 放一个 stop.flag
 */

import { spawn } from 'node:child_process';
import fs, { existsSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STOP_FLAG = path.join(HERE, 'stop.flag');
const LOG = path.join(HERE, 'supervisor.log');
const RUNTIME = path.join(HERE, 'runtime.json');   // 给「停止」用的运行时记录：{pid, port}

let child = null;
let stopped = false;
let wroteRuntime = false;
let backoff = 2000;

/* ── 参数 ── */
const argv = process.argv.slice(2);
function argOf(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : '';
}
// 没显式指定就盯着自己的父进程（启动窗口）；窗口一关就跟着退
const PARENT_PID = Number(argOf('--parent-pid')) || process.ppid || 0;
// --hidden：由插件 / 启动.vbs 拉起时不弹任何控制台窗口
// 没有终端（插件 / vbs 拉起）就自动隐藏，避免弹黑框
const HIDDEN = argv.includes('--hidden') || !!Number(process.env.XIAOXI_HIDDEN || 0) || !process.stdout.isTTY;
const PASSTHROUGH = argv.filter((a, i) => {
  if (a === '--parent-pid' || a === '--hidden' || a === '--persist' || a === '--exit-with-parent') return false;
  if (i > 0 && (argv[i - 1] === '--parent-pid')) return false;
  return true;
});

function log(msg) {
  const line = `[${new Date().toLocaleString('zh-CN')}] ${msg}\n`;
  process.stdout.write(line);
  try { appendFileSync(LOG, line); } catch { /* 日志写不了就算了 */ }
}

function killChild() {
  if (!child) return;
  try { child.kill(); } catch { /* ignore */ }
  try { if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ignore */ }
}

/* ── 单实例锁 ──
 * 同一安装目录只允许一个守护。插件每分钟巡检、用户重复双击启动时，
 * 只要主程序正好在崩溃退避里（端口空着），就会再拉一个守护出来，
 * 两个守护各起一个主程序 → EADDRINUSE 反复崩 → 每 30 秒重启一次，
 * 表现为「刷抖音时虚拟摄像头老掉、场景被切回小汐直播」。
 */
const LOCK = path.join(HERE, 'supervisor.lock');
function lockOwnerAlive() {
  let pid = 0;
  try { pid = Number(String(fs.readFileSync(LOCK, 'utf8')).trim()) || 0; } catch { return false; }
  if (!pid || pid === process.pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function releaseLock() {
  try {
    if (Number(String(fs.readFileSync(LOCK, 'utf8')).trim()) === process.pid) unlinkSync(LOCK);
  } catch { /* 没锁或读不到就算了 */ }
}
if (lockOwnerAlive()) {
  log('已有守护在跑（supervisor.lock），本守护退出');
  process.exit(0);
}
try { writeFileSync(LOCK, String(process.pid), 'utf8'); } catch { /* 写不了锁就退化回老行为 */ }

function shutdown(reason) {
  if (stopped) return;
  stopped = true;
  log('停止：' + reason);
  removeRuntime();
  releaseLock();
  killChild();
  setTimeout(() => process.exit(0), 300);
}

function start() {
  // stop.flag 是「用户主动停止」的粘性标记：由启动器/插件在用户点启动时清除。
  // supervisor 自己绝不清除，否则插件巡检会把服务又拉起来。
  if (existsSync(STOP_FLAG)) {
    log('检测到停止标记，保持停止（用户主动启动时由启动器清除）');
    process.exit(0);
  }

  // 分销版是 xiaoxi.mjs（混淆单文件），源码版是 server.mjs
  const entry = existsSync(path.join(HERE, 'xiaoxi.mjs')) ? 'xiaoxi.mjs' : 'server.mjs';
  // 隐藏模式：不弹窗，输出重定向到 supervisor.log
  let errFd = null;
  if (HIDDEN) {
    try { errFd = fs.openSync(LOG, 'a'); } catch { errFd = null; }
  }
  child = spawn(process.execPath, [entry, ...PASSTHROUGH], {
    cwd: HERE,
    stdio: HIDDEN ? ['ignore', errFd || 'ignore', errFd || 'ignore'] : 'inherit',
    windowsHide: HIDDEN
  });

  child.on('exit', (code, signal) => {
    if (stopped) return;
    if (existsSync(STOP_FLAG)) {
      log('检测到停止标记，退出守护');
      process.exit(0);
    }
    if (code === 0) {
      log('主程序正常退出（可能是刚更新完），立刻重启…');
      backoff = 2000;
      setTimeout(start, 800);
      return;
    }
    log(`主程序异常退出（code=${code} signal=${signal || '-'}），${backoff / 1000} 秒后重启`);
    setTimeout(start, backoff);
    backoff = Math.min(30000, backoff * 2);
  });
}

/* ── 父进程看门狗：默认常驻；显式 --exit-with-parent 才跟随父进程退出 ── */
const EXIT_WITH_PARENT = argv.includes('--exit-with-parent');
if (PARENT_PID && EXIT_WITH_PARENT) {
  const timer = setInterval(() => {
    let alive = true;
    try { process.kill(PARENT_PID, 0); } catch { alive = false; }
    if (!alive) {
      clearInterval(timer);
      shutdown('父进程（PID ' + PARENT_PID + '）已经不在了');
    }
  }, 2000);
  timer.unref?.();
  log('已挂上父进程看门狗：PID ' + PARENT_PID);
} else {
  log('服务常驻模式：关 DSH/窗口不会停（直播不会中断）；要停请点「关闭服务」');
}

/* ── 停止信号 ── */
process.on('SIGINT', () => shutdown('收到 Ctrl+C'));
process.on('SIGTERM', () => shutdown('收到终止信号'));
process.on('SIGHUP', () => shutdown('窗口被关闭'));
process.on('exit', () => {
  try { killChild(); } catch { /* ignore */ }
  removeRuntime();
  releaseLock();
});

/* ── stop.flag 轮询 ── */
setInterval(() => {
  if (existsSync(STOP_FLAG)) {
    // 不删标记：删了会被插件巡检重新拉起
    shutdown('收到 stop.flag');
  }
}, 1500).unref();

// 已经有服务在跑就别再拉一个（重复启动会抢端口）
// 端口取值顺序必须和 server.mjs 一致：--port > 环境变量 PORT > 同目录 config.json 的 port > 8792。
// 少了 config.json 这一层，客户在设置页改过端口时，守护会去探 8792，
// 探到别的实例（或本机另一套安装）健康就误判「已有实例在跑」直接退出，服务根本没被拉起来。
function supPort() {
  const explicit = Number(argOf('--port')) || Number(process.env.PORT) || 0;
  if (explicit > 0) return explicit;
  try {
    const raw = String(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8')).replace(/^\uFEFF/, '');
    const p = Number(JSON.parse(raw).port) || 0;
    if (p > 0) return p;
  } catch { /* 没有 config.json / 读不了 / JSON 坏了：回退 8792 */ }
  return 8792;
}
/** 写/删运行时记录：停止脚本靠它精确找到「本安装目录」的守护，不去全局杀 node */
function writeRuntime() {
  try {
    writeFileSync(RUNTIME, JSON.stringify({ pid: process.pid, port: supPort(), startedAt: Date.now() }), 'utf8');
    wroteRuntime = true;
  } catch { /* 写不了就算了，停止脚本还有端口兜底 */ }
}
function removeRuntime() {
  if (!wroteRuntime) return;
  wroteRuntime = false;
  try { if (existsSync(RUNTIME)) unlinkSync(RUNTIME); } catch { /* ignore */ }
}

async function alreadyUp() {
  try {
    const r = await fetch('http://127.0.0.1:' + supPort() + '/health', { signal: AbortSignal.timeout(1200) });
    return r.ok;
  } catch { return false; }
}
if (await alreadyUp()) {
  log('已有实例在跑，本守护退出（避免重复启动）');
  process.exit(0);
}

writeRuntime();
log('守护启动，正在拉起主程序…');
start();

try {
  const v = path.join(HERE, 'VERSION');
  if (!existsSync(v)) writeFileSync(v, '0.0.0\n', 'utf8');
} catch { /* ignore */ }
