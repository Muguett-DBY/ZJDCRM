import { z } from "zod";

export const loginSchema = z.object({
  account: z.string().min(1, "账号不能为空").max(100),
  password: z.string().min(1, "密码不能为空").max(256),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8, "新密码至少8位").max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Extract error messages from a Zod safeParse result (compatible with Zod v3 and v4).
 */
export function formatZodErrors(error: { issues?: Array<{ message: string }>; errors?: Array<{ message: string }> }): string {
  const issues = error.issues || error.errors || [];
  if (issues.length === 0) return "输入校验失败";
  return issues.map((e) => e.message).join("; ");
}
