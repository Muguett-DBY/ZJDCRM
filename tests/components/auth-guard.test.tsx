import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthGuard from "../../src/app/AuthGuard";

const setSession = vi.fn();

vi.mock("../../src/features/auth/auth.store", () => ({
  useAuth: () => ({ setSession }),
}));

vi.mock("../../src/features/auth/auth.api", () => ({
  getSession: vi.fn(async () => ({
    user: {
      id: "admin",
      account: "admin",
      displayName: "Admin",
      isSuperAdmin: true,
      canManageSystem: true,
      departmentId: null,
    },
    csrfToken: "csrf-token",
  })),
}));

describe("AuthGuard", () => {
  beforeEach(() => setSession.mockClear());

  it("hydrates the shared auth context after a page refresh", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthGuard requireAdmin>
          <div>Protected content</div>
        </AuthGuard>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Protected content")).toBeTruthy();
    await waitFor(() => {
      expect(setSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: "admin", isSuperAdmin: true }),
        "csrf-token",
      );
    });
  });
});
