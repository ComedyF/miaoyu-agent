import {
  Bot,
  Bookmark,
  Brain,
  Check,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  Clock3,
  Heart,
  Loader2,
  Mic2,
  Plus,
  SendHorizontal,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

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
    tags: ["安慰鼓励", "提供支持"],
    text: "辛苦你了，看到你这么拼我很心疼。记得照顾好自己，劳逸结合才能走得更远呀。如果需要帮忙，随时告诉我！",
    suitableFor: "适合关系友好、想表达关心时直接发送。",
    rationale: "先承接情绪，再给出支持，不急着讲道理。",
    wordCount: 46,
    favorite: false,
  },
  {
    id: "sample-2",
    style: "坚定",
    tags: ["鼓励支持", "积极正向"],
    text: "你已经做得很好了，忙是暂时的，成长是长期的。稳住节奏，一步一步来，难关都会过去的。",
    suitableFor: "适合对方需要被肯定，也需要一点力量感。",
    rationale: "表达相信和肯定，避免空泛安慰。",
    wordCount: 40,
    favorite: false,
  },
  {
    id: "sample-3",
    style: "幽默",
    tags: ["轻松化解", "缓解压力"],
    text: "救火队员也需要充电呀。记得给自己放个小假，不然系统会提示“电量不足”啦。要不要今晚一起去吃顿好的？",
    suitableFor: "适合熟人之间，需要把气氛放松一点。",
    rationale: "用轻松比喻降低压力，再给出具体陪伴。",
    wordCount: 50,
    favorite: false,
  },
  {
    id: "sample-4",
    style: "高情商",
    tags: ["共情理解", "积极建议"],
    text: "能感受到你的压力，这段时间确实不容易。辛苦之余也别忘了给自己一些喘息的空间，我相信你一定能顺利度过这段时期。",
    suitableFor: "适合不确定亲疏时，既体面又真诚。",
    rationale: "避免评判，只做理解、提醒和支持。",
    wordCount: 55,
    favorite: false,
  },
  {
    id: "sample-5",
    style: "职场",
    tags: ["专业沟通", "务实建议"],
    text: "理解你目前的工作节奏，建议可以先梳理优先级，聚焦关键任务，适当授权和协作，能有效减轻负担。需要的话我也可以配合。",
    suitableFor: "适合同事、合作伙伴或上下级沟通。",
    rationale: "专业但不冷淡，补充可执行支持。",
    wordCount: 66,
    favorite: false,
  },
];

const defaultPresets: Preset[] = [
  { id: "preset-1", name: "安慰鼓励（温柔 + 幽默）", styles: ["温柔", "幽默"], goal: "安慰鼓励 + 提供支持" },
  { id: "preset-2", name: "职场沟通（职场 + 高情商）", styles: ["职场", "高情商"], goal: "安慰鼓励 + 提供支持" },
  { id: "preset-3", name: "直接回应（坚定 + 简洁）", styles: ["坚定"], goal: "表达边界" },
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
    throw new Error(data?.error || "请求失败");
  }
  return data as T;
}

function App() {
  const [message, setMessage] = useState("最近工作好忙，感觉每天都在救火，\n都没时间好好休息，真的有点累了。");
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

  const generatedCount = sortedReplies.length || selectedStyles.length;

  const timeline = useMemo(
    () => [
      {
        title: "场景识别",
        status: loading ? "分析中" : "完成",
        icon: Brain,
        detail: [analysis.scene || "等待识别输入消息的场景", `关键词：${message.slice(0, 22).replace(/\s/g, "、") || "暂无"}`],
      },
      {
        title: "意图分析",
        status: loading ? "分析中" : "完成",
        icon: Zap,
        detail: [analysis.intent || "等待判断用户真正想达成的回复目标", `当前目标：${goal}`],
      },
      {
        title: "风险检查",
        status: loading ? "检查中" : "完成",
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
      {
        title: "结果排序",
        status: loading ? "待处理" : "完成",
        icon: Star,
        detail: [`当前排序：${sortMode}`],
      },
    ],
    [analysis, goal, loading, message, selectedStyles, sortMode],
  );

  function toggleStyle(style: string) {
    setSelectedStyles((current) => {
      if (current.includes(style)) {
        return current.length === 1 ? current : current.filter((item) => item !== style);
      }
      return [...current, style];
    });
  }

  async function generateReplies() {
    setError("");
    setLoading(true);
    try {
      const data = await postJson<{ replies: Reply[]; analysis: Analysis }>("/api/generate-replies", {
        message,
        relationship,
        goal,
        intensity,
        styles: selectedStyles,
        count: 10,
      });
      setReplies(data.replies);
      setAnalysis(data.analysis || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
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
            <p>让每一次回复，都更得体</p>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="主导航">
          <button className="active">对话回复</button>
          <button>润色改写</button>
          <button>总结提炼</button>
          <button>智能问答</button>
        </nav>

        <div className="top-actions">
          <button>
            <Clock3 size={18} />
            历史记录
          </button>
          <button>
            <Bookmark size={18} />
            收藏夹
          </button>
          <button className="avatar">Y</button>
          <ChevronDown size={16} />
        </div>
      </header>

      <main className="workspace">
        <aside className="control-panel" aria-label="回复配置">
          <StepTitle number={1} title="输入对方的消息" count={`${wordCount(message)}/500`} color="coral" />
          <div className="textarea-wrap">
            <textarea
              value={message}
              maxLength={500}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="把对方发来的话贴在这里..."
            />
            <div className="textarea-tools">
              <button type="button" onClick={() => setMessage("")}>
                清空
              </button>
              <Mic2 size={17} />
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
            <button className="style-chip ghost" type="button">
              <Plus size={14} />
              自定义
            </button>
          </div>

          <div className="generate-row">
            <button className="generate-button" type="button" onClick={generateReplies} disabled={loading || !message.trim()}>
              {loading ? <Loader2 size={20} className="spin" /> : <Sparkles size={20} />}
              {loading ? "生成中" : "生成回复"}
            </button>
            <button className="icon-button" type="button" aria-label="高级设置">
              <Settings2 size={21} />
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </aside>

        <section className="result-panel" aria-label="生成结果">
          <div className="result-header">
            <div className="title-line">
              <Sparkles size={20} />
              <h2>为你生成 {generatedCount} 条回复</h2>
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
                  <div className={classNames("timeline-dot", loading && index > 2 && "pending")}>
                    {loading && index === 3 ? <Loader2 size={15} className="spin" /> : index < 4 || !loading ? <Check size={15} /> : <span>{index + 1}</span>}
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
              <button type="button">管理</button>
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
  const tone = styleTone[reply.style] || styleTone["高情商"];
  return (
    <article className="reply-card" style={{ "--accent": tone.accent } as React.CSSProperties}>
      <button className={classNames("favorite-star", reply.favorite && "active")} type="button" onClick={onFavorite} aria-label="收藏">
        <Star size={21} />
      </button>
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
            <Heart size={17} fill={reply.favorite ? "currentColor" : "none"} />
            收藏
          </button>
          <button type="button">
            <SendHorizontal size={17} />
            发送感
          </button>
        </div>
      </div>
    </article>
  );
}

export default App;
