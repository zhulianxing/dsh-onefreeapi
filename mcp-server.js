#!/usr/bin/env node
/**
 * dsh-onefreeapi — OneFreeAPI LLM gateway as an MCP server.
 *
 * Zero-dependency, single-file, Node 18+.
 * One API key gives access to 6+ models (Kimi K3, GLM-5.2, DeepSeek V3, etc).
 * Auth: OFA_API_KEY env var (sk-ofa-...)
 */
import { createInterface } from 'node:readline';

const VERSION = '0.1.0';
const BASE = (process.env.OFA_BASE_URL || 'https://onefreeapi.cloud').replace(/\/+$/, '');
const API_KEY = process.env.OFA_API_KEY || '';

async function api(method, path, body) {
  if (!API_KEY) throw new Error('OFA_API_KEY environment variable required. Get one at https://onefreeapi.cloud');
  const headers = { Accept: 'application/json', Authorization: 'Bearer ' + API_KEY };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`OneFreeAPI ${method} ${path} failed: ${(data.error?.message || data.error || 'HTTP ' + res.status)}`);
  return data;
}

const TOOLS = [
  {
    name: 'chat_completion',
    description: '调用 OneFreeAPI 的 OpenAI 兼容 Chat Completions 端点。支持多模型（Kimi K3 / GLM-5.2 / DeepSeek V3 / Doubao Seed 1.6 / Qwen / GLM-4-flash / GLM-4.6）。返回结构化 choices[0].message.content',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          enum: ['kimi-k3', 'glm-5.2', 'deepseek-v3', 'doubao-seed-1.6', 'glm-4-flash', 'glm-4.6', 'qwen2.5:0.5b', 'qwen3:8b'],
          description: '模型 ID',
        },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: { role: { type: 'string', enum: ['system', 'user', 'assistant'] }, content: { type: 'string' } },
            required: ['role', 'content'],
          },
          description: '消息历史',
        },
        temperature: { type: 'number', description: '0 - 2，越高越发散' },
        max_tokens: { type: 'number', description: '最大输出 token（默认 1024）' },
        stream: { type: 'boolean', description: '是否流式输出（默认 false）' },
      },
      required: ['model', 'messages'],
    },
  },
  {
    name: 'list_models',
    description: '列出 OneFreeAPI 当前所有可用模型（GET /v1/models）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'usage',
    description: '查询账户 token 使用量和余额（如果 OneFreeAPI 有 usage 端点）',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'chat_completion': {
      const body = {
        model: args.model,
        messages: args.messages,
      };
      if (args.temperature !== undefined) body.temperature = args.temperature;
      if (args.max_tokens !== undefined) body.max_tokens = args.max_tokens;
      if (args.stream) body.stream = true;
      return await api('POST', '/v1/chat/completions', body);
    }
    case 'list_models':
      return await api('GET', '/v1/models');
    case 'usage':
      try { return await api('GET', '/v1/usage'); }
      catch { return { note: 'Usage endpoint may not be exposed. Check https://onefreeapi.cloud/dashboard.html', fallback: 'GET /v1/models works as a connectivity check.' }; }
    default:
      throw new Error('Unknown tool: ' + name);
  }
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handleMessage(msg) {
  const { method, id, params } = msg;
  if (id === undefined || id === null) return null;
  const result = (r) => ({ jsonrpc: '2.0', id, result: r });
  const error = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  try {
    switch (method) {
      case 'initialize':
        return result({
          protocolVersion: params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'dsh-onefreeapi', version: VERSION },
        });
      case 'ping': return result({});
      case 'tools/list': return result({ tools: TOOLS });
      case 'tools/call': {
        try {
          const out = await callTool(params?.name, params?.arguments ?? {});
          const text = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
          return result({ content: [{ type: 'text', text }], isError: false });
        } catch (e) {
          return result({ content: [{ type: 'text', text: String(e.message || e) }], isError: true });
        }
      }
      default: return error(-32601, 'Method not found: ' + method);
    }
  } catch (e) {
    return error(-32603, String(e.message || e));
  }
}

let inFlight = 0;
let stdinClosed = false;
function maybeExit() { if (stdinClosed && inFlight === 0) process.exit(0); }

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try { msg = JSON.parse(trimmed); } catch { return; }
  inFlight++;
  handleMessage(msg)
    .then((out) => { if (out) send(out); })
    .catch(() => {})
    .finally(() => { inFlight--; maybeExit(); });
});
rl.on('close', () => { stdinClosed = true; maybeExit(); });
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
