import dotenv from "dotenv";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

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

app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL,
});

const defaultStyles = ["\u6e29\u67d4", "\u9ad8\u60c5\u5546", "\u804c\u573a"];

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
9. For styles like Lu Xun style, Lin Daiyu style, Zhen Huan style, borrow only public cultural tone. Do not quote long original text.
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
