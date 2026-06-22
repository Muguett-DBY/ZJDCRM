export type ImportStageCode =
  | "new"
  | "initial_contact"
  | "site_visit"
  | "signed"
  | "landed"
  | "lost";

export type ImportSourceCode = "activity" | "referral" | "gov" | "visit" | null;

export type ImportIndustryCode =
  | "medical_devices"
  | "pharma"
  | "ai"
  | "integrated_circuit"
  | "smart_manufacturing"
  | "other";

export function normalizeImportText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeImportKey(value: unknown): string {
  return normalizeImportText(value)
    .toLowerCase()
    .replace(/[（）()【】\s[\]]/g, "")
    .replace(/有限责任公司|股份有限公司|有限公司|科技公司|公司/g, "");
}

export function excelSerialDateToIso(value: unknown): string | null {
  const serial = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(serial) || serial < 1) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function normalizeDateLike(value: unknown): { iso: string | null; raw: string } {
  const text = normalizeImportText(value);
  if (!text) return { iso: null, raw: "" };

  const serial = excelSerialDateToIso(text);
  if (serial) return { iso: serial, raw: "" };

  const normalized = text
    .replace(/[年/.]/g, "-")
    .replace(/[月]/g, "-")
    .replace(/[日号]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return {
      iso: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      raw: "",
    };
  }
  return { iso: null, raw: text };
}

export function normalizeArea(value: unknown): number | null {
  const text = normalizeImportText(value);
  if (!text || text.includes("暂无") || text.includes("*")) return null;
  const range = text.match(/(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    let start = Number(range[1]);
    const end = Number(range[2]);
    if (start < 10 && end >= 1000) start *= 1000;
    return (start + end) / 2;
  }
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function normalizeImportBoolean(value: unknown): boolean {
  const text = normalizeImportText(value);
  return /是|有|需要|融资/.test(text) && !/否|不需要|无需/.test(text);
}

export function mapImportSource(value: unknown): ImportSourceCode {
  const text = normalizeImportText(value);
  if (!text) return null;
  if (/政府|经信|投促|管委/.test(text)) return "gov";
  if (/中介|渠道|推荐/.test(text)) return "referral";
  if (/自拓|拜访|自有资源|扩租/.test(text)) return "visit";
  if (/基金|活动|大赛|会议|会招/.test(text)) return "activity";
  return null;
}

export function mapImportIndustry(...values: unknown[]): ImportIndustryCode {
  const text = normalizeImportText(values.filter(Boolean).join(" "));
  if (/医疗器械|三类|二类|神经介入|内窥镜|骨科|体外诊断|康复|耗材|血压/.test(text)) return "medical_devices";
  if (/医药|创新药|合成生物|基因|测序|生物|中药|细胞|药/.test(text)) return "pharma";
  if (/人工智能|AI|脑机|大模型|智能算法/.test(text)) return "ai";
  if (/芯片|集成电路|半导体|硅基|光电|算力/.test(text)) return "integrated_circuit";
  if (/智能制造|先进制造|机器人|装备|设备|无人机|风电|新能源|电池|检测/.test(text)) return "smart_manufacturing";
  return "other";
}

export function mapImportStage(...values: unknown[]): ImportStageCode {
  const text = normalizeImportText(values.filter(Boolean).join(" "));
  if (/流失|原址续签|不考虑|取消|暂停|无跟进价值/.test(text)) return "lost";
  if (/落地|已注册/.test(text)) return "landed";
  if (/签约|合同|租赁合同/.test(text)) return "signed";
  if (/带看|考察|看场地|现场|参观/.test(text)) return "site_visit";
  if (/拜访|来访|沟通|见面|接触|约访/.test(text)) return "initial_contact";
  return "new";
}
