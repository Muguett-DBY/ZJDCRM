import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyProvider, useCopy } from "../../src/lib/copy-provider";

vi.mock("../../src/lib/api", () => ({
  api: {
    get: vi.fn(async () => ({ "clue.field.title": "项目名称" })),
  },
}));

function CopyProbe() {
  const { t } = useCopy();
  return <span>{t("clue.field.title")}</span>;
}

describe("CopyProvider", () => {
  it("uses published overrides while retaining registered defaults", async () => {
    render(
      <CopyProvider>
        <CopyProbe />
      </CopyProvider>,
    );

    expect(await screen.findByText("项目名称")).toBeTruthy();
  });
});
