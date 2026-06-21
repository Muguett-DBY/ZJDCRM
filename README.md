# ZJDCRM

产业园区招商线索管理系统。项目目标、业务规则和完整实施清单见：

- [产品与架构规格](docs/superpowers/specs/2026-06-21-zjdcrm-design.md)
- [完整实施计划](docs/superpowers/plans/2026-06-21-zjdcrm-implementation.md)
- [交给后续 Agent 的实施 Prompt](AGENT_HANDOFF_PROMPT.md)

> 当前线上版本是可持续部署的工程骨架：React + Cloudflare Pages Functions + D1 + R2。完整 CRM 功能仍需按实施计划继续开发。

## 技术栈

- React 19、TypeScript、Vite
- Hono、Cloudflare Pages Functions
- Cloudflare D1、R2
- Vitest（含 workerd）、Playwright

## 本地运行

```bash
npm ci
npm run cf:types
npx wrangler d1 migrations apply zjdcrm-db --local
npm run build
npm run pages:dev
```

访问 `http://localhost:8788`。健康检查：`/api/health`。

## 验证

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run e2e
```

## 自动部署

Cloudflare Pages 项目连接本仓库的 `main` 分支：

- Build command: `npm run build`
- Build output: `dist`
- Production branch: `main`
- Domain: `zjdcrm.custard.top`

推送到 `main` 后 Cloudflare 自动构建和部署。D1/R2 资源通过 `wrangler.jsonc` 绑定。

## 安全

不要提交 `.dev.vars`、Cloudflare Token、管理员明文密码、生产数据库或用户附件。初始管理员密码必须通过 Cloudflare Secret 注入，并在认证模块完成后只保存 PBKDF2 哈希。

## License

MIT

