import { describe, expect, it } from "vitest";
import { buildWorkbookImportPreview, detectSheetKind, findHeaderRow } from "../../shared/xlsx-import-preview";

describe("xlsx workbook import preview", () => {
  it("detects supported sheet kinds", () => {
    expect(detectSheetKind("短期督办计划")).toBe("shortlist");
    expect(detectSheetKind("杨怡喆客户储备")).toBe("lead-reserve");
    expect(detectSheetKind("器械城一期销控")).toBe("space-control");
    expect(detectSheetKind("会招统计")).toBe("event-leads");
    expect(detectSheetKind("渠道名单")).toBe("reference");
  });

  it("finds the row containing user workbook headers", () => {
    expect(findHeaderRow([
      ["", "近两周新增"],
      ["序号", "空间位置", "面积/㎡", "储备客户名称"],
    ], "储备客户名称")).toBe(1);
  });

  it("merges shortlist rows into existing reserve leads by company", () => {
    const preview = buildWorkbookImportPreview({
      sheets: [
        {
          name: "杨怡喆客户储备",
          rows: [
            ["序号", "空间位置", "面积/㎡", "储备客户名称", "客户主营业务", "获取意向时间", "预计落位时间", "意向跟进阶段", "核心卡点", "渠道来源", "所属行业", "是否需要融资", "原办公/生产场地所在地"],
            ["1", "器械城一期", "200", "铜芯科技", "芯片加工", "2026.6.1", "2026.7", "已拜访", "用电", "自拓", "集成电路", "否", "昌平"],
          ],
        },
        {
          name: "短期督办计划",
          rows: [
            ["序号", "对接人", "最后更新时间", "空间位置", "面积/㎡", "储备客户名称", "客户主营业务", "获取意向时间", "预计落位时间", "核心卡点", "意向跟进阶段 / 督办任务"],
            ["1", "杨怡喆", "46170", "精准园", "14500", "铜芯科技", "芯片加工", "", "46266", "用电", "落实签约商务条件"],
          ],
        },
      ],
    });

    expect(preview.leadRows).toHaveLength(1);
    expect(preview.leadRows[0]).toMatchObject({
      companyName: "铜芯科技",
      industryCode: "integrated_circuit",
      ownerName: "杨怡喆",
    });
    expect(preview.leadRows[0].tags).toEqual(expect.arrayContaining(["客户储备", "重点客户", "短期督办"]));
    expect(preview.leadRows[0].followupContent).toContain("落实签约商务条件");
  });

  it("infers reserve status tags from customer reserve rows", () => {
    const preview = buildWorkbookImportPreview({
      sheets: [
        {
          name: "杨怡喆客户储备",
          rows: [
            ["序号", "空间位置", "面积/㎡", "储备客户名称", "客户主营业务", "获取意向时间", "预计落位时间", "意向跟进阶段", "核心卡点", "渠道来源", "所属行业", "是否需要融资", "原办公/生产场地所在地", "流失原因"],
            ["1", "器械城一期", "200", "新增科技", "医疗器械", "2026-06-15", "2026-07", "已拜访", "", "自拓", "医疗器械", "否", "昌平", ""],
            ["2", "器械城一期", "300", "签约推进科技", "芯片加工", "2026-04-01", "2026-07", "正在推进签约商务条件", "", "自拓", "集成电路", "否", "昌平", ""],
            ["3", "器械城一期", "400", "无价值科技", "普通咨询", "2026-03-01", "", "客户不考虑搬迁", "", "自拓", "其他", "否", "昌平", "无意向"],
            ["4", "器械城一期", "500", "已签约科技", "医药研发", "2026-02-01", "", "已签约，等待入驻", "", "自拓", "医药健康", "否", "昌平", ""],
          ],
        },
      ],
    }, { todayIso: "2026-06-22" });

    const byCompany = Object.fromEntries(preview.leadRows.map((row) => [row.companyName, row.tags]));
    expect(byCompany["新增科技"]).toEqual(expect.arrayContaining(["客户储备", "近两周新增"]));
    expect(byCompany["签约推进科技"]).toEqual(expect.arrayContaining(["客户储备", "重点在签约"]));
    expect(byCompany["无价值科技"]).toEqual(expect.arrayContaining(["客户储备", "无跟进价值"]));
    expect(byCompany["已签约科技"]).toEqual(expect.arrayContaining(["客户储备", "已签约"]));
  });
});
