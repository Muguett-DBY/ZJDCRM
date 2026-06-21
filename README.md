# ZJDCRM — 产业园区招商线索管理系统

在线地址：**[https://zjdcrm.custard.top](https://zjdcrm.custard.top)**

| 模块 | 状态 |
|------|------|
| 登录 / 认证（PBKDF2 + Session + CSRF） | ✅ 线上可用 |
| RBAC 数据权限（5 角色 + 数据范围） | ✅ 服务端完成 |
| 招商线索 CRUD + 阶段流转 + 乐观锁 | ✅ 服务端完成 |
| 联系人 + 企业查重 | ✅ 服务端完成 |
| 跟进记录 + 时间线 | ✅ 服务端完成 |
| 空间资源（园区/楼宇/楼层/空间） | ✅ 服务端完成 |
| 首页仪表盘（ECharts 看板） | ✅ 前端完成 |
| 数据导入导出 | 🚧 待实现引擎 |
| 管理后台 API | ✅ 服务端完成 |
| 种子数据（admin / 角色/权限/字典） | ✅ 已部署 |
| CI / CD | ✅ GitHub Actions + Cloudflare Pages |
| E2E 测试 | 🚧 待实现 |

## 技术栈

- **前端：** React 19、TypeScript、Vite、React Router、TanStack Query、ECharts
- **API：** Hono、Cloudflare Pages Functions
- **数据库：** Cloudflare D1（SQLite）
- **文件：** Cloudflare R2（私有附件、导出文件）
- **测试：** Vitest（含 workerd）、Playwright
- **部署：** GitHub → Cloudflare Pages（自动）

## 本地开发

```bash
npm ci
npm run cf:types
npx wrangler d1 migrations apply zjdcrm-db --local
npm run build
npm run pages:dev
```

访问 `http://localhost:8788`。

## 验证

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

## 管理员登录

| 项目 | 内容 |
|------|------|
| 地址 | https://zjdcrm.custard.top |
| 账号 | `admin` |
| 临时密码 | `admin123456`（请登录后立即修改） |

## 设计文档

- [产品与架构规格](docs/superpowers/specs/2026-06-21-zjdcrm-design.md)
- [完整实施计划](docs/superpowers/plans/2026-06-21-zjdcrm-implementation.md)
