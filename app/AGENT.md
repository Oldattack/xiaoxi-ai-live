---
name: 小汐AI直播平台
slug: xiaoxi-ai-live
version_file: VERSION
runtime: node>=18
dependencies: none
entry: supervisor.mjs
main: xiaoxi.mjs
http_port: 8792
health: GET /health
ui: GET /settings
stage: GET /
target_dir: D:\xiaoxi-ai-live
---

# AGENT.md — 给 AI 的部署规格

> 用户把整个压缩包丢给你，并说「帮我装好」时，照这份文件执行。
> **不要问技术问题**，只做三件事：装好、启动、把设置页交给用户。

---

## 0. 目标

在这台 Windows 机器上跑起「小汐AI直播平台」，产出：

| 产物 | 说明 |
|---|---|
| 进程 | `node supervisor.mjs`（守护），监听 **8792** |
| 配置页 | http://127.0.0.1:8792/settings |
| 直播画面 | http://127.0.0.1:8792/ （OBS 用） |

**不需要**：npm install、数据库、Docker、登录任何账号。

> `xiaoxi.mjs` 是**已合并并混淆**的单文件主程序，看不到源码也不用看。
> `supervisor.mjs` 负责拉起它、崩溃重启、更新后自动重启。

---

## 1. 前置检查

```powershell
node -v
```

| 结果 | 动作 |
|---|---|
| v18 及以上 | 继续 |
| v16 或更低 | 让用户装 Node LTS，**不要**尝试兼容旧版 |
| 命令不存在 | 让用户去 https://nodejs.org 装 LTS，装完重跑本文件 |

端口检查：

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 8792 -InformationLevel Quiet
```

- `False` → 端口空闲，继续
- `True` → 可能已有实例。先 `GET /health`：是本程序就跳到第 3 步，不是就换端口 8793

---

## 2. 部署

### 2.1 解压到 D 盘

压缩包解压后自带一层 `xiaoxi-ai-live\` 目录，所以**直接解到 D 盘根目录**即可：

```powershell
Expand-Archive -Path "小汐AI直播平台.zip" -DestinationPath "D:\" -Force
```

解压后得到 `D:\xiaoxi-ai-live\`，里面应该是：

- `D:\xiaoxi-ai-live\xiaoxi.mjs`
- `D:\xiaoxi-ai-live\supervisor.mjs`
- `D:\xiaoxi-ai-live\config.json`
- `D:\xiaoxi-ai-live\sprites_hd\`

> 如果 `D:\xiaoxi-ai-live` **已经存在**（用户以前装过），说明这是升级：
> 先备份 `config.json`，复制新文件时**跳过 config.json**，装完后把备份放回去。
> 或者直接让用户双击本目录下的 `一键更新.cmd`（更省事，配置完全不动）。

**不要**装到 `C:\Program Files`（没写权限）。用户指定别的盘就换盘符。

### 2.2 启动

```powershell
Start-Process node -ArgumentList "supervisor.mjs" -WorkingDirectory "D:\xiaoxi-ai-live" -WindowStyle Hidden
```

> 起的是 `supervisor.mjs`，不是 `xiaoxi.mjs`。直接起 `xiaoxi.mjs` 不会自动重启。

### 2.3 等就绪

轮询 `http://127.0.0.1:8792/health`，最多 30 秒，间隔 2 秒。

正常返回：

```json
{ "ok": true, "uptimeSec": 12, "clients": 0, "songs": { "playing": null, "queued": 0 } }
```

---

## 3. 验证（全部 200 才算成功）

```powershell
Invoke-WebRequest http://127.0.0.1:8792/health    -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8792/settings  -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8792/          -UseBasicParsing
(Invoke-RestMethod http://127.0.0.1:8792/api/update).version
```

最后一条的返回值应等于 `VERSION` 文件内容。

---

## 4. 交给用户

```powershell
Start-Process "http://127.0.0.1:8792/settings"
```

然后**只说这三件事**：

1. 「抖音接入」里填直播间号（纯数字，开播后地址栏那串），点连接
2. 「说话方式」里粘语音 API 密钥（可选；不填用系统语音，比较机械）
3. OBS 加「浏览器」源，地址 `http://127.0.0.1:8792/`，1920×1080，**勾上「控制音频通过 OBS」**

填直播间号的两个前提，一并提醒：

- 直播间权限必须是「**所有人可进**」，只允许关注的人进抓不到弹幕
- 必须**正在直播中**

---

## 5. 硬约束

| # | 约束 | 原因 |
|---|---|---|
| C1 | **禁止**让用户在程序里登录抖音 | 会顶掉手机端和直播伴侣 |
| C2 | **禁止**接管开播 / 推流 | 只出画面，推流归用户的直播伴侣 |
| C3 | **禁止**用包里的 `config.json` 覆盖用户已有的 | 那里面是用户的房间号和密钥 |
| C4 | **禁止** `npm install` | 零依赖，装了反而可能坏 |
| C5 | 除非 8792 被占，**不要**换端口 | 端口写进了文档和 OBS 地址 |
| C6 | 改了文件必须重启 supervisor | 没有热重载 |

---

## 6. 排错

| 现象 | 处理 |
|---|---|
| `/health` 连不上 | 前台跑 `node xiaoxi.mjs` 看报错，多半是 Node 版本低 |
| 报 `EADDRINUSE` | 端口被占：`Get-Process node` 杀掉旧的，或 `node supervisor.mjs --port 8793` |
| 设置页能开、收不到弹幕 | 直播间不是公开的，或没在直播 |
| OBS 黑屏 | 地址必须是 `http://127.0.0.1:8792/`，1920×1080 |
| 点歌没声音 | OBS 浏览器源要勾「控制音频通过 OBS」 |
| 说话是机械音 | 没接语音服务，去「说话方式」粘密钥 |

---

## 7. 可选：装进 DSH 左侧栏

用户如果装了 DeepSeek Harness，可以多一个侧栏入口。

在 `D:\xiaoxi-ai-live` 里双击 `安装到DSH.cmd`，装完**必须完全退出 DSH 再打开**。

如果装完 DSH 打不开了，让用户双击 `修复DSH.cmd` 复原。

**这一项是可选的，装不装都不影响直播功能。**

---

## 8. 更新

程序自带更新器，**不要**手动替换文件。

用户侧：设置 → 运行状态 → 版本与更新 → 「检查更新」→「立即更新」。
更新成功后进程会自己退出并拉起新版。

更新地址（包内已预置，一般不用改）：

```
https://raw.githubusercontent.com/Oldattack/xiaoxi-ai-live/main/updates/manifest.json
```

---

## 9. 文件清单

```
启动.cmd              双击启动（等价于 node supervisor.mjs）
打开直播设置.cmd       起服务 + 打开设置页
xiaoxi.mjs           主程序（HTTP + SSE + 弹幕 + 点歌 + 语音，已混淆）
supervisor.mjs       守护进程：崩溃重启、更新后重启
scene.html           直播画面（OBS 抓这个）
settings.html        设置页
config.json          用户配置（勿覆盖）
sprites_hd\          6 张立绘
plugin\              DSH 插件（可选）
安装到DSH.cmd / 修复DSH.cmd   插件的安装与回滚
一键更新.cmd / update.ps1     不依赖程序更新器的兜底更新
VERSION              当前版本
使用说明.md           给用户的图文教程
```

---

## 10. 给用户的话

用户想自己看，让他打开 `使用说明.md`。
你要执行的，**只看这份 AGENT.md**。
