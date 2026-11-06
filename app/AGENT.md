---
name: 小汐AI直播平台
slug: xiaoxi-ai-live
version_file: VERSION
runtime: node>=18
dependencies: none
entry: xiaoxi.mjs
http_port: 8792
health: GET /health
ui: GET /settings
stage: GET /
target_dir: D:\xiaoxi-ai-live
---

# AGENT.md — 给 AI 的部署规格

> 这是一份**机器可读**的部署说明。用户把整个包丢给你时，按下面的流程执行，
> 不要问用户技术问题，只做三件事：装好、启动、把配置页交给用户。

---

## 0. 任务目标

在一台 Windows 机器上，把 `小汐AI直播平台` 跑起来，产出：

| 产物 | 说明 |
|---|---|
| 进程 | `node supervisor.mjs`，常驻，监听 8792 |
| 可访问地址 | `http://127.0.0.1:8792/settings`（用户配置用） |
| 可访问地址 | `http://127.0.0.1:8792/`（OBS 抓画面用） |

**不需要**：npm install、数据库、Docker、登录任何账号。

---

## 1. 前置检查（PREFLIGHT）

```powershell
node -v
```

| 结果 | 判定 | 动作 |
|---|---|---|
| v18.x 及以上 | PASS | 继续 |
| v16 / 更低 | FAIL | 让用户装 Node LTS，**不要**尝试降级兼容 |
| 命令不存在 | FAIL | 让用户去 https://nodejs.org 下载 LTS，装完重跑本文件 |

端口占用检查：

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 8792 -InformationLevel Quiet
```

- 返回 `False` → 端口空闲，继续
- 返回 `True` → 已有实例在跑；先 `GET /health` 确认是不是本程序，是就跳过启动直接进第 3 步

---

## 2. 部署（DEPLOY）

### 2.1 解压

目标路径 **`D:\xiaoxi-ai-live`**（除非用户指定；**不要**装到 C 盘 `Program Files`，会没有写权限）。

```powershell
Expand-Archive -Path "小汐AI直播平台.zip" -DestinationPath "D:\" -Force
Rename-Item "D:\xiaoxi-ai-live" "D:\xiaoxi-ai-live" -ErrorAction SilentlyContinue
```

解压后应存在：`D:\xiaoxi-ai-live\server.mjs`、`supervisor.mjs`、`config.json`、`sprites_hd\`。

### 2.2 启动

```powershell
cd D:\xiaoxi-ai-live
Start-Process node -ArgumentList "supervisor.mjs" -WorkingDirectory "D:\xiaoxi-ai-live" -WindowStyle Hidden
```

> `xiaoxi.mjs` 是主程序（已合并混淆）：服务崩溃或更新后会自己拉起来。**不要**直接起 `xiaoxi.mjs`。

### 2.3 等待就绪

轮询 `http://127.0.0.1:8792/health`，最多 30 秒，间隔 2 秒。

成功响应示例：

```json
{ "ok": true, "uptimeSec": 3, "clients": 0, "songs": {...} }
```

---

## 3. 验证（VERIFY）

依次检查，全部 200 才算完成：

```powershell
Invoke-WebRequest http://127.0.0.1:8792/health           # 200
Invoke-WebRequest http://127.0.0.1:8792/settings         # 200，HTML
Invoke-WebRequest http://127.0.0.1:8792/                  # 200，HTML
(Invoke-RestMethod http://127.0.0.1:8792/api/update).version   # 与 VERSION 文件一致
```

---

## 4. 交付给用户（HANDOFF）

打开设置页：

```powershell
Start-Process "http://127.0.0.1:8792/settings"
```

然后告诉用户这三件事（**只讲这些，不要展开技术细节**）：

1. 在「抖音接入」填直播间号（纯数字），点连接
2. 在「说话方式」粘语音 API 密钥（可选，不填就用系统语音）
3. 在 OBS 加「浏览器源」，地址 `http://127.0.0.1:8792/`，宽高 1920×1080

---

## 5. 硬约束（CONSTRAINTS）

| 编号 | 约束 | 原因 |
|---|---|---|
| C1 | **禁止**让用户在程序里登录抖音 | 会顶掉手机端和直播伴侣，用户会掉线 |
| C2 | **禁止**尝试接管开播 / 推流 | 本程序只出画面，推流归用户的直播伴侣 |
| C3 | **禁止**把 `config.json` 用安装包里的覆盖 | 那里面是用户配置和密钥 |
| C4 | **禁止**执行 `npm install` | 零依赖，装了反而可能破坏 |
| C5 | **禁止**改端口除非 8792 被占 | 端口写进了文档和 OBS 地址 |
| C6 | 修改文件后**必须**重启 supervisor，否则不生效 | 没有热重载 |

---

## 6. 故障处理（TROUBLESHOOT）

| 现象 | 判定 | 处理 |
|---|---|---|
| `/health` 连不上 | 进程没起 / 秒退 | 前台跑 `node xiaoxi.mjs` 看报错；常见是 Node 版本低 |
| 启动报 `EADDRINUSE` | 端口被占 | `Get-Process node` 找到旧进程杀掉，或 `node supervisor.mjs --port 8793` |
| 设置页能开，收不到弹幕 | 房间不是公开的 / 未开播 | 让用户把直播间权限改成「所有人可进」并确认正在直播 |
| OBS 里黑屏 | 浏览器源地址错 | 必须是 `http://127.0.0.1:8792/`，宽高 1920×1080 |
| 点歌没声音 | OBS 没开音频 | 浏览器源属性里勾「控制音频通过 OBS」 |
| 说话是机械音 | 没接语音服务 | 设置 → 说话方式 → 粘 API 密钥 |

---

## 7. 更新（UPDATE，可选）

程序自带更新器，**不需要**你手动替换文件。

用户侧操作：设置 → 运行状态 → 版本与更新 → 填 manifest 地址 → 检查更新。

或由你调用：

```powershell
POST http://127.0.0.1:8792/api/update/check   body: {"manifestUrl":"<地址>"}
POST http://127.0.0.1:8792/api/update/apply
```

`apply` 成功后进程会退出，supervisor 会在 2 秒内自动拉起新版本。**不要**在此期间重复启动。

---

## 8. 程序结构

> 这是**分销版**：服务端逻辑已合并进 `xiaoxi.mjs` 并混淆，不要试图改源码，
> 出问题看 `supervisor.log` 和命令行输出。

```
xiaoxi.mjs            主程序（HTTP + SSE + 弹幕源 + 点歌 + 语音，已合并混淆）
supervisor.mjs        守护：拉起 server，退出即重启
scene.html            直播画面（OBS 抓这个）
settings.html         设置页
config.json           用户配置（勿覆盖）
sprites_hd/           6 张立绘
VERSION               当前版本
```

---

## 9. 给用户的自然语言版本

如果用户想自己看，让他们打开 `使用说明.md`。
你要执行的话，**只看这份 AGENT.md**。
