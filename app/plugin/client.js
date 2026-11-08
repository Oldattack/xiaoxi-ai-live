window.__ModuleLoader__.load({
  id: '@local/dsh-live-agent',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;
    const NS = 'dsh-live-agent';
      const AUTHOR = 'Oldattack';
      const PLUGIN_VERSION = '1.1.0';

    /** 本地直播服务地址；换端口就改这里（或 localStorage 覆盖） */
    const ORIGIN =
      (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('dsh.live-agent.origin')) ||
      'http://127.0.0.1:8792';

    const zh = {
      'sidebar.label': '小汐AI直播平台',
      'page.title': '小汐AI直播平台',
      'page.subtitle': '弹幕、模型、形象、画面——所有设置都在这一页',
      'status.online': '服务在线',
      'status.offline': '服务未启动',
      'status.checking': '正在检查…',
      'action.reload': '重新加载',
      'action.window': '独立窗口打开',
        'action.update': '检查更新',
        'action.updating': '更新中…',
        'action.version': '版本',
      'offline.title': '本地直播服务没有运行',
      'offline.hint': '先在终端里启动它（窗口不要关）：',
      'offline.cmd': 'cd xiaoxi-live && node server.mjs',
      'offline.retry': '再试一次',
      'frame.blocked': '面板被浏览器拦截了，点右上角「独立窗口打开」即可。',
    };
    const en = {
      'sidebar.label': 'Live Agent',
      'page.title': 'Live Agent',
      'page.subtitle': 'Danmaku, model, avatar and scene settings in one page.',
      'status.online': 'Service online',
      'status.offline': 'Service offline',
      'status.checking': 'Checking…',
      'action.reload': 'Reload',
      'action.window': 'Open window',
      'offline.title': 'The local live service is not running',
      'offline.hint': 'Start it in a terminal (keep the window open):',
      'offline.cmd': 'cd xiaoxi-live && node server.mjs',
      'offline.retry': 'Retry',
      'frame.blocked': 'The panel was blocked by the browser — use “Open window”.',
    };

    const CSS = `
.dsh-la-root{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:100%;background:var(--dsw-alias-bg-base);}
.dsh-la-bar{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:none;}
.dsh-la-badge{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);flex:none;}
.dsh-la-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1.3;}
.dsh-la-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary);}
.dsh-la-spacer{flex:1;}
.dsh-la-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);white-space:nowrap;}
.dsh-la-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);}
.dsh-la-dot--online{background:var(--dsw-alias-state-success-primary);}
.dsh-la-dot--offline{background:var(--dsw-alias-state-error-primary);}
.dsh-la-btn{appearance:none;padding:6px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap;}
.dsh-la-btn:hover{background:var(--dsw-alias-bg-layer-3);}
.dsh-la-body{position:relative;flex:1;min-height:0;}
  .dsh-la-foot{flex:none;display:flex;align-items:center;gap:8px;padding:7px 16px;
    border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);
    font-size:11.5px;color:var(--dsw-alias-label-secondary);}
  .dsh-la-foot b{font-weight:600;color:var(--dsw-alias-label-primary);}
  .dsh-la-foot .sep{opacity:.45;}
.dsh-la-frame{width:100%;height:100%;border:0;display:block;background:#f6f6fa;}
.dsh-la-offline{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-base);}
.dsh-la-card{max-width:520px;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:22px 24px;}
.dsh-la-card h2{margin:0 0 6px;font-size:16px;color:var(--dsw-alias-label-primary);}
.dsh-la-card p{margin:0 0 10px;font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.6;}
.dsh-la-code{display:block;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:var(--dsw-alias-label-primary);margin-bottom:14px;user-select:all;}
.dsh-la-tip{margin-top:10px;font-size:12px;color:var(--dsw-alias-state-warn-primary);}
`;

    /* 小汐的标记：圆角方块 + 一道潮汐 + 一点水滴 */
    function Glyph(props) {
      const p = props || {};
      const size = p.size || 20;
      const active = !!p.active;
      return h(
        'svg',
        {
          width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: active ? 1.95 : 1.7,
          strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
          style: { display: 'block' },
        },
        h('rect', { x: 2.6, y: 2.6, width: 18.8, height: 18.8, rx: 6 }),
        h('path', { d: 'M6.4 14.4c1.5-2.3 3.2-2.3 4.7 0s3.2 2.3 4.7 0' }),
        h('path', { d: 'M6.4 10.2c1.5-2.3 3.2-2.3 4.7 0', opacity: 0.55 }),
        h('circle', { cx: 16.6, cy: 8.4, r: 1.15, fill: 'currentColor', stroke: 'none' }),
      );
    }

    function makePanel(ctx) {
      const t = ctx.locale.bind(NS);
      return function LiveAgentPanel() {
        const [status, setStatus] = useState('checking');
        const [info, setInfo] = useState(null);
        const [nonce, setNonce] = useState(0);
        const [blocked, setBlocked] = useState(false);
        const [busy, setBusy] = useState('');
        const [error, setError] = useState('');
        const frameRef = useRef(null);
        const loaded = useRef(false);
        const [ver, setVer] = useState('');
        const [upd, setUpd] = useState(null);     // { hasUpdate, latest, current, notes }
        const [updBusy, setUpdBusy] = useState(false);

        useEffect(() => {
          let stop = false;
          async function tick() {
            try {
              const r = await fetch('/live-agent/status', { cache: 'no-store' });
              if (!r.ok) throw new Error('HTTP ' + r.status);
              const j = await r.json();
              if (!stop) { setStatus(j.running ? 'online' : 'offline'); setInfo(j); }
            } catch {
              if (!stop) { setStatus('offline'); setInfo(null); }
            }
          }
          tick();
          fetch('/live-agent/version', { cache: 'no-store' })
            .then((r) => r.json())
            .then((j) => { if (!stop && j && j.version) setVer(j.version); })
            .catch(() => {});
          const timer = setInterval(tick, 3000);
          return () => { stop = true; clearInterval(timer); };
        }, []);

        async function act(kind) {
          setBusy(kind);
          try {
            const r = await fetch('/live-agent/' + kind, { method: 'POST' });
            const j = await r.json().catch(() => ({}));
            if (j.ok === false) setError(j.error || '操作失败');
            else setError('');
            setNonce((n) => n + 1);
          } catch (e) {
            setError(String(e && e.message || e));
          } finally {
            setBusy('');
          }
        }

        async function checkUpdate() {
          setUpdBusy(true);
          setError('');
          try {
            const r = await fetch('/live-agent/update/check', { method: 'POST' });
            const j = await r.json();
            if (j && j.ok === false) { setError(j.reason || '检查失败'); setUpd(null); }
            else setUpd(j);
          } catch (e) {
            setError(String((e && e.message) || e));
          } finally { setUpdBusy(false); }
        }

        async function doUpdate() {
          if (!upd || !upd.hasUpdate) { await checkUpdate(); return; }
          setUpdBusy(true);
          try {
            const r = await fetch('/live-agent/update/apply', { method: 'POST' });
            const j = await r.json();
            if (j && j.ok === false) setError(j.error || '更新失败');
            else { setError(''); setUpd(null); setStatus('checking'); }
          } catch (e) {
            setError(String((e && e.message) || e));
          } finally { setUpdBusy(false); }
        }

        useEffect(() => {
          loaded.current = false;
          setBlocked(false);
          const timer = setTimeout(() => { if (!loaded.current) setBlocked(true); }, 5000);
          return () => clearTimeout(timer);
        }, [nonce, status]);

        const dotClass = 'dsh-la-dot dsh-la-dot--' + (status === 'online' ? 'online' : status === 'offline' ? 'offline' : '');
        const statusText = status === 'online' ? t('status.online') : status === 'offline' ? t('status.offline') : t('status.checking');
        const stats = info && info.stats ? info.stats : null;

        return h('div', { className: 'dsh-la-root' },
          h('style', null, CSS),
          h('div', { className: 'dsh-la-bar' },
            h('div', { className: 'dsh-la-badge' }, h(Glyph, { size: 18 })),
            h('div', null,
              h('div', { className: 'dsh-la-title' }, t('page.title')),
              h('div', { className: 'dsh-la-sub' }, t('page.subtitle'), ' · 作者 ', h('span', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, AUTHOR)),
            ),
            h('div', { className: 'dsh-la-spacer' }),
            stats ? h('span', { className: 'dsh-la-pill' },
              '收到 ' + stats.received + ' · 已回 ' + stats.replied + ' · 平均 ' + (stats.avg ? stats.avg + 'ms' : '—')
            ) : null,
            h('span', { className: 'dsh-la-pill' }, h('span', { className: dotClass }), statusText),
            status === 'online'
              ? h('button', { className: 'dsh-la-btn', disabled: busy === 'stop', onClick: () => act('stop') },
                  busy === 'stop' ? '停止中…' : '停止服务')
              : h('button', { className: 'dsh-la-btn', disabled: busy === 'start', onClick: () => act('start') },
                  busy === 'start' ? '启动中…' : '启动服务'),
            ver ? h('span', { className: 'dsh-la-pill' }, 'v' + ver) : null,
            upd && upd.hasUpdate
              ? h('button', {
                  className: 'dsh-la-btn',
                  style: { background: 'var(--dsw-alias-brand-primary)', color: '#fff', borderColor: 'transparent' },
                  disabled: updBusy,
                  onClick: doUpdate,
                }, updBusy ? t('action.updating') : ('更新到 v' + upd.latest))
              : h('button', { className: 'dsh-la-btn', disabled: updBusy, onClick: checkUpdate },
                  updBusy ? t('action.updating') : t('action.update')),
            h('button', { className: 'dsh-la-btn', onClick: () => setNonce(nonce + 1) }, t('action.reload')),
            h('button', {
              className: 'dsh-la-btn',
              onClick: () => window.open(ORIGIN + '/settings', '_blank', 'width=1600,height=1000'),
            }, t('action.window')),
          ),
          upd && upd.hasUpdate && upd.notes
            ? h('div', {
                style: {
                  padding: '8px 16px', fontSize: '12.5px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  borderBottom: '1px solid var(--dsw-alias-border-l1)',
                  color: 'var(--dsw-alias-label-secondary)',
                },
              }, '新版本 v' + upd.latest + '：' + upd.notes)
            : null,
            h('div', { className: 'dsh-la-foot' },
              h(Glyph, { size: 13 }),
              h('span', null, '小汐AI直播平台'),
              h('span', { className: 'sep' }, '·'),
              h('span', null, '作者 ', h('b', null, AUTHOR)),
              h('span', { className: 'sep' }, '·'),
              h('span', null, 'v' + (ver || PLUGIN_VERSION)),
            ),
          h('div', { className: 'dsh-la-body' },
            status === 'offline'
              ? h('div', { className: 'dsh-la-offline' },
                  h('div', { className: 'dsh-la-card' },
                    h('h2', null, t('offline.title')),
                    h('p', null, t('offline.hint')),
                    h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' } },
                      h('button', {
                        className: 'dsh-la-btn',
                        style: { padding: '9px 18px', fontSize: 13.5, fontWeight: 600 },
                        disabled: busy === 'start',
                        onClick: () => act('start'),
                      }, busy === 'start' ? '启动中…' : '启动服务'),
                      h('span', { style: { fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)' } }, '或手动执行：'),
                    ),
                    h('code', { className: 'dsh-la-code' }, t('offline.cmd')),
                    error ? h('div', { className: 'dsh-la-tip' }, error) : null,
                  ))
              : h('iframe', {
                  key: nonce,
                  ref: frameRef,
                  className: 'dsh-la-frame',
                  src: ORIGIN + '/settings',
                  onLoad: () => { loaded.current = true; setBlocked(false); },
                  title: '小汐AI直播平台设置',
                }),
            blocked && status !== 'offline'
              ? h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 14px', background: 'var(--dsw-alias-bg-layer-1)', borderTop: '1px solid var(--dsw-alias-border-l1)', fontSize: 12, color: 'var(--dsw-alias-state-warn-primary)' } }, t('frame.blocked'))
              : null,
          ),
        );
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [locale, dict] of [['zh', zh], ['en', en]]) {
          ctx.effect(() => ctx.locale.register(NS, locale, dict), `live-agent locale ${locale}`);
        }
        const t = ctx.locale.bind(NS);

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: 'live-agent', order: 21, label: () => t('sidebar.label') },
            (props = {}) => h(Glyph, { size: props.size, active: props.active }),
          ),
        );

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'live-agent' }, makePanel(ctx)),
        );
      },
    };
  },
});
