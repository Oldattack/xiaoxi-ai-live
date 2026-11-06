/**
 * 守护进程：拉起 server.mjs，退出就自动重拉
 *
 * - 更新后 server 会主动 exit(0) → 这里立刻重启，用户无感
 * - 崩溃 → 退避重启（2s、4s、8s… 最多 30s）
 * - 想彻底停：关掉这个窗口，或同目录放一个 stop.flag
 */

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STOP_FLAG = path.join(HERE, 'stop.flag');
const LOG = path.join(HERE, 'supervisor.log');

let child = null;
let stopped = false;
let backoff = 2000;

function log(msg) {
  const line = `[${new Date().toLocaleString('zh-CN')}] ${msg}\n`;
  process.stdout.write(line);
  try { appendFileSync(LOG, line); } catch { /* 日志写不了就算了 */ }
}

function start() {
  if (existsSync(STOP_FLAG)) {
    log('发现 stop.flag，不启动');
    process.exit(0);
  }
  const args = process.argv.slice(2);
  child = spawn(process.execPath, ['xiaoxi.mjs', ...args], {
    cwd: HERE,
    stdio: 'inherit',
    windowsHide: false,
    env: { ...process.env, XIAOXI_SUPERVISED: '1' }
  });

  child.on('exit', (code, signal) => {
    if (stopped) return;
    if (existsSync(STOP_FLAG)) {
      log('检测到停止标记，退出守护');
      process.exit(0);
    }
    if (code === 0) {
      // 正常退出：多半是更新后主动重启
      log('服务正常退出（可能是刚更新完），立刻重启…');
      backoff = 2000;
      setTimeout(start, 800);
      return;
    }
    log(`服务异常退出（code=${code} signal=${signal || '-'}），${backoff / 1000} 秒后重启`);
    setTimeout(start, backoff);
    backoff = Math.min(30000, backoff * 2);
  });
}

process.on('SIGINT', () => {
  stopped = true;
  log('收到 Ctrl+C，正在停止…');
  try { child && child.kill(); } catch { /* ignore */ }
  process.exit(0);
});

// 支持通过写 stop.flag 停止
setInterval(() => {
  if (existsSync(STOP_FLAG) && child) {
    stopped = true;
    try { child.kill(); } catch { /* ignore */ }
    try { unlinkSync(STOP_FLAG); } catch { /* ignore */ }
    log('收到 stop.flag，已停止服务');
    process.exit(0);
  }
}, 2000).unref();

log('守护启动，正在拉起服务…');
start();

// 首次写版本号文件，方便排查
try {
  const v = path.join(HERE, 'VERSION');
  if (!existsSync(v)) writeFileSync(v, '0.0.0\n', 'utf8');
} catch { /* ignore */ }
