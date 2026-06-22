# AI XLSX Import Design

## Goal

让 `/imports` 支持上传用户现有的《招商共享信息.xlsx》这类多 sheet 台账，通过 OpenCode Go 的 `mimo-v2.5` 模型辅助清洗字段，再由用户预览确认后导入 CFZZS。

## Source workbook rules

- `短期督办计划` 不是独立主数据，它来自个人储备里的重点客户。
  - 能匹配到个人储备客户时，只给同一条线索追加 `重点客户`、`短期督办` 标签，并写入督办跟进。
  - 匹配不到时，仍创建线索，并按对接人作为负责人候选。
- `杨怡喆客户储备`、`孙丹客户储备`、`杨娜客户储备`、`刘玉峰客户储备` 是招商线索主数据来源。
- `器械城一期销控`、`器械城二期销控` 导入为空间资源；`在谈客户` 能匹配线索时建立空间匹配关系。
- `会招统计` 中每个客户/项目导入为招商线索，并追加 `会招` 标签；会议名称、时间、地点进入跟进记录。
- `渠道名单` 和未来产业分类 sheet 第一版不直接入库，仅作为 AI/规则映射参考。

## Import flow

1. 前端读取 `.xlsx` 多 sheet 内容，生成轻量 workbook JSON，不把原始文件或密钥发到浏览器外部服务。
2. 前端调用后端 `/api/imports/ai-preview`。
3. 后端使用 `OPENCODE_GO_API_KEY` 调用 `https://opencode.ai/zen/go/v1/chat/completions`。
4. 模型固定为 `mimo-v2.5`，`reasoning_effort` 固定为 `high`，高 `max_tokens`，要求返回结构化 JSON。
5. 后端对 AI JSON 做 schema 校验和确定性兜底：
   - 线索标题默认使用公司名，不允许使用长跟进文本作为标题。
   - 行业、渠道、阶段必须落到系统字典值。
   - Excel 日期序列号转换为 ISO 日期；季度/年底前等非精确日期进入备注。
   - 重复客户合并，不重复建线索。
6. 前端展示预览：线索数、空间数、标签、失败/需确认原因。
7. 用户点击确认导入后，调用现有 `/api/imports` 的增强格式落库。

## Data mapping

### Lead fields

- `companyName`: 储备客户名称、项目/公司名称。
- `title`: 公司名；必要时为 `公司名-空间位置`。
- `mainBusiness`: 客户主营业务、项目简介。
- `desiredArea`: 面积/㎡、企业需求里能解析出的面积。
- `stageCode`:
  - 储备/刚认识/默认 -> `new`
  - 拜访/已来访/沟通 -> `initial_contact`
  - 带看/考察/看场地 -> `site_visit`
  - 签约/已签约 -> `signed`
  - 已落地/注册 -> `landed`
  - 流失/原址续签/不考虑 -> `lost`
- `sourceCode`:
  - 中介/渠道 -> `referral`
  - 政府 -> `gov`
  - 自拓/拜访 -> `visit`
  - 基金/活动/大赛/会议 -> `activity`
- `industryCode`:
  - 医疗器械 -> `medical_devices`
  - 医药健康/创新药/合成生物/基因测序 -> `pharma`
  - AI/人工智能/脑机接口 -> `ai`
  - 芯片/集成电路/半导体 -> `integrated_circuit`
  - 智能制造/机器人/设备制造/先进制造 -> `smart_manufacturing`
  - 其他 -> `other`

### Follow-up fields

导入时为每条线索至少创建一条跟进记录，内容包含：

- 原 sheet 名。
- 意向跟进阶段或督办任务。
- 客户需求。
- 核心卡点。
- 非精确日期原文。
- 会议信息。

### Tags

导入自动确保并绑定以下标签：

- `重点客户`
- `短期督办`
- `会招`
- `客户储备`

## Security and operations

- `OPENCODE_GO_API_KEY` 只存在于 Cloudflare Pages 环境变量/Secret，不进入前端 bundle、数据库、日志或 Git。
- AI 预览接口需要登录和导入权限。
- AI 失败时返回可解释错误，用户仍可回退到 CSV/规则导入。
- 单次预览限制 1000 行以内，避免 Pages Function 超时。

## Testing

- 单元测试覆盖 workbook 行识别、行业/渠道/阶段映射、Excel 日期转换、短期督办合并规则。
- 集成测试覆盖增强 `/api/imports`：创建线索、标签、跟进记录、空间资源和空间匹配。
- 组件/e2e 测试覆盖上传 xlsx、展示预览、确认导入。
