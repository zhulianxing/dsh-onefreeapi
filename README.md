# dsh-onefreeapi

> OneFreeAPI 的 LLM 网关 → MCP server。AI agent 通过工具调用访问 6+ 模型（Kimi K3 / GLM-5.2 / DeepSeek V3 / Doubao Seed / Qwen / GLM-flash）。

## Tools（3 个）

| Tool | What it does |
|---|---|
| `chat_completion(model, messages, temperature?, max_tokens?)` | 调用 Chat Completions |
| `list_models()` | 列出当前所有可用模型（`GET /v1/models`） |
| `usage()` | 查询账户余额（如果 OneFreeAPI 暴露了 usage 端点） |

## 快速上手

```bash
# 直接跑
cd dsh-onefreeapi
chmod +x mcp-server.js

# 测试
export OFA_API_KEY="sk-ofa-your_key"
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node mcp-server.js
```

## 客户端配置

```json
{
  "mcpServers": {
    "onefreeapi": {
      "command": "npx",
      "args": ["dsh-onefreeapi"],
      "env": { "OFA_API_KEY": "sk-ofa-your_key" }
    }
  }
}
```

## 模型选择

```
kimi-k3          月之暗面旗舰 · 256K ctx · $0.003/1K
glm-5.2          智谱旗舰 · 1M ctx · $0.003/1K
deepseek-v3      深度求索 · 编程强手
doubao-seed-1.6  字节豆包
glm-4-flash      智谱普惠 · $0.0003/1K
qwen2.5:0.5b     阿里通义 · 免费
```

## 定价

OneFreeAPI 注册送 100K free tokens；Pro $14/mo、Enterprise $139/mo。支持 USDT / 微信 / 支付宝。

---
**Requires**: Node 18+ | **Network**: Calls `onefreeapi.cloud/v1/*` | **Zero npm deps**
