/**
 * 守护进程：拉起主程序，退出就自动重启
 *
 * - 更新后主程序 exit(0) → 立刻重启
 * - 崩溃 → 退避重启（2s → 30s）
 * - 父进程（窗口/DSH）没了 → 自己退出，避免"关了软件还在说话"
 * - 想彻底停：关窗口 / 双击「停止.cmd」/ 放一个 stop.flag
 */

import { spawn } from 'node:child_process';
import fs, { existsSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STOP_FLAG = path.join(HERE, 'stop.flag');
const LOG = path.join(HERE, 'supervisor.log');

let child = null;
let stopped = false;
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
  if (a === '--parent-pid' || a === '--hidden') return false;
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

function shutdown(reason) {
  if (stopped) return;
  stopped = true;
  log('停止：' + reason);
  killChild();
  setTimeout(() => process.exit(0), 300);
}

function start() {
  // 上次「关闭服务」留下的标记：这次是用户主动启动，清掉继续跑
  if (existsSync(STOP_FLAG)) {
    try { unlinkSync(STOP_FLAG); } catch { /* ignore */ }
    log('清理上次的停止标记，正常启动');
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

/* ── 父进程看门狗：窗口/DSH 关了，就一起退出 ── */
if (PARENT_PID) {
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
}

/* ── 停止信号 ── */
process.on('SIGINT', () => shutdown('收到 Ctrl+C'));
process.on('SIGTERM', () => shutdown('收到终止信号'));
process.on('SIGHUP', () => shutdown('窗口被关闭'));
process.on('exit', () => { try { killChild(); } catch { /* ignore */ } });

/* ── stop.flag 轮询 ── */
setInterval(() => {
  if (existsSync(STOP_FLAG)) {
    const f = STOP_FLAG;
    try { unlinkSync(f); } catch { /* ignore */ }
    shutdown('收到 stop.flag');
  }
}, 1500).unref();

log('守护启动，正在拉起主程序…');
start();

try {
  const v = path.join(HERE, 'VERSION');
  if (!existsSync(v)) writeFileSync(v, '0.0.0\n', 'utf8');
} catch { /* ignore */ }
