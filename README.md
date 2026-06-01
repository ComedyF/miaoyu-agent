# 妙语Agent

一个网页版中文回复风格 Agent：输入对方消息，选择关系、回复目标、语气强度和风格，生成多条可直接发送的回复。

## 功能

- 三栏工作台：输入配置、回复结果、Agent 思考过程
- 支持风格：温柔、坚定、幽默、高情商、职场、鲁迅版、林黛玉版、甄嬛体、霸总不油、阴阳怪气安全版
- DeepSeek API 后端代理，密钥只在服务端读取
- 回复复制、收藏、排序、单条润色
- 预设套用与新建预设

## 本地启动

```powershell
npm.cmd install
npm.cmd run dev
```

打开：

```text
http://127.0.0.1:5173
```

API 服务默认在：

```text
http://127.0.0.1:8787
```

## 环境变量

项目读取 `.env.local`：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
PORT=8787
```

注意：当前开发用 key 已写入本地 `.env.local`，该文件被 `.gitignore` 忽略。

## Render 部署

这个项目已经整理成 Render 单服务部署形态：

- 构建命令：`npm install && npm run build`
- 启动命令：`npm start`
- Web 服务会读取 Render 提供的 `PORT`
- Express 会同时提供前端页面和 `/api/*`

Render 环境变量：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

仓库里也包含 `render.yaml`，可以用 Render Blueprint 创建服务。

重要：不要提交 `.env.local`，真实 key 只放在 Render 的 Environment Variables 里。
