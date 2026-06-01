# Render 部署操作清单

当前项目已经适配 Render 单服务部署。你只需要完成 GitHub 登录、推送仓库、Render 创建服务三步。

## 1. 登录 GitHub CLI

在 PowerShell 里运行：

```powershell
& "C:\Users\11433\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe" auth login
```

推荐选择：

```text
GitHub.com
HTTPS
Login with a web browser
```

按提示打开浏览器、输入验证码并授权。

## 2. 创建并推送 GitHub 仓库

登录完成后，在项目目录运行：

```powershell
cd C:\Users\11433\Documents\005
& "C:\Users\11433\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe" repo create miaoyu-agent --public --source . --remote origin --push
```

如果你想私有仓库，把 `--public` 改成 `--private`。

确认不要提交 `.env.local`。当前 `.gitignore` 已经忽略它。

## 3. 在 Render 创建服务

打开 Render：

```text
https://dashboard.render.com/
```

选择：

```text
New -> Blueprint
```

连接 GitHub 仓库：

```text
miaoyu-agent
```

Render 会读取仓库里的 `render.yaml`。

## 4. 配置环境变量

在 Render 的 Environment 里设置：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

重要：建议重新生成 DeepSeek API key，因为旧 key 已经在聊天中暴露过。

## 5. 验证公网地址

部署成功后，Render 会给你一个地址，例如：

```text
https://miaoyu-agent.onrender.com
```

检查：

```text
https://miaoyu-agent.onrender.com/api/health
```

如果返回：

```json
{
  "ok": true,
  "provider": "deepseek",
  "hasKey": true
}
```

再打开主页测试“生成回复”。成功后这个链接就可以分享给别人使用。
