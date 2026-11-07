# 发布说明（给维护者看，客户不用管）

这个仓库是「小汐AI直播平台」的分发仓库，客户的自动更新就从这里拉。

## 目录结构

```
xiaoxi-ai-live/
├─ app/                     解压后的完整程序（别人可单独下某个文件）
│  ├─ xiaoxi.mjs            混淆后的主程序
│  ├─ supervisor.mjs        守护进程
│  ├─ plugin/               DSH 插件
│  ├─ 启动.cmd / 停止.cmd
│  └─ 安装到DSH.cmd / 修复DSH.cmd
├─ updates/
│  ├─ manifest.json         版本清单（客户端只读这个）
│  ├─ xiaoxi-ai-live-X.zip  最近两个版本的整包
└─ README.md
```

**客户端只认 `updates/manifest.json`**，里面写着版本号和 zip 文件名。

## 发布一个新版本

一条命令：

```powershell
# 1. 只在这个窗口里设置 token（不要写进任何文件）
$env:GH_TOKEN = 'github_pat_xxxxxxxx'

# 2. 进到源码目录
cd <工作区>\xiaoxi-live

# 3. 发布
node tools/publish-github.mjs 1.8.1
```

它会依次做：

| 步骤 | 干什么 |
|---|---|
| 1 | 打分销版：合并 + 混淆成单文件 `xiaoxi.mjs` |
| 2 | 打整包（含插件、启动器、修复工具） |
| 3 | 生成 `updates/manifest.json` + 版本 zip |
| 4 | **发布前自检**（20 项，不过就中止，不会提交/推送） |
| 5 | 同步到本仓库的 `app/` 和 `updates/`，顺手改 README 里的版本号 |
| 6 | `git commit` |
| 7 | 有 `GH_TOKEN` 就推送 + 刷新 jsDelivr 缓存 |

### 发布前自检（`tools/preflight.mjs`）

单独也能跑：

```powershell
node tools/preflight.mjs 1.9.3
```

它会真做一遍：

```
解压整包 → 查关键文件 / .cmd 行尾 / VERSION / VBS 编码
假 DSH 里装插件 → 用 node JSON.parse 验（防 BOM 崩溃）
真起服务 → /health、/settings、/api/update
调 /api/shutdown → 确认端口释放 + 0 残留进程\n真双击 启动.vbs / 停止.vbs → 确认静默启停正常
校验 manifest 版本与 sha256
```

**24 项全绿才允许发布**，任何一项红了 publish 会直接中止。

硬要发（不建议）：`set SKIP_PRECHECK=1` 再跑。

## Token 安全约定（重要）

发布脚本对 token 的处理是**只读、不落地**：

| 位置 | 会不会留下 token |
|---|---|
| `.git/config` | **不会**（脚本不写任何 git 配置） |
| 命令行参数 / 进程列表 | **不会**（用环境变量传给 git，不拼进 URL） |
| 日志 / 输出文件 | **不会**（脚本从不打印 token） |
| 磁盘任何文件 | **不会** |

做法是 git 的 `GIT_CONFIG_COUNT` 机制：把 `http.extraheader` 通过**环境变量**注入本次 git 调用，
调用结束就随进程消失。

**用完记得关掉那个 PowerShell 窗口**，`$env:GH_TOKEN` 就没了。

### 建议用 Fine-grained token

```
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
  Repository access: Only select repositories → xiaoxi-ai-live
  Permissions: Contents = Read and write
  Expiration: 7 天
```

比 classic token（`repo` + `workflow` 全权限）安全得多。

### 万一 token 泄露了

```
https://github.com/settings/tokens
→ 找到那个 token → Delete
```

删掉后 token 立即失效（API 会返回 401），已经推上去的内容不受影响。

## 更新源与镜像

客户端默认从 raw 拉清单，失败会自动换镜像，并**取版本最高的那个**：

```
1. https://raw.githubusercontent.com/Oldattack/xiaoxi-ai-live/main/updates/manifest.json
2. https://ghproxy.net/<上面的地址>
3. https://cdn.jsdelivr.net/gh/Oldattack/xiaoxi-ai-live@main/updates/manifest.json
```

> jsDelivr 有缓存，发布后需要清一下（脚本里已经自动请求）：
> `https://purge.jsdelivr.net/gh/Oldattack/xiaoxi-ai-live@main/updates/manifest.json`

## 为什么仓库里留两个 zip

只留最新一个的话，CDN 换档的那几分钟里，客户端会拿到新清单却下载不到旧包（404）。
保留最近两个版本可以跨过这个窗口。

## 客户怎么更新

```
DSH 左侧栏 →「小汐AI直播平台」→ 右上角「检查更新」
  → 有新版本按钮变成「更新到 vX.Y.Z」
  → 点一下 → 自动下载 → 自动重启
```

更新**不会覆盖 `config.json`**（直播间号、语音密钥、人设都保留），旧版本备份在 `backup/<版本号>/`。
