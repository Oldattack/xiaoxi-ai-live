# 小汐 AI 直播平台 · 技术支持手册（发给 AI 用）

> **给客户的一句话**：先双击 `自检.cmd`，再把生成的 `诊断报告-xxxx.txt` 整个拖进对话框发给 AI。
> **给 AI 的话**：读完这份手册 + 报告，直接给结论和修复步骤，不要反问客户"你版本多少"。

---

## 一、系统速查

| 项目 | 值 |
|---|---|
| 安装目录 | 默认 `D:\xiaoxi-ai-live`（不要装 C 盘） |
| 主程序 | `xiaoxi.mjs`（混淆版）或 `server.mjs`（源码版），二选一 |
| 端口 | 默认 8792（`config.json` 里的 `port`） |
| 守护进程 | `supervisor.mjs --hidden` → 拉起主程序，挂了自动重启 |
| 启动器 | `启动.cmd` / `启动.vbs`（静默）；`停止.cmd` / `停止.vbs` |
| 修复工具 | `修复DSH.cmd`（DSH 打不开）、`自检.cmd`（本工具） |
| 关键接口 | `/health` `/api/state` `/api/version` `/api/persona` `/api/emotions` `/events`（SSE） |
| 日志 | `supervisor.log`（被进程占用，只能用共享读） |
| 配置 | `config.json`（**UTF-8 无 BOM**，别用 Get-Content 默认编码读，会乱码） |
| 素材目录 | `sprites_hd/`（内置）· `sprites_custom/`（客户上传）· `sprites_hd/avatar/`（动作视频） |
| 更新源 | `https://raw.githubusercontent.com/Oldattack/xiaoxi-ai-live/main/updates/{manifest.json|beta/manifest.json}` |

---

## 二、怎么读报告（判读顺序）

1. **有没有找到安装目录** → 没找到 = 没装或装别处了，先确认装哪了
2. **node 版本** → 没有 node = 「点启动没反应」的第一嫌疑
3. **监听 / health** → 没监听 = 服务没起来；有监听但 health 打不开 = 端口被别的程序占了
4. **回复开关** → `关闭` = 永远不回弹幕（新装默认是关的，这是设计如此）
5. **模型 Key** → 空 = 只会说 8 句兜底话术（"嘿嘿，谢谢～"）
6. **抖音房间号** → 空 = 连不上
7. **日志尾部** → 看有没有 `弹幕通道断开`、`重连`、`401`、`超时`
8. **网络** → 更新源不通 = 检查更新会失败（但不影响直播）

---

## 三、问题库（症状 → 判定 → 修复）

### A. 起不来 / 打不开

**A1. 双击「启动」黑窗口一闪就没 / 什么都没发生**
- 判定：报告里 `node` 显示 ❌
- 原因：机器上没有 Node.js，或装在插件找不到的位置
- 修复（按顺序试）：
  1. 装 Node.js LTS：https://nodejs.org → 一路下一步 → **完全退出 DSH 再重开**
  2. 或设环境变量：`setx LIVE_AGENT_NODE "C:\Program Files\nodejs\node.exe"`
  3. 或把 `node.exe` 放进安装目录的 `runtime\` 下
- 注意：2.6.228 之后已支持自动查找（环境变量 → runtime\ → DSH 自带 → Program Files → 用户目录 → nvm → PATH）

**A2. 有黑窗口，但浏览器打不开 8792**
- 判定：报告里 `监听` 有进程但 `/health` 失败
- 修复：
  ```powershell
  Get-NetTCPConnection -LocalPort 8792 -State Listen | Select OwningProcess
  # 如果占用者不是 node：换端口，改 config.json 里的 port，或杀掉那个进程
  ```

**A3. 服务老是自己关闭**
- 判定：报告里 `启动时间` 很近（几分钟前），日志尾部有重复启动记录
- 修复：先看 `supervisor.log` 里崩溃前最后 20 行；常见是 `config.json` 损坏（用 UTF-8 校验）、端口被占、磁盘满

**A4. 设置页能开，画面 8792/ 打不开**
- 判定：`/health` 通、`/` 不通
- 修复：重装 `scene.html`（整包覆盖，不动 config.json）

### B. 不回弹幕

**B1. 一条都不回**
- 判定顺序：① `回复开关` 是开还是关 ② `模型 Key` 空不空 ③ `抖音房间号` 有没有 ④ 日志有没有连上
- 修复：
  - 开关关着 → 设置页把「自动回复」打开
  - Key 空 → 填 Key（不填只能走兜底话术）
  - 房间号空 → 填自己的直播间号
- ⚠️ 新装默认 `gate.enabled=false`（这是已知设计，老问题）

**B2. 偶尔回、偶尔不回**
- 判定：日志里有 `丢弃` 计数增长；报告 `/health` 的 `dropped` > 0
- 原因：闸门（冷却/同人限流/相似判重/每分钟上限）
- 修复：设置页把 `冷却`、`同人间隔`、`相似判重`、`每分钟上限` 调松

**B3. 回复重复 / 同一句念很多遍**
- 判定：日志里连续相同文本；或模型返回空内容走兜底池
- 原因：模型是推理型（flash/reason），`maxTokens` 给小了 → content 为空 → 走 8 句兜底
- 修复：`maxTokens` 提到 600+；或换非推理模型

**B4. 弹幕通道反复断开重连（日志刷屏）**
- 判定：日志连续 `弹幕通道断开，5 秒后第 1 次重连`
- 原因：2.6.230 之前 `reconnectTries` 每次重连都被清零，退避永远升不上去
- 修复：升级到 2.6.230+
- 临时处置：确认直播间是否已下播（下播会一直断）

**B5. 只有进来了/刷礼物有反应，说话不回**
- 判定：`/health` 里 `received` 涨但 `replied` 不涨
- 原因：关键词规则命中走了固定话术；或闸门丢弃
- 修复：设置页检查「快捷话术」规则是不是太宽

### C. 声音

**C1. 没声音**
- 判定：`语音` 是否已开、`语音Key` 空不空
- 修复：填豆包语音 Key；或先用 `browser` 引擎验证是不是 TTS 的问题
- 另查：OBS 里音频源是否静音、系统输出设备对不对（程序走系统声音，直播伴侣抓系统声）

**C2. 语音报 55000000 / Key 识别不了**
- 原因：豆包凭据格式不对
- 修复：设置页「语音」里粘贴完整凭据（支持 JSON / appid:token / sk-xxx 三种写法）

**C3. 念到一半断了**
- 判定：回复超过 70 字
- 原因：`tts.maxChars=70` 硬截断
- 修复：调 `tts.maxChars`，或让模型回复更短

### D. 形象 / 表情

**D1. 换了人物图但画面还是旧的**
- 判定：报告里 `人物形象` 的 model 指向新图；画面没变
- 修复：刷新画面源（OBS 浏览器源右键刷新）；确认 `avatar.kind=image`、`model` 是 `/avatar-file/xxx.png`

**D2. 表情切换后突然变成另一个人**
- 原因：只换了人物图，没给表情传素材 → 表情切回内置旧角色
- 修复：设置页 →「人物形象」→「表情列表」→ 给每个表情传图/视频

**D3. 给某表情传了图但不生效**
- 原因：2.6.231 之前，`开心` 固定借用 `welcome` 槽，传的图被忽略
- 修复：升级到 2.6.231+；或把该表情的「用哪张图」改成「跟随名字」

### E. OBS

**E1. OBS 画面只占左上角 / 只渲染一半**
- 修复：设置页「诊断 OBS」→「一键对齐」（会把场景分辨率、源尺寸、变换都拉正）

**E2. OBS 里没声音**
- 原因：程序走系统声音，OBS 要抓「桌面音频」或直播伴侣抓系统声
- 修复：OBS 混音器加「音频输出捕获」

**E3. 刷抖音后 OBS 画面被改 / 人物位置被重置**
- 判定：日志里有切场景记录
- 修复：升级；设置页「锁定位置」打开

### F. 更新

**F1. 检查更新失败 / 下载超时**
- 判定：报告里 `更新源 raw.githubusercontent.com` ❌
- 修复：换网络（热点）再试；或手动下载整包覆盖（保留 config.json）

**F2. 更新完功能坏了 / 形象丢了**
- 原因：整包覆盖了 `config.json` 或 `sprites_custom`
- 修复：升级前备份 `config.json` + `sprites_custom/` + `data/`

---

## 四、可给客户直接粘贴的修复命令

```powershell
# 1) 看谁占着 8792
Get-NetTCPConnection -LocalPort 8792 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }

# 2) 正常重启（保留配置）
cd D:\xiaoxi-ai-live
.\停止.cmd
Start-Sleep 2
.\启动.vbs

# 3) 强行清理残留
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*nodejs*' } | Stop-Process -Force

# 4) 校验 config.json 是否损坏（用 UTF-8 读，别用 Get-Content）
[IO.File]::ReadAllText('D:\xiaoxi-ai-live\config.json',[Text.Encoding]::UTF8) | ConvertFrom-Json | Out-Null
'config.json OK'

# 5) 备份配置再升级
Copy-Item D:\xiaoxi-ai-live\config.json D:\config-backup.json -Force
Copy-Item D:\xiaoxi-ai-live\sprites_custom D:\sprites-backup -Recurse -Force
```

---

## 五、AI 回答客户时的规矩

1. **先给结论**（一句话说是什么问题），再给步骤
2. **每条命令都要能直接粘贴**，不要写"修改一下配置"这种空话
3. 需要改文件时，给出**具体路径 + 改哪一行**
4. 不确定的不要编，让客户跑一条命令回来确认
5. 涉及密钥/账号，**不要把密钥回显出来**
6. 修完让客户回报一件事即可：`/health` 的 ok 是不是 true

---

## 六、版本对照（判断要不要升级）

| 版本 | 修了什么 |
|---|---|
| ≤2.6.226 | 基线 |
| 2.6.227 | （见交接清单） |
| 2.6.228 | 找不到 node.exe（扩大查找范围 + 版本校验） |
| 2.6.229 | 文档措辞、自检项 |
| 2.6.230 | 弹幕无限重连、测试假红、`\n` 字面量 |
| 2.6.231 | 人设风格模板、有意思规则、表情自定义、自定义表情图生效 |
