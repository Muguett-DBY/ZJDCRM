# Lead Reserve Tags and Clue Board Design

## Goal

Make imported customer reserve data visible as manageable招商线索 data: reserve status labels become searchable tags, and the招商线索 first page becomes a compact board plus a complete filterable data table.

## Import behavior

For each personal `客户储备` sheet row, import keeps the existing `客户储备` tag and adds inferred status tags:

- `近两周新增`: `获取意向时间` is within 14 days of the import date.
- `已签约`: follow-up/stage/lost text contains signed or landed wording such as `已签约`, `签约完成`, `已落地`.
- `无跟进价值`: follow-up/stage/lost text contains inactive wording such as `流失`, `不考虑`, `无意向`, `原址续签`, `暂缓`.
- `重点在签约`: text contains signing intent wording such as `预计签约`, `推进签约`, `签约条件`, `商务条件`, `合同`, `租赁合同`, unless it is already classified as `已签约` or `无跟进价值`.

The rules are deterministic because the workbook does not contain merged cells or reliable per-row status fields for the first-row visual labels.

## Clue list behavior

The招商线索 page shows a board before the table:

- total matching clues;
- count cards for `近两周新增`, `重点在签约`, `无跟进价值`, `已签约`;
- quick tag counts for common imported tags.

The table and API support filters for keyword, stage, source, industry, tag, owner, acquired date range, expected landing date range, updated date range, and desired area range. The table displays imported fields needed for daily maintenance: tags, industry, owner, acquired date, expected landing date, desired area, bottleneck, prior location, financing flag, and updated date.

## Verification

Automated tests cover reserve tag inference and clue list API filtering/statistics. Browser e2e continues to verify that admin pages and dictionary-driven industry options work.
