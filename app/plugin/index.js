/**
 * 小汐AI直播平台 · 插件 Host 半边。
 *
 * 除了给面板用，还负责**看住本地直播服务**：
 *   GET  /live-agent/status   → 服务在不在跑
 *   POST /live-agent/start    → 起一个（后台，不占终端）
 *   POST /live-agent/stop     → 停掉
 *
 * 服务本身是零依赖的 xiaoxi-live/server.mjs，这里负责拉起 supervisor.mjs（守护 + 自动重启）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'live-agent';
export const inject = ['webServer'];

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8792;

/** 直播服务目录：环境变量 > 插件目录旁的 agent-path.txt > 默认猜测 */
function agentDir() {
  const fromEnv = String(process.env.LIVE_AGENT_DIR || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const line = readFileSync(path.join(DIR, 'agent-path.txt'), 'utf8').trim();
    if (line) return path.isAbsolute(line) ? line : path.resolve(DIR, line);
  } catch { /* 没配就用默认 */ }
  return path.join(DIR, '..', 'xiaoxi-live');
}

const SERVER = () => path.join(agentDir(), 'supervisor.mjs');   // 守护进程：更新后自动重启
const PID_FILE = () => path.join(agentDir(), '.server.pid');

async function probe(timeoutMs = 1500) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/state`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function readPid() {
  try { return Number(readFileSync(PID_FILE(), 'utf8').trim()) || 0; } catch { return 0; }
}

function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function status() {
  const state = await probe();
  const pid = readPid();
  return {
    running: Boolean(state),
    pid: state ? pid : (pidAlive(pid) ? pid : 0),
    port: PORT,
    dir: agentDir(),
    source: state?.source?.type || '',
    stats: state?.stats
      ? { received: state.stats.received, replied: state.stats.replied, avg: state.stats.latency?.avg || 0 }
      : null
  };
}

async function start() {
  const already = await probe(800);
  if (already) return { ok: true, already: true, ...(await status()) };

  const server = SERVER();
  if (!existsSync(server)) {
    return { ok: false, error: `找不到 ${server}（改插件目录下的 agent-path.txt 指向 xiaoxi-live 目录）` };
  }

  // 注意：不能用 process.execPath —— 在 DSH 里它是 DSH 自己的 exe，
  // 会把服务当成第二个 DSH 进程跑（实测踩过），还可能被当成主程序误杀。
  const nodeBin = (() => {
    const env = String(process.env.LIVE_AGENT_NODE || '').trim();
    if (env && existsSync(env)) return env;
    for (const c of ['C:\\Program Files\\nodejs\\node.exe', 'C:\\Program Files (x86)\\nodejs\\node.exe']) {
      if (existsSync(c)) return c;
    }
    return '';
  })();
  if (!nodeBin) {
    return { ok: false, error: '找不到独立的 node.exe（装 Node.js，或用环境变量 LIVE_AGENT_NODE 指一个）' };
  }

  const child = spawn(nodeBin, ['supervisor.mjs'], {
    cwd: agentDir(),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env }
  });
  child.unref();
  try { writeFileSync(PID_FILE(), String(child.pid), 'utf8'); } catch { /* 只读目录就算了 */ }

  // 等它真的能响应，最多 15 秒
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await probe(800)) return { ok: true, started: true, pid: child.pid, ...(await status()) };
  }
  return { ok: false, error: '进程起来了但 15 秒内没响应，看看 xiaoxi-live 目录下有没有报错' };
}

async function stop() {
  const pid = readPid();
  const state = await probe(800);
  if (!state && !pidAlive(pid)) {
    try { unlinkSync(PID_FILE()); } catch { /* 没文件 */ }
    return { ok: true, already: true, running: false };
  }
  if (pid) {
    // Windows 上用 taskkill 把子进程一起收掉
    try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }); }
    catch { try { process.kill(pid); } catch { /* 已经没了 */ } }
  }
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 400));
    if (!(await probe(600))) {
      try { unlinkSync(PID_FILE()); } catch { /* ignore */ }
      return { ok: true, stopped: true, running: false };
    }
  }
  return { ok: false, error: '进程还在响应，可能不是它（端口被别的程序占着）' };
}

function json(res, code, body) {
  try {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  } catch { /* 连接已断 */ }
}

async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const p = url.pathname.replace(/^\/live-agent/, '') || '/';

  if (p === '/status' && req.method === 'GET') return json(res, 200, await status());
  if (p === '/start' && req.method === 'POST') return json(res, 200, await start());
  if (p === '/stop' && req.method === 'POST') return json(res, 200, await stop());
  return json(res, 404, { ok: false, error: 'no route' });
}

export function apply(ctx) {
  const mount = (tries = 0) => {
    let ws = null;
    try { ws = (typeof ctx.get === 'function' ? ctx.get('webServer') : null) ?? ctx.webServer; } catch { ws = null; }
    if (!ws || typeof ws.register !== 'function') {
      if (tries < 150) setTimeout(() => mount(tries + 1), 2000);
      return;
    }
    try {
      ctx.effect(
        () => ws.register({ kind: 'prefix', path: '/live-agent', handler }),
        'live-agent: service control routes'
      );
    } catch { /* 挂不上也不影响客户端面板 */ }
  };
  mount();
}
