import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";
import { useAuth } from "../auth/auth.store";

type CopyEntry = { key: string; group: string; label: string; defaultValue: string };
type CopyData = { entries: CopyEntry[]; overrides: Record<string, string> };

export default function CopyManagementPage() {
  const { csrfToken } = useAuth();
  const { reload } = useCopy();
  const [data, setData] = useState<CopyData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get<CopyData>("/admin/content")
      .then((value) => { setData(value); setDrafts(value.overrides); })
      .catch((error: Error) => setMessage(error.message || "加载失败"));
  }, []);

  const entries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.entries || []).filter((entry) => !normalized || [entry.group, entry.label, entry.key, entry.defaultValue]
      .some((value) => value.toLowerCase().includes(normalized)));
  }, [data, query]);

  const save = async () => {
    try {
      const saved = await api.put<Record<string, string>>("/admin/content", { overrides: drafts }, csrfToken);
      setDrafts(saved);
      await reload();
      setMessage("文案已保存并发布");
    } catch (error: any) { setMessage(error.message || "保存失败"); }
  };

  const reset = async (key: string) => {
    try {
      const saved = await api.delete<Record<string, string>>(`/admin/content/${key}`, csrfToken);
      setDrafts(saved);
      await reload();
      setMessage("已恢复默认文案");
    } catch (error: any) { setMessage(error.message || "恢复失败"); }
  };

  if (!data) return <div className="loading-screen"><div className="spinner" /><span>加载中...</span></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div><h1>文案管理</h1><p className="text-muted">修改已登记的界面文字，不会改变数据库字段、接口或导入导出格式。</p></div>
        <button className="btn btn-primary" onClick={save}>保存文案</button>
      </div>
      {message && <div className="form-error" style={{ marginBottom: 12 }}>{message}</div>}
      <div className="filter-bar"><div className="form-field"><label htmlFor="copy-search">搜索文案</label><input id="copy-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称、分组或键名" /></div></div>
      {entries.length === 0 ? <div className="card">没有符合条件的文案。</div> : (
        <div className="table-wrapper"><table><thead><tr><th>分组</th><th>名称</th><th>当前文案</th><th>默认文案</th><th>操作</th></tr></thead><tbody>
          {entries.map((entry) => <tr key={entry.key}>
            <td>{entry.group}</td><td><label htmlFor={`copy-${entry.key}`}>{entry.label}</label></td>
            <td><input id={`copy-${entry.key}`} value={drafts[entry.key] ?? entry.defaultValue} onChange={(event) => setDrafts((current) => ({ ...current, [entry.key]: event.target.value }))} /></td>
            <td>{entry.defaultValue}</td><td><button className="btn btn-ghost btn-sm" onClick={() => reset(entry.key)} disabled={!drafts[entry.key]}>恢复默认</button></td>
          </tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}
