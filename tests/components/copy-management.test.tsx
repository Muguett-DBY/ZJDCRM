import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CopyManagementPage from "../../src/features/admin/CopyManagementPage";

const mocks = vi.hoisted(() => ({
  put: vi.fn(async () => ({ "clue.field.title": "项目名称" })),
}));

vi.mock("../../src/lib/api", () => ({
  api: {
    get: vi.fn(async () => ({
      entries: [{ key: "clue.field.title", group: "招商线索", label: "线索名称", defaultValue: "线索名称" }],
      overrides: {},
    })),
    put: mocks.put,
    delete: vi.fn(),
  },
}));

vi.mock("../../src/features/auth/auth.store", () => ({
  useAuth: () => ({ csrfToken: "csrf-token" }),
}));

vi.mock("../../src/lib/copy-provider", () => ({
  useCopy: () => ({ reload: vi.fn() }),
}));

describe("CopyManagementPage", () => {
  it("saves an override for a registered UI label", async () => {
    render(<CopyManagementPage />);

    const input = await screen.findByLabelText("线索名称");
    fireEvent.change(input, { target: { value: "项目名称" } });
    fireEvent.click(screen.getByRole("button", { name: "保存文案" }));

    await waitFor(() => {
      expect(mocks.put).toHaveBeenCalledWith("/admin/content", { overrides: { "clue.field.title": "项目名称" } }, "csrf-token");
    });
  });
});
