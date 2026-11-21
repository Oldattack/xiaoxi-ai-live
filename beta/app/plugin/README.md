# 小汐AI直播平台 · 插件

两种打开方式，任选。

## 方式一：双击就能开（不用装）

根目录的 **`打开直播设置.cmd`**：

1. 服务没起就自动起一个（最小化窗口）
2. 自动打开 `http://127.0.0.1:8792/settings`

双击即可，不用记命令、不用开终端。

## 方式二：装进 DSH，侧栏一键进

装好后 DSH 左侧栏会多一个「小汐AI直播平台」图标，点开就是设置页（内嵌 iframe，状态实时）。

### 安装

在 DSH 里：**设置 → 插件 → 从本地安装** → 选这个目录 `live-agent-plugin`。

或者命令行（先关掉 DSH，否则会 EPERM）：

```powershell
"<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<这个目录的绝对路径>"
```

装完**重启一次 DSH**——客户端面板是启动时编排的，热装不会把新页面加进来。

### 面板里有什么

| 区域 | 内容 |
|---|---|
| 顶栏 | 服务状态点、收到/已回/平均延迟、重新加载、独立窗口打开 |
| 主体 | 完整的设置页（弹幕互动 / AI 大脑 / 声音 / 热场 / 抖音接入 / 画面与端口 / 彩排 / 运行状态） |
| 服务没起时 | 卡片上有「启动服务」按钮，一键拉起；也给了手动命令 |
| 服务在跑时 | 顶栏有「停止服务」按钮，连着 PID 一起收掉 |

### 换端口

面板默认连 `http://127.0.0.1:8792`。改端口后，在浏览器控制台执行一次即可：

```js
localStorage.setItem('dsh.live-agent.origin', 'http://127.0.0.1:9000')
```

## 说明

- 插件**会管服务**：`/live-agent/start` / `/live-agent/stop` / `/live-agent/status` 三个路由，
  由 Host 半边（`index.js`）直接 spawn 那个零依赖的 `server.mjs`，PID 写在 `live-agent/.server.pid`。
- 服务目录由插件目录下的 **`agent-path.txt`** 决定（换位置就改这一行），也可用环境变量 `LIVE_AGENT_DIR` 覆盖。
- 面板用 iframe，跨源不共享 Cookie，也不影响设置页自己的接口。
- 如果 DSH 的 CSP 拦了 iframe，面板底部会出现提示，点「独立窗口打开」即可。
