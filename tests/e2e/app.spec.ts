import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await expect(page).toHaveTitle("CFZZS");
  await page.getByLabel("账号").fill("admin");
  await page.getByLabel("密码").fill("admin123456");
  await page.getByRole("button", { name: "登 录" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "招商看板" })).toBeVisible();
}

test.describe("authenticated application", () => {
  test("loads every business and admin route without placeholder content", async ({ page }) => {
    await loginAsAdmin(page);

    const routes: Array<[string, string]> = [
      ["/clues", "招商线索"],
      ["/unassigned", "未分配线索"],
      ["/spaces", "空间资源"],
      ["/reminders", "跟进提醒"],
      ["/reports", "数据报表"],
      ["/imports", "数据导入"],
      ["/exports", "导出管理"],
      ["/profile", "个人设置"],
      ["/admin", "后台首页"],
      ["/admin/users", "员工管理"],
      ["/admin/departments", "部门管理"],
      ["/admin/roles", "角色权限"],
      ["/admin/dictionaries", "字典配置"],
      ["/admin/spaces", "空间管理"],
      ["/admin/imports", "导入任务"],
      ["/admin/exports", "导出审批"],
      ["/admin/audit", "审计日志"],
      ["/admin/settings", "系统设置"],
      ["/admin/deleted", "数据恢复"],
      ["/admin/copy", "文案管理"],
    ];

    for (const [route, heading] of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByText("即将上线")).toHaveCount(0);
    }
  });

  test("admin creates a role-based user and imports an unassigned clue", async ({ page }) => {
    await loginAsAdmin(page);
    const suffix = Date.now().toString();

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "新增员工" }).click();
    await page.getByLabel("账号 *").fill(`qa-${suffix}`);
    await page.getByLabel("姓名 *").fill("QA User");
    await page.getByLabel("初始密码 *").fill("qa-password-123");
    await page.getByLabel("招商人员").check();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText(`qa-${suffix}`)).toBeVisible();

    const employeeRow = page.getByRole("row", { name: new RegExp(`qa-${suffix}`) });
    await employeeRow.getByRole("button", { name: "编辑" }).click();
    await page.getByLabel("编辑姓名 *").fill("QA User Updated");
    await page.getByRole("button", { name: "保存修改" }).click();
    await expect(page.getByRole("row", { name: new RegExp(`qa-${suffix}`) }).getByText("QA User Updated")).toBeVisible();

    await page.goto("/imports");
    await page.locator('input[type="file"]').setInputFiles({
      name: "qa-clues.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`线索名称,企业名称,渠道来源,需求面积\r\nQA线索${suffix},QA企业${suffix},activity,300`),
    });
    await page.getByRole("button", { name: "开始导入" }).click();
    await expect(page.getByText("成功 1 行")).toBeVisible();

    await page.goto("/unassigned");
    await expect(page.getByText(`QA线索${suffix}`)).toBeVisible();
  });

  test("creates a clue with a contact and follow-up", async ({ page }) => {
    await loginAsAdmin(page);
    const suffix = Date.now().toString();
    await page.goto("/clues/new");
    await page.getByLabel("线索名称 *").fill(`闭环线索${suffix}`);
    await page.getByLabel("企业名称 *").fill(`闭环企业${suffix}`);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("heading", { name: `闭环线索${suffix}` })).toBeVisible();

    await page.getByLabel("联系人姓名").fill("测试联系人");
    await page.getByLabel("联系人手机号").fill(`139${suffix.slice(-8)}`);
    await page.getByRole("button", { name: "添加联系人" }).click();
    await expect(page.getByText("测试联系人")).toBeVisible();

    await page.getByLabel("跟进内容").fill("完成首次电话跟进");
    await page.getByRole("button", { name: "添加跟进" }).click();
    await expect(page.getByText("完成首次电话跟进")).toBeVisible();
  });

  test("uploads and deletes a clue attachment", async ({ page }) => {
    await loginAsAdmin(page);
    const suffix = Date.now().toString();
    await page.goto("/clues/new");
    await page.getByLabel("线索名称 *").fill(`附件线索${suffix}`);
    await page.getByLabel("企业名称 *").fill(`附件企业${suffix}`);
    await page.getByRole("button", { name: "保存" }).click();

    await page.getByLabel("上传附件").setInputFiles({
      name: `attachment-${suffix}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("CFZZS attachment verification"),
    });
    await expect(page.getByText(`attachment-${suffix}.txt`)).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("row", { name: new RegExp(`attachment-${suffix}`) }).getByRole("button", { name: "删除" }).click();
    await expect(page.getByText(`attachment-${suffix}.txt`)).toHaveCount(0);
  });

  test("keeps the dashboard usable without horizontal overflow on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.getByRole("heading", { name: "招商看板" })).toBeVisible();
  });

  test("shows the clue board and advanced filters on the clue list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/clues");
    await expect(page.getByText("线索看板")).toBeVisible();
    await expect(page.getByLabel("行业")).toBeVisible();
    await expect(page.getByLabel("标签")).toBeVisible();
    await expect(page.getByLabel("负责人")).toBeVisible();
    await expect(page.getByLabel("获取意向起")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "标签" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "核心卡点" })).toBeVisible();
  });

  test("publishes a managed label change to the clue list and form", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/copy");
    const titleInput = page.getByLabel("线索名称");
    await titleInput.fill("项目名称");
    await page.getByRole("button", { name: "保存文案" }).click();
    await expect(page.getByText("文案已保存并发布")).toBeVisible();

    await page.goto("/clues");
    await expect(page.getByRole("columnheader", { name: "项目名称" })).toBeVisible();
    await page.goto("/clues/new");
    await expect(page.getByLabel("项目名称 *")).toBeVisible();

    await page.goto("/admin/copy");
    await page.getByLabel("线索名称").fill("线索名称");
    await page.getByRole("button", { name: "保存文案" }).click();
  });

  test("lets the administrator add an industry option used by the clue form", async ({ page }) => {
    await loginAsAdmin(page);
    const suffix = Date.now().toString();
    const code = `robotics-${suffix}`;
    const name = `机器人${suffix}`;

    await page.goto("/admin/dictionaries");
    await expect(page.getByText("行业（industry）")).toBeVisible();
    await page.getByLabel("行业项目编码").fill(code);
    await page.getByLabel("行业项目名称").fill(name);
    await page.getByLabel("行业项目值").fill(code);
    await page.locator(".card").filter({ hasText: "行业（industry）" }).getByRole("button", { name: "新增项目" }).click();

    await page.goto("/clues/new");
    await expect(page.getByRole("option", { name })).toHaveCount(1);
  });
});
