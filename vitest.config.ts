import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/unit/**/*.test.{ts,tsx}",
            "tests/integration/**/*.test.{ts,tsx}",
          ],
        },
      },
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/components/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
