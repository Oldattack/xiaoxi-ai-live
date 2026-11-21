# 发布说明

这个文件是重建仓库时补的占位。原来的内容在 C 盘清理时随仓库一起丢了。

## 正常发布流程

```powershell
cd <工作区>\xiaoxi-live
node tools\publish-github.mjs <版本号> --beta
```

七步：打分销版 → 打整包 → 生成更新源 → 自检 → 同步仓库 → 提交 → 推送。

## 约定

- 自检不通过就不发布，不要用 `SKIP_PRECHECK=1` 硬发；
- `config.json` 永不覆盖（直播间号、密钥、人设都要保留）；
- `updates/` 只留最近两个包；
- token 只放环境变量，不落盘。
