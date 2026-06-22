import {
  mapImportIndustry,
  mapImportSource,
  mapImportStage,
  normalizeArea,
  normalizeDateLike,
  normalizeImportBoolean,
  normalizeImportKey,
  normalizeImportText,
} from "./import-normalization";

export type WorkbookSheet = { name: string; rows: unknown[][] };

export type LeadPreviewRow = {
  title: string;
  companyName: string;
  spaceLocation?: string;
  desiredArea?: number | null;
  mainBusiness?: string;
  acquiredAt?: string | null;
  expectedLandingAt?: string | null;
  bottleneck?: string;
  sourceCode?: string | null;
  industryCode: string;
  financingFlag?: boolean;
  priorLocation?: string;
  stageCode: string;
  ownerName?: string;
  tags: string[];
  followupContent: string;
  sourceSheet: string;
  matchedSpaceText?: string;
};

export type SpacePreviewRow = {
  projectName: string;
  roomName: string;
  area: number | null;
  height?: string;
  loadBearing?: string;
  deliveryStatus?: string;
  propertyFee?: string;
  negotiatingCustomer?: string;
  sourceSheet: string;
};

export type ImportPreview = {
  leadRows: LeadPreviewRow[];
  spaceRows: SpacePreviewRow[];
  warnings: string[];
  stats: {
    leads: number;
    spaces: number;
    warnings: number;
  };
};

export type ImportPreviewOptions = {
  todayIso?: string;
};

export function detectSheetKind(sheetName: string): "lead-reserve" | "shortlist" | "space-control" | "event-leads" | "reference" {
  if (sheetName.includes("短期督办")) return "shortlist";
  if (sheetName.includes("客户储备")) return "lead-reserve";
  if (sheetName.includes("销控")) return "space-control";
  if (sheetName.includes("会招统计")) return "event-leads";
  return "reference";
}

export function findHeaderRow(rows: unknown[][], requiredHeader: string): number {
  return rows.findIndex((row) => row.some((cell) => normalizeImportText(cell) === requiredHeader));
}

function headerMap(headers: unknown[]): Record<string, number> {
  return Object.fromEntries(headers.map((header, index) => [normalizeImportText(header), index]).filter(([header]) => header));
}

function value(row: unknown[], indexes: Record<string, number>, ...names: string[]): string {
  for (const name of names) {
    const index = indexes[name];
    if (index !== undefined) return normalizeImportText(row[index]);
  }
  return "";
}

function appendNote(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => normalizeImportText(part)).filter(Boolean).join("\n");
}

function mergeTags(current: string[], extra: string[]): string[] {
  return [...new Set([...current, ...extra])];
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T00:00:00.000Z`);
  const to = Date.parse(`${toIso}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

function inferReserveStatusTags(row: {
  acquiredAt?: string | null;
  progress?: string;
  bottleneck?: string;
  lostReason?: string;
}, options: ImportPreviewOptions): string[] {
  const tags: string[] = [];
  const todayIso = options.todayIso || new Date().toISOString().slice(0, 10);
  if (row.acquiredAt) {
    const days = daysBetweenIso(row.acquiredAt, todayIso);
    if (days !== null && days >= 0 && days <= 14) tags.push("近两周新增");
  }

  const text = [row.progress, row.bottleneck, row.lostReason].map((part) => normalizeImportText(part)).join(" ");
  if (/已签约|签约完成|完成签约|已落地|已入驻/.test(text)) return mergeTags(tags, ["已签约"]);
  if (/流失|不考虑|无意向|原址续签|暂缓|无跟进价值|不推进/.test(text)) return mergeTags(tags, ["无跟进价值"]);
  if (/预计签约|推进签约|尽快签约|签约条件|商务条件|租赁合同|合同|签约/.test(text)) return mergeTags(tags, ["重点在签约"]);
  return tags;
}

function upsertLead(leads: Map<string, LeadPreviewRow>, row: LeadPreviewRow): void {
  const key = normalizeImportKey(row.companyName);
  const existing = leads.get(key);
  if (!existing) {
    leads.set(key, row);
    return;
  }
  existing.tags = mergeTags(existing.tags, row.tags);
  existing.followupContent = appendNote(existing.followupContent, row.followupContent);
  existing.bottleneck ||= row.bottleneck;
  existing.expectedLandingAt ||= row.expectedLandingAt;
  existing.acquiredAt ||= row.acquiredAt;
  existing.spaceLocation ||= row.spaceLocation;
  existing.desiredArea ||= row.desiredArea;
  existing.ownerName ||= row.ownerName;
}

function buildLeadFromReserve(sheetName: string, row: unknown[], indexes: Record<string, number>, options: ImportPreviewOptions): LeadPreviewRow | null {
  const companyName = value(row, indexes, "储备客户名称");
  if (!companyName || companyName.includes("*")) return null;
  const mainBusiness = value(row, indexes, "客户主营业务");
  const progress = value(row, indexes, "意向跟进阶段", "意向跟进阶段 / 督办任务");
  const bottleneck = value(row, indexes, "核心卡点");
  const lostReason = value(row, indexes, "流失原因");
  const acquired = normalizeDateLike(value(row, indexes, "获取意向时间"));
  const expected = normalizeDateLike(value(row, indexes, "预计落位时间"));
  const ownerName = sheetName.replace(/客户储备.*/, "").trim();
  const rawDateNote = appendNote(
    acquired.raw ? `获取意向时间：${acquired.raw}` : "",
    expected.raw ? `预计落位时间：${expected.raw}` : "",
  );

  return {
    title: companyName,
    companyName,
    spaceLocation: value(row, indexes, "空间位置"),
    desiredArea: normalizeArea(value(row, indexes, "面积/㎡", "面积")),
    mainBusiness,
    acquiredAt: acquired.iso,
    expectedLandingAt: expected.iso,
    bottleneck,
    sourceCode: mapImportSource(value(row, indexes, "渠道来源")),
    industryCode: mapImportIndustry(value(row, indexes, "所属行业"), mainBusiness),
    financingFlag: normalizeImportBoolean(value(row, indexes, "是否需要融资")),
    priorLocation: value(row, indexes, "原办公/生产场地所在地"),
    stageCode: mapImportStage(progress, bottleneck, lostReason),
    ownerName,
    tags: mergeTags(["客户储备"], inferReserveStatusTags({ acquiredAt: acquired.iso, progress, bottleneck, lostReason }, options)),
    followupContent: appendNote(`来源：${sheetName}`, progress, bottleneck ? `核心卡点：${bottleneck}` : "", rawDateNote),
    sourceSheet: sheetName,
  };
}

function buildLeadFromShortlist(sheetName: string, row: unknown[], indexes: Record<string, number>): LeadPreviewRow | null {
  const companyName = value(row, indexes, "储备客户名称");
  if (!companyName || companyName.includes("*")) return null;
  const task = value(row, indexes, "意向跟进阶段 / 督办任务", "意向跟进阶段");
  const bottleneck = value(row, indexes, "核心卡点");
  const expected = normalizeDateLike(value(row, indexes, "预计落位时间"));
  const lastUpdated = normalizeDateLike(value(row, indexes, "最后更新时间"));
  return {
    title: companyName,
    companyName,
    spaceLocation: value(row, indexes, "空间位置"),
    desiredArea: normalizeArea(value(row, indexes, "面积/㎡", "面积")),
    mainBusiness: value(row, indexes, "客户主营业务"),
    expectedLandingAt: expected.iso,
    bottleneck,
    sourceCode: mapImportSource(value(row, indexes, "渠道来源")),
    industryCode: mapImportIndustry(value(row, indexes, "所属行业"), value(row, indexes, "客户主营业务")),
    financingFlag: normalizeImportBoolean(value(row, indexes, "是否需要融资")),
    priorLocation: value(row, indexes, "原办公/生产场地所在地"),
    stageCode: mapImportStage(task, bottleneck),
    ownerName: value(row, indexes, "对接人"),
    tags: ["重点客户", "短期督办"],
    followupContent: appendNote(
      `来源：${sheetName}`,
      task,
      bottleneck ? `核心卡点：${bottleneck}` : "",
      lastUpdated.raw || lastUpdated.iso ? `最后更新时间：${lastUpdated.iso || lastUpdated.raw}` : "",
      expected.raw ? `预计落位时间：${expected.raw}` : "",
    ),
    sourceSheet: sheetName,
  };
}

function buildEventLeads(sheet: WorkbookSheet): LeadPreviewRow[] {
  const rows: LeadPreviewRow[] = [];
  let meetingTitle = "";
  let meetingMeta = "";
  let headers: Record<string, number> | null = null;
  for (const row of sheet.rows) {
    const first = normalizeImportText(row[0]);
    const second = normalizeImportText(row[1]);
    if (/^\d+$/.test(first) && second && row.filter((cell) => normalizeImportText(cell)).length <= 2) {
      meetingTitle = second;
      headers = null;
      continue;
    }
    if (first === "会议时间") {
      meetingMeta = `会议时间：${second}；会议地点：${normalizeImportText(row[3])}`;
      continue;
    }
    if (row.some((cell) => normalizeImportText(cell) === "项目/公司名称")) {
      headers = headerMap(row);
      continue;
    }
    if (!headers) continue;
    const companyName = value(row, headers, "项目/公司名称");
    if (!companyName || companyName.includes("*") || companyName === "项目/公司名称") continue;
    const mainBusiness = value(row, headers, "项目简介");
    const demand = value(row, headers, "企业需求");
    const followup = value(row, headers, "跟进情况");
    rows.push({
      title: companyName,
      companyName,
      mainBusiness,
      sourceCode: "activity",
      industryCode: mapImportIndustry(mainBusiness, demand),
      stageCode: mapImportStage(followup, demand),
      ownerName: value(row, headers, "对接人"),
      tags: ["会招"],
      followupContent: appendNote(`来源：${sheet.name}`, meetingTitle, meetingMeta, demand ? `客户需求：${demand}` : "", followup),
      sourceSheet: sheet.name,
    });
  }
  return rows;
}

function buildSpaces(sheet: WorkbookSheet): SpacePreviewRow[] {
  const headerIndex = findHeaderRow(sheet.rows, "房间号");
  if (headerIndex < 0) return [];
  const indexes = headerMap(sheet.rows[headerIndex]);
  const projectName = sheet.name.replace(/销控.*/, "");
  return sheet.rows.slice(headerIndex + 1).map((row) => {
    const roomName = value(row, indexes, "房间号");
    if (!roomName) return null;
    return {
      projectName,
      roomName,
      negotiatingCustomer: value(row, indexes, "在谈客户"),
      area: normalizeArea(value(row, indexes, "面积/㎡", "面积")),
      height: value(row, indexes, "层高/m", "层高"),
      loadBearing: value(row, indexes, "承重/㎏/㎡", "承重"),
      deliveryStatus: value(row, indexes, "交付状态"),
      propertyFee: value(row, indexes, "物业费"),
      sourceSheet: sheet.name,
    } satisfies SpacePreviewRow;
  }).filter(Boolean) as SpacePreviewRow[];
}

export function buildWorkbookImportPreview(workbook: { sheets: WorkbookSheet[] }, options: ImportPreviewOptions = {}): ImportPreview {
  const leads = new Map<string, LeadPreviewRow>();
  const spaceRows: SpacePreviewRow[] = [];
  const warnings: string[] = [];

  for (const sheet of workbook.sheets) {
    const kind = detectSheetKind(sheet.name);
    if (kind === "lead-reserve") {
      const headerIndex = findHeaderRow(sheet.rows, "储备客户名称");
      if (headerIndex < 0) {
        warnings.push(`${sheet.name} 未找到客户储备表头`);
        continue;
      }
      const indexes = headerMap(sheet.rows[headerIndex]);
      sheet.rows.slice(headerIndex + 1).map((row) => buildLeadFromReserve(sheet.name, row, indexes, options)).filter(Boolean).forEach((row) => upsertLead(leads, row as LeadPreviewRow));
    } else if (kind === "shortlist") {
      const headerIndex = findHeaderRow(sheet.rows, "储备客户名称");
      if (headerIndex < 0) {
        warnings.push(`${sheet.name} 未找到短期督办表头`);
        continue;
      }
      const indexes = headerMap(sheet.rows[headerIndex]);
      sheet.rows.slice(headerIndex + 1).map((row) => buildLeadFromShortlist(sheet.name, row, indexes)).filter(Boolean).forEach((row) => upsertLead(leads, row as LeadPreviewRow));
    } else if (kind === "event-leads") {
      buildEventLeads(sheet).forEach((row) => upsertLead(leads, row));
    } else if (kind === "space-control") {
      spaceRows.push(...buildSpaces(sheet));
    }
  }

  const leadRows = [...leads.values()];
  return {
    leadRows,
    spaceRows,
    warnings,
    stats: { leads: leadRows.length, spaces: spaceRows.length, warnings: warnings.length },
  };
}
