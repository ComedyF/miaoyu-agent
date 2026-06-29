import {
  Bot,
  Bookmark,
  Brain,
  Check,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  Heart,
  ImageUp,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";

type Analysis = {
  scene?: string;
  intent?: string;
  risk?: {
    emotionRisk?: string;
    sensitiveContent?: string;
    suggestion?: string;
  };
};

type Reply = {
  id: string;
  style: string;
  tags: string[];
  text: string;
  suitableFor: string;
  rationale: string;
  wordCount: number;
  favorite: boolean;
};

type Preset = {
  id: string;
  name: string;
  styles: string[];
  goal: string;
};

type ScreenshotResult = {
  replyContext: string;
  ocrSummary?: string;
  analysis?: Analysis;
  suggestedGoal?: string;
  confidence?: string;
};

type ReplyRequest = {
  message: string;
  relationship: string;
  goal: string;
  intensity: number;
  styles: string[];
  count: number;
};

const relationships = [
  "同事 / 工作伙伴",
  "朋友",
  "家人",
  "客户",
  "恋人 / 暧昧对象",
  "陌生人",
  "上级 / 下属",
];

const goals = [
  "安慰鼓励 + 提供支持",
  "礼貌拒绝",
  "真诚道歉",
  "催促推进",
  "解释说明",
  "表达边界",
  "缓和冲突",
  "邀约试探",
  "确认信息",
];

const replyStyles = [
  "温柔",
  "坚定",
  "幽默",
  "高情商",
  "职场",
  "鲁迅版",
  "林黛玉版",
  "甄嬛体",
  "霸总不油",
  "阴阳怪气安全版",
];

const styleTone: Record<string, { accent: string; bg: string; text: string }> = {
  温柔: { accent: "#63d5bf", bg: "#e7faf5", text: "#048a77" },
  坚定: { accent: "#6a9af8", bg: "#eaf1ff", text: "#2563eb" },
  幽默: { accent: "#ffbe45", bg: "#fff4dc", text: "#a15c00" },
  高情商: { accent: "#a88cf6", bg: "#f3eeff", text: "#7c3aed" },
  职场: { accent: "#4fc3d9", bg: "#e8f8fc", text: "#0e7490" },
  鲁迅版: { accent: "#1f2937", bg: "#edf0f3", text: "#111827" },
  林黛玉版: { accent: "#e88ab5", bg: "#fff0f6", text: "#be477e" },
  甄嬛体: { accent: "#b88a3c", bg: "#fbf0d8", text: "#91631b" },
  霸总不油: { accent: "#2f6f6d", bg: "#e6f4f3", text: "#0f5f5c" },
  阴阳怪气安全版: { accent: "#f97316", bg: "#fff1e7", text: "#c2410c" },
};

const initialReplies: Reply[] = [
  {
    id: "sample-1",
    style: "温柔",
    tags: ["安慰", "支持"],
    text: "辛苦你了，看到你这么忙我也挺心疼的。先照顾好自己，能休息的时候就别硬撑，需要我帮忙的地方随时说。",
    suitableFor: "适合关系友好、想表达关心时直接发送。",
    rationale: "先承接情绪，再给出支持，不急着讲道理。",
    wordCount: 50,
    favorite: false,
  },
  {
    id: "sample-2",
    style: "职场",
    tags: ["专业", "协作"],
    text: "理解你最近压力比较大。如果方便的话，我们可以一起把优先级梳理一下，先处理最关键的部分，其他事情再分步推进。",
    suitableFor: "适合同事、合作伙伴或上下级沟通。",
    rationale: "既表达理解，也给出可执行支持。",
    wordCount: 53,
    favorite: false,
  },
  {
    id: "sample-3",
    style: "幽默",
    tags: ["缓和", "轻松"],
    text: "救火队员也得充电呀。今晚先给自己留点休息时间，不然系统真的要弹出“电量不足”的提醒了。",
    suitableFor: "适合熟人之间，需要把气氛放松一点。",
    rationale: "用轻松比喻降低压力，再自然表达关心。",
    wordCount: 43,
    favorite: false,
  },
];

const defaultPresets: Preset[] = [
  { id: "preset-1", name: "安慰鼓励（温柔 + 幽默）", styles: ["温柔", "幽默"], goal: "安慰鼓励 + 提供支持" },
  { id: "preset-2", name: "职场沟通（职场 + 高情商）", styles: ["职场", "高情商"], goal: "确认信息" },
  { id: "preset-3", name: "清晰边界（坚定 + 高情商）", styles: ["坚定", "高情商"], goal: "表达边界" },
];

function wordCount(text: string) {
  return text.replace(/\s/g, "").length;
}

function classNames(...items: Array<string | false | undefined>) {
  return items.filter(Boolean).join(" ");
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.hint ? `${data.error || "请求失败"} ${data.hint}` : data?.error || "请求失败");
  }
  return data as T;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

async function compressImageForUpload(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("图片处理失败");
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function App() {
  const [message, setMessage] = useState("最近工作好忙，感觉每天都在救火，都没时间好好休息，真的有点累了。");
  const [relationship, setRelationship] = useState(relationships[0]);
  const [goal, setGoal] = useState(goals[0]);
  const [intensity, setIntensity] = useState(38);
  const [selectedStyles, setSelectedStyles] = useState(["温柔", "职场"]);
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [analysis, setAnalysis] = useState<Analysis>({
    scene: "检测到职场压力场景",
    intent: "表达疲惫，寻求理解与支持",
    risk: {
      emotionRisk: "低",
      sensitiveContent: "无",
      suggestion: "安慰 + 支持",
    },
  });
  const [sortMode, setSortMode] = useState("推荐优先");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageSummary, setImageSummary] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [presets, setPresets] = useState(defaultPresets);

  const sortedReplies = useMemo(() => {
    const copy = [...replies];
    if (sortMode === "更短") {
      return copy.sort((a, b) => a.wordCount - b.wordCount);
    }
    if (sortMode === "更长") {
      return copy.sort((a, b) => b.wordCount - a.wordCount);
    }
    if (sortMode === "收藏优先") {
      return copy.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    }
    return copy;
  }, [replies, sortMode]);

  const timeline = useMemo(
    () => [
      {
        title: "场景识别",
        status: loading || imageLoading ? "分析中" : "完成",
        icon: Brain,
        detail: [analysis.scene || "等待识别输入内容", `当前文本：${message.slice(0, 24).replace(/\s/g, "、") || "暂无"}`],
      },
      {
        title: "意图分析",
        status: loading || imageLoading ? "分析中" : "完成",
        icon: Zap,
        detail: [analysis.intent || "等待判断回复目标", `回复目标：${goal}`],
      },
      {
        title: "风险检查",
        status: loading || imageLoading ? "检查中" : "完成",
        icon: ShieldCheck,
        detail: [
          `情绪风险：${analysis.risk?.emotionRisk || "低"}`,
          `敏感内容：${analysis.risk?.sensitiveContent || "无"}`,
          `建议方向：${analysis.risk?.suggestion || goal}`,
        ],
      },
      {
        title: "风格生成",
        status: loading ? "进行中" : "完成",
        icon: Wand2,
        detail: selectedStyles,
        chips: true,
      },
    ],
    [analysis, goal, imageLoading, loading, message, selectedStyles],
  );

  function toggleStyle(style: string) {
    setSelectedStyles((current) => {
      if (current.includes(style)) {
        return current.length === 1 ? current : current.filter((item) => item !== style);
      }
      return [...current, style];
    });
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setError("");
    setImageSummary("");
    setImageLoading(true);
    try {
      const imageDataUrl = await compressImageForUpload(file);
      setImagePreview(imageDataUrl);
      const data = await postJson<ScreenshotResult>("/api/extract-chat-context", {
        imageDataUrl,
        relationship,
        goal,
      });
      const nextMessage = data.replyContext.trim();
      const nextGoal = data.suggestedGoal && goals.includes(data.suggestedGoal) ? data.suggestedGoal : goal;

      if (!nextMessage) {
        throw new Error("截图已读取，但没有提取到可用于回复的聊天上下文。");
      }

      setMessage(nextMessage);
      if (nextGoal !== goal) {
        setGoal(nextGoal);
      }
      if (data.replyContext) {
        setImageSummary(data.ocrSummary ? `${data.ocrSummary} 正在生成回复。` : "已从截图中提取聊天上下文，正在生成回复。");
      }
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
      await generateReplies({
        message: nextMessage,
        goal: nextGoal,
      });
      setImageSummary(data.ocrSummary || "已从截图中提取聊天上下文并生成回复。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "截图识别失败");
    } finally {
      setImageLoading(false);
    }
  }

  async function generateReplies(overrides: Partial<ReplyRequest> = {}) {
    const payload: ReplyRequest = {
      message: overrides.message ?? message,
      relationship: overrides.relationship ?? relationship,
      goal: overrides.goal ?? goal,
      intensity: overrides.intensity ?? intensity,
      styles: overrides.styles ?? selectedStyles,
      count: overrides.count ?? 10,
    };

    if (!payload.message.trim()) {
      return false;
    }

    setError("");
    setLoading(true);
    try {
      const data = await postJson<{ replies: Reply[]; analysis: Analysis }>("/api/generate-replies", payload);
      setReplies(data.replies);
      setAnalysis(data.analysis || {});
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function refineReply(reply: Reply) {
    setError("");
    setRefiningId(reply.id);
    try {
      const data = await postJson<{ replies: Reply[]; analysis: Analysis }>("/api/refine-reply", {
        message,
        relationship,
        goal,
        intensity,
        styles: [reply.style],
        reply: reply.text,
      });
      const refined = data.replies[0];
      if (refined) {
        setReplies((current) => current.map((item) => (item.id === reply.id ? { ...refined, id: reply.id, favorite: item.favorite } : item)));
      }
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "润色失败");
    } finally {
      setRefiningId(null);
    }
  }

  async function copyReply(reply: Reply) {
    try {
      await navigator.clipboard.writeText(reply.text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = reply.text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedId(reply.id);
    window.setTimeout(() => setCopiedId(null), 1300);
  }

  function toggleFavorite(replyId: string) {
    setReplies((current) => current.map((reply) => (reply.id === replyId ? { ...reply, favorite: !reply.favorite } : reply)));
  }

  function applyPreset(preset: Preset) {
    setSelectedStyles(preset.styles);
    setGoal(preset.goal);
  }

  function addPreset() {
    const name = `${goal}（${selectedStyles.join(" + ")}）`;
    setPresets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        styles: selectedStyles,
        goal,
      },
    ]);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={24} strokeWidth={2.4} />
          </div>
          <div>
            <h1>妙语Agent</h1>
            <p>输入文字或聊天截图，生成得体回复</p>
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside className="control-panel" aria-label="回复配置">
          <StepTitle number={1} title="输入消息 / 上传截图" count={`${wordCount(message)}/800`} color="coral" />
          <label className={classNames("upload-box", imageLoading && "loading")}>
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImageUpload} disabled={imageLoading} />
            {imageLoading ? <Loader2 size={20} className="spin" /> : <ImageUp size={20} />}
            <span>{imageLoading ? "正在解读聊天截图" : "上传聊天记录截图"}</span>
          </label>
          {imagePreview && (
            <div className="image-context">
              <img src={imagePreview} alt="聊天截图预览" />
              <p>{imageSummary || "截图已上传，等待解读。"}</p>
            </div>
          )}
          <div className="textarea-wrap">
            <textarea
              value={message}
              maxLength={800}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="把对方发来的话粘贴在这里，或上传聊天截图自动填充上下文。"
            />
            <div className="textarea-tools">
              <button type="button" onClick={() => setMessage("")}>
                <Trash2 size={15} />
                清空
              </button>
            </div>
          </div>

          <StepTitle number={2} title="选择关系" color="blue" />
          <Select value={relationship} options={relationships} onChange={setRelationship} />

          <StepTitle number={3} title="回复目标" color="coral" />
          <Select value={goal} options={goals} onChange={setGoal} />

          <StepTitle number={4} title="语气强度" color="coral" />
          <div className="range-card">
            <input value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} type="range" min="0" max="100" />
            <div className="range-labels">
              <span>柔和</span>
              <span>适中</span>
              <span>较强</span>
              <span>强烈</span>
            </div>
          </div>

          <StepTitle number={5} title="选择回复风格" helper="（可多选）" color="blue" />
          <div className="style-grid">
            {replyStyles.map((style) => (
              <button
                key={style}
                className={classNames("style-chip", selectedStyles.includes(style) && "selected")}
                type="button"
                onClick={() => toggleStyle(style)}
              >
                {style}
              </button>
            ))}
          </div>

          <button className="generate-button" type="button" onClick={() => void generateReplies()} disabled={loading || imageLoading || !message.trim()}>
            {loading ? <Loader2 size={20} className="spin" /> : <Sparkles size={20} />}
            {loading ? "生成中" : "生成回复"}
          </button>
          {error && <p className="error-message">{error}</p>}
        </aside>

        <section className="result-panel" aria-label="生成结果">
          <div className="result-header">
            <div className="title-line">
              <Sparkles size={20} />
              <h2>为你生成 {sortedReplies.length} 条回复</h2>
            </div>
            <label className="sort-select">
              排序：
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                <option>推荐优先</option>
                <option>更短</option>
                <option>更长</option>
                <option>收藏优先</option>
              </select>
            </label>
          </div>

          <div className="reply-list">
            {sortedReplies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                copied={copiedId === reply.id}
                refining={refiningId === reply.id}
                onCopy={() => copyReply(reply)}
                onFavorite={() => toggleFavorite(reply.id)}
                onRefine={() => refineReply(reply)}
              />
            ))}
          </div>
        </section>

        <aside className="agent-panel" aria-label="Agent 思考过程">
          <div className="panel-title">
            <Bot size={19} />
            <h2>Agent 思考过程</h2>
          </div>

          <div className="timeline">
            {timeline.map((item, index) => {
              const Icon = item.icon;
              return (
                <div className="timeline-item" key={item.title}>
                  <div className={classNames("timeline-dot", (loading || imageLoading) && index > 2 && "pending")}>
                    {(loading || imageLoading) && index === 3 ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-head">
                      <div>
                        <Icon size={16} />
                        <strong>{item.title}</strong>
                      </div>
                      <span>{item.status}</span>
                    </div>
                    {item.chips ? (
                      <div className="mini-chip-row">
                        {item.detail.map((detail) => (
                          <span key={detail}>{detail}</span>
                        ))}
                      </div>
                    ) : (
                      item.detail.map((detail) => <p key={detail}>{detail}</p>)
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="preset-panel">
            <div className="preset-header">
              <strong>我的预设</strong>
            </div>
            <div className="preset-list">
              {presets.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>
                  <span>{preset.name}</span>
                  <Bookmark size={16} />
                </button>
              ))}
            </div>
            <button className="new-preset" type="button" onClick={addPreset}>
              <Plus size={16} />
              新建预设
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

function StepTitle({ number, title, helper, count, color }: { number: number; title: string; helper?: string; count?: string; color: "coral" | "blue" }) {
  return (
    <div className="step-title">
      <div className={classNames("step-badge", color)}>{number}</div>
      <strong>{title}</strong>
      {helper && <span>{helper}</span>}
      {count && <em>{count}</em>}
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="select-wrap">
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown size={18} />
    </div>
  );
}

function ReplyCard({
  reply,
  copied,
  refining,
  onCopy,
  onFavorite,
  onRefine,
}: {
  reply: Reply;
  copied: boolean;
  refining: boolean;
  onCopy: () => void;
  onFavorite: () => void;
  onRefine: () => void;
}) {
  const tone = styleTone[reply.style] || styleTone.高情商;
  return (
    <article className="reply-card" style={{ "--accent": tone.accent } as CSSProperties}>
      <div className="tag-row">
        <span className="primary-tag" style={{ background: tone.bg, color: tone.text }}>
          {reply.style}
        </span>
        {reply.tags.slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <p className="reply-text">{reply.text}</p>
      <p className="reply-rationale">{reply.suitableFor}</p>
      <div className="reply-footer">
        <span>字数 {reply.wordCount}</span>
        <div className="reply-actions">
          <button type="button" onClick={onCopy}>
            {copied ? <ClipboardCheck size={17} /> : <Clipboard size={17} />}
            {copied ? "已复制" : "复制"}
          </button>
          <button type="button" onClick={onRefine} disabled={refining}>
            {refining ? <Loader2 size={17} className="spin" /> : <Wand2 size={17} />}
            润色
          </button>
          <button type="button" onClick={onFavorite}>
            {reply.favorite ? <Star size={17} fill="currentColor" /> : <Heart size={17} />}
            {reply.favorite ? "已收藏" : "收藏"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default App;
