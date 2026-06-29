import dotenv from "dotenv";
import express from "express";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { createWorker } from "tesseract.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const distPath = path.resolve(__dirname, "..", "dist");
const ocrCachePath = path.join(os.tmpdir(), "miaoyu-agent-tesseract");

app.use(express.json({ limit: "8mb" }));

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL,
});

const defaultStyles = ["\u6e29\u67d4", "\u9ad8\u60c5\u5546", "\u804c\u573a"];
let ocrWorkerPromise;

function normalizePayload(payload) {
  const message = String(payload?.message || "").trim();
  const relationship = String(payload?.relationship || "\u540c\u4e8b / \u5de5\u4f5c\u4f19\u4f34").trim();
  const goal = String(payload?.goal || "\u5b89\u6170\u9f13\u52b1 + \u63d0\u4f9b\u652f\u6301").trim();
  const intensity = Number.isFinite(Number(payload?.intensity))
    ? Math.max(0, Math.min(100, Number(payload.intensity)))
    : 38;
  const requestedStyles = Array.isArray(payload?.styles)
    ? payload.styles.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    message,
    relationship,
    goal,
    intensity,
    styles: requestedStyles.length ? requestedStyles : defaultStyles,
    count: Math.max(3, Math.min(10, Number(payload?.count || 10))),
  };
}

function extractJson(content) {
  if (!content) {
    throw new Error("The model returned empty content.");
  }

  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("The model response was not valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function imageBufferFromDataUrl(dataUrl) {
  const value = String(dataUrl || "");
  const match = value.match(/^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("请上传 PNG、JPG、JPEG 或 WebP 格式的聊天截图。");
  }

  const buffer = Buffer.from(match[1], "base64");
  if (!buffer.length) {
    throw new Error("上传的图片为空。");
  }
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("图片过大，请上传 5 MB 以内的聊天截图。");
  }
  return buffer;
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    mkdirSync(ocrCachePath, { recursive: true });
    ocrWorkerPromise = createWorker("chi_sim+eng", 1, {
      cachePath: ocrCachePath,
    });
  }
  return ocrWorkerPromise;
}

function buildContextPrompt({ ocrText, relationship, goal }) {
  return `You are a Chinese chat-context interpreter.
The user uploaded a screenshot of a chat. OCR text may contain mistakes, missing punctuation, app UI labels, or mixed speaker order.

Your task:
1. Extract the current conversation context.
2. Identify the latest or most important message from the other person that the user should reply to.
3. Produce a concise "replyContext" that can be used as the received message for a reply-generation agent.
4. Correct obvious OCR mistakes in Chinese words when the surrounding context makes the correction clear.

Return strict JSON only. No Markdown. No code fences.

JSON schema:
{
  "replyContext": "Simplified Chinese. Include only useful context and the other person's latest key message.",
  "ocrSummary": "Simplified Chinese summary of the chat screenshot",
  "analysis": {
    "scene": "one short Simplified Chinese sentence",
    "intent": "one short Simplified Chinese sentence",
    "risk": {
      "emotionRisk": "低/中/高",
      "sensitiveContent": "无 or brief note",
      "suggestion": "suggested reply direction"
    }
  },
  "suggestedGoal": "one of: 安慰鼓励 + 提供支持, 礼貌拒绝, 真诚道歉, 催促推进, 解释说明, 表达边界, 缓和冲突, 邀约试探, 确认信息",
  "confidence": "高/中/低"
}

Rules:
- All fields must be Simplified Chinese.
- Do not include unrelated app UI words, timestamps, battery text, or OCR noise.
- If speaker identity is unclear, infer carefully and mention uncertainty in ocrSummary.
- replyContext should include the latest message and the useful preceding context, not only one isolated sentence.
- replyContext should be 80-220 Chinese characters when possible.
- Relationship selected by user: ${relationship || "未指定"}.
- Current reply goal selected by user: ${goal || "未指定"}.

OCR text:
${ocrText}`;
}

function fallbackTags(style, goal) {
  return [style || goal || "\u5f97\u4f53\u56de\u5e94", "\u81ea\u7136\u8868\u8fbe"];
}

function normalizeReply(reply, index, requestedStyles, goal) {
  const style = String(reply?.style || requestedStyles[index % requestedStyles.length] || defaultStyles[1]);
  const text = String(reply?.text || "").trim();
  return {
    id: `${Date.now()}-${index}`,
    style,
    tags: Array.isArray(reply?.tags) && reply.tags.length
      ? reply.tags.slice(0, 3).map((tag) => String(tag))
      : fallbackTags(style, goal),
    text,
    suitableFor: String(reply?.suitableFor || "\u9002\u5408\u76f4\u63a5\u53d1\u9001\uff0c\u4e5f\u53ef\u7ee7\u7eed\u6da6\u8272\u3002"),
    rationale: String(reply?.rationale || "\u517c\u987e\u5173\u7cfb\u3001\u76ee\u6807\u548c\u8bed\u6c14\u5f3a\u5ea6\u3002"),
    wordCount: text.replace(/\s/g, "").length,
    favorite: false,
  };
}

function buildPrompt(input, mode = "generate", seedReply = "") {
  const intensityLabel =
    input.intensity < 30 ? "soft" : input.intensity < 60 ? "moderate" : input.intensity < 82 ? "strong" : "intense";
  const styleList = input.styles.join(", ");
  const stylePlan = input.styles
    .slice(0, Math.min(input.styles.length, input.count))
    .map((style, index) => `Reply ${index + 1} style must be exactly "${style}"`)
    .join("; ");

  return `You are a Chinese reply-style agent.
Your task: based on a message the user received, generate replies that the user can directly send back.

Return strict JSON only. No Markdown. No code fences.

JSON schema:
{
  "analysis": {
    "scene": "one short Simplified Chinese sentence",
    "intent": "one short Simplified Chinese sentence",
    "risk": {
      "emotionRisk": "low/medium/high in Simplified Chinese",
      "sensitiveContent": "none or brief note in Simplified Chinese",
      "suggestion": "suggested direction in Simplified Chinese"
    }
  },
  "replies": [
    {
      "style": "style name, exactly as requested when specified",
      "tags": ["short Simplified Chinese tag", "short Simplified Chinese tag"],
      "text": "Simplified Chinese reply that can be sent directly",
      "suitableFor": "short Simplified Chinese usage note",
      "rationale": "short Simplified Chinese reasoning"
    }
  ]
}

Rules:
1. All reply text, tags, suitableFor, rationale, and analysis fields must be Simplified Chinese.
2. The reply must be what the user sends to the other person. Do not write third-person advice.
3. The reply goal has highest priority: ${input.goal}.
4. Generate ${input.count} replies. Requested styles: ${styleList}.
5. Hard style requirement: ${stylePlan || `Reply 1 style must be exactly "${input.styles[0] || defaultStyles[1]}"`}.
6. Do not replace requested fun styles with generic styles unless additional replies exceed requested style count.
7. Each reply should be natural, 35-90 Chinese characters when possible.
8. Avoid attacks, manipulation, excessive self-humbling, guilt-tripping, or unnecessary lectures.
9. For styles like Lu Xun style, Lin Daiyu style, Zhen Huan style, borrow only public cultural tone. Do not directly quote recognizable original lines.
10. "Yin-yang safe style" should be mildly teasing without hurting the relationship. "Non-greasy CEO style" should be steady and restrained.

Input:
- Received message: ${input.message}
- Relationship: ${input.relationship}
- Reply goal: ${input.goal}
- Tone intensity: ${intensityLabel} (${input.intensity}/100)
- Target styles: ${styleList}
${mode === "refine" ? `- Reply to refine: ${seedReply}\nRefine around the original reply and selected style.` : ""}`;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "deepseek",
    model,
    hasKey: Boolean(process.env.DEEPSEEK_API_KEY),
  });
});

app.post("/api/extract-chat-context", async (req, res) => {
  try {
    const relationship = String(req.body?.relationship || "").trim();
    const goal = String(req.body?.goal || "").trim();
    const imageBuffer = imageBufferFromDataUrl(req.body?.imageDataUrl);

    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: "服务器缺少 DEEPSEEK_API_KEY。" });
    }

    const worker = await getOcrWorker();
    const result = await worker.recognize(imageBuffer);
    const ocrText = String(result?.data?.text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (ocrText.replace(/\s/g, "").length < 6) {
      return res.status(422).json({
        error: "没能从截图中读到足够文字，请换一张更清晰的聊天截图，或直接粘贴文字。",
      });
    }

    const completion = await client.chat.completions.create({
      model,
      thinking: { type: "disabled" },
      messages: [
        {
          role: "system",
          content: "You interpret OCR text from Chinese chat screenshots. Return JSON only.",
        },
        {
          role: "user",
          content: buildContextPrompt({ ocrText, relationship, goal }),
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const parsed = extractJson(completion.choices?.[0]?.message?.content || "");
    const rawReplyContext = String(parsed.replyContext || "").trim();
    const ocrSummary = String(parsed.ocrSummary || "").trim();
    const replyContext = ocrSummary && rawReplyContext && !rawReplyContext.includes(ocrSummary)
      ? `聊天截图摘要：${ocrSummary}\n需要回复：${rawReplyContext}`
      : rawReplyContext || ocrSummary;

    res.json({
      replyContext,
      ocrSummary,
      analysis: parsed.analysis || {},
      suggestedGoal: String(parsed.suggestedGoal || "").trim(),
      confidence: String(parsed.confidence || "").trim(),
      ocrText,
      usage: completion.usage || null,
      model: completion.model || model,
    });
  } catch (error) {
    const message = error?.response?.data?.error?.message || error?.message || "截图解析失败。";
    res.status(500).json({
      error: message,
      hint: "请上传清晰的聊天截图，或先把对方消息粘贴到文本框。",
    });
  }
});

app.post("/api/generate-replies", async (req, res) => {
  try {
    const input = normalizePayload(req.body);

    if (!input.message) {
      return res.status(400).json({ error: "Please enter the original message." });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: "Missing DEEPSEEK_API_KEY on the server." });
    }

    const completion = await client.chat.completions.create({
      model,
      thinking: { type: "disabled" },
      messages: [
        {
          role: "system",
          content: "You are a careful Chinese reply generation agent. Return JSON only.",
        },
        {
          role: "user",
          content: buildPrompt(input),
        },
      ],
      temperature: 0.82,
      max_tokens: 2600,
      response_format: { type: "json_object" },
    });

    const parsed = extractJson(completion.choices?.[0]?.message?.content || "");
    const replies = Array.isArray(parsed.replies)
      ? parsed.replies.map((reply, index) => normalizeReply(reply, index, input.styles, input.goal)).filter((reply) => reply.text)
      : [];

    if (!replies.length) {
      throw new Error("The model did not generate usable replies.");
    }

    res.json({
      replies,
      analysis: parsed.analysis || {},
      usage: completion.usage || null,
      model: completion.model || model,
    });
  } catch (error) {
    const message = error?.response?.data?.error?.message || error?.message || "Generation failed.";
    res.status(500).json({
      error: message,
      hint: "Check the DeepSeek API key, balance, model name, and network connection.",
    });
  }
});

app.post("/api/refine-reply", async (req, res) => {
  try {
    const input = normalizePayload({ ...req.body, count: 3 });
    const seedReply = String(req.body?.reply || "").trim();

    if (!input.message || !seedReply) {
      return res.status(400).json({ error: "Missing original message or reply to refine." });
    }

    const completion = await client.chat.completions.create({
      model,
      thinking: { type: "disabled" },
      messages: [
        {
          role: "system",
          content: "You are a Chinese reply refinement agent. Return JSON only.",
        },
        {
          role: "user",
          content: buildPrompt(input, "refine", seedReply),
        },
      ],
      temperature: 0.76,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const parsed = extractJson(completion.choices?.[0]?.message?.content || "");
    const replies = Array.isArray(parsed.replies)
      ? parsed.replies.map((reply, index) => normalizeReply(reply, index, input.styles, input.goal)).filter((reply) => reply.text)
      : [];

    res.json({
      replies,
      analysis: parsed.analysis || {},
      usage: completion.usage || null,
      model: completion.model || model,
    });
  } catch (error) {
    const message = error?.response?.data?.error?.message || error?.message || "Refinement failed.";
    res.status(500).json({ error: message });
  }
});

if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, host, () => {
  console.log(`Reply Agent listening on http://${host}:${port}`);
});
