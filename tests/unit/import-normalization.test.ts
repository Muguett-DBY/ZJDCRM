import { describe, expect, it } from "vitest";
import {
  excelSerialDateToIso,
  mapImportIndustry,
  mapImportSource,
  mapImportStage,
  normalizeArea,
  normalizeImportBoolean,
} from "../../shared/import-normalization";

describe("import normalization helpers", () => {
  it("maps industry terms to configured dictionary codes", () => {
    expect(mapImportIndustry("芯片加工")).toBe("integrated_circuit");
    expect(mapImportIndustry("三类神经介入医疗器械")).toBe("medical_devices");
    expect(mapImportIndustry("合成生物研发")).toBe("pharma");
    expect(mapImportIndustry("脑机接口设备")).toBe("ai");
    expect(mapImportIndustry("机器人制造")).toBe("smart_manufacturing");
  });

  it("maps source terms to configured dictionary codes", () => {
    expect(mapImportSource("基金")).toBe("activity");
    expect(mapImportSource("中介推荐")).toBe("referral");
    expect(mapImportSource("政府")).toBe("gov");
    expect(mapImportSource("自拓拜访")).toBe("visit");
  });

  it("maps free-text progress to simplified business stages", () => {
    expect(mapImportStage("刚认识，客户储备")).toBe("new");
    expect(mapImportStage("已拜访企业两次")).toBe("initial_contact");
    expect(mapImportStage("现场考察并带看厂房")).toBe("site_visit");
    expect(mapImportStage("已签约")).toBe("signed");
    expect(mapImportStage("原址续签，不考虑")).toBe("lost");
  });

  it("normalizes Excel dates, areas, and booleans", () => {
    expect(excelSerialDateToIso(46170)).toBe("2026-05-28");
    expect(normalizeArea("3-4000")).toBe(3500);
    expect(normalizeArea("100-500")).toBe(300);
    expect(normalizeImportBoolean("是")).toBe(true);
    expect(normalizeImportBoolean("否")).toBe(false);
  });
});
