import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Attachment = { id: string; original_file_name: string; content_type: string; file_size: number; uploaded_at: string };

export default function AttachmentPanel({ clueId, csrfToken, onItemsChange }: { clueId: string; csrfToken: string; onItemsChange?: (items: Attachment[]) => void }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [message, setMessage] = useState("");
  const load = async () => {
    try { const nextItems = await api.get<Attachment[]>(`/clues/${clueId}/attachments`); setItems(nextItems); onItemsChange?.(nextItems); } catch (err: any) { setMessage(err.message); }
  };
  useEffect(() => {
    let cancelled = false;
    void api.get<Attachment[]>(`/clues/${clueId}/attachments`)
      .then((nextItems) => { if (!cancelled) { setItems(nextItems); onItemsChange?.(nextItems); } })
      .catch((err: any) => { if (!cancelled) setMessage(err.message); });
    return () => { cancelled = true; };
  }, [clueId, onItemsChange]);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData(); form.set("file", file);
    try { await api.upload(`/clues/${clueId}/attachments`, form, csrfToken); event.target.value = ""; await load(); }
    catch (err: any) { setMessage(err.message); }
  };
  const download = async (item: Attachment) => {
    const response = await fetch(`/api/attachments/${item.id}/download`, { credentials: "include" });
    if (!response.ok) { setMessage("下载失败"); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = item.original_file_name; link.click(); URL.revokeObjectURL(url);
  };
  const remove = async (item: Attachment) => {
    if (!window.confirm(`删除附件“${item.original_file_name}”？`)) return;
    try { await api.delete(`/attachments/${item.id}`, csrfToken); await load(); } catch (err: any) { setMessage(err.message); }
  };
  return <div className="card" style={{ marginBottom: 16 }}>
    <div className="card-header">附件</div>
    {message && <div className="form-error">{message}</div>}
    <label className="btn btn-sm" htmlFor="clue-attachment-upload">上传附件<input id="clue-attachment-upload" aria-label="上传附件" type="file" onChange={upload} style={{ display: "none" }} /></label>
    {items.length ? <table><thead><tr><th>文件</th><th>大小</th><th>上传时间</th><th>操作</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.original_file_name}</td><td>{Math.ceil(item.file_size / 1024)} KB</td><td>{new Date(item.uploaded_at).toLocaleString("zh-CN")}</td><td><button className="btn btn-sm" onClick={() => download(item)}>下载</button><button className="btn btn-sm" onClick={() => remove(item)}>删除</button></td></tr>)}</tbody></table> : <p className="text-muted">暂无附件</p>}
  </div>;
}
