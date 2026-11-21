import { Game } from './game.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const errBox = document.getElementById('err');

function showError(msg) {
  if (!errBox) return;
  errBox.hidden = false;
  errBox.textContent = String(msg).slice(0, 300);
  clearTimeout(showError.t);
  showError.t = setTimeout(() => { errBox.hidden = true; }, 8000);
}
window.addEventListener('error', (e) => showError('画面出错：' + (e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => showError('画面出错：' + (e.reason && e.reason.message || e.reason)));

const game = new Game(canvas, {
  demo: q.has('demo'),
  mute: q.has('mute')
});
window.__lawn = game;

if (q.has('warp')) {
  const s = Math.max(0, Math.min(900, Number(q.get('warp')) || 0));
  game.warp(s);
}
if (q.has('over')) game.endGame();
game.start();

function connect(url) {
  let es;
  try {
    es = new EventSource(url);
  } catch (e) {
    showError('连不上弹幕：' + e.message);
    return;
  }
  es.onopen = () => game.setConn('on');
  es.onerror = () => game.setConn('off');
  es.onmessage = (ev) => {
    let d;
    try { d = JSON.parse(ev.data); } catch { return; }
    if (!d || typeof d !== 'object') return;
    if (d.kind === 'chat') game.handleChat(d.user, d.text);
    else if (d.kind === 'gift') game.handleGift(d.user, d.text, d.count);
  };
}

if (!game.demo && !q.has('nosse')) {
  connect(q.get('events') || '/events');
}

// 方便主播在 OBS 里临时排查：控制台里 __lawn
console.log('[弹幕Lawn] 已启动', game.demo ? '(演示弹幕)' : '(等待弹幕)');
