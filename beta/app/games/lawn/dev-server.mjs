// 本地预览服务器：静态文件 + 假弹幕 SSE。
// 用法：node xiaoxi-live/games/lawn/dev-server.mjs  →  http://127.0.0.1:8899/
// 生产环境不用它，主服务 xiaoxi-live/server.mjs 会直接托管 /lawn。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 8899);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const clients = new Set();
const NAMES = ['小肥柴', '橘子汽水', '夜航船', '阿七', '不吃香菜', '云朵朵', '大橘为重', '晚风', '咸鱼翻身', '老空空', '西瓜太郎', '柚子茶'];
const COMMANDS = ['1', '2', '1', '2', '3', '豆炮 3-2', '光芽 2-2', '冰霜炮 4-5', '木盾 3-7', '震地雷 5-6', '爆裂果 2-5', '4', '2', '1', '铲 3-2'];
const GIFTS = ['小心心', '玫瑰', '棒棒糖', '人气票'];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    });
    res.write(': connected\n\n');
    res.write(`data: ${JSON.stringify({ kind: 'hello', at: Date.now() })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, clients: clients.size }));
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const safe = path.normalize(rel).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '');
  if (!safe || safe.startsWith('..')) { res.writeHead(403); return res.end('forbidden'); }
  const full = path.join(ROOT, safe);
  fs.readFile(full, (err, body) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    res.writeHead(200, {
      'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(body);
  });
});

function send(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of clients) { try { c.write(line); } catch { clients.delete(c); } }
}

let n = 0;
setInterval(() => {
  if (!clients.size) return;
  n += 1;
  const user = NAMES[n % NAMES.length];
  if (n % 23 === 0) {
    send({ kind: 'gift', user, text: GIFTS[n % GIFTS.length], count: 1, at: Date.now() });
    return;
  }
  if (n % 17 === 0) {
    send({ kind: 'enter', user, at: Date.now() });
    return;
  }
  send({ kind: 'chat', user, text: COMMANDS[n % COMMANDS.length], at: Date.now() });
}, 1700);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[lawn dev] http://127.0.0.1:${PORT}/  (假弹幕每 1.7s 一条)`);
});
