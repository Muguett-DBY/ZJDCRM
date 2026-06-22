/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";
import { useAuth } from "../auth/auth.store";

export default function RemindersPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get("/notifications", { unreadOnly: String(unreadOnly) }));
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`, {}, csrfToken);
    await load();
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all", {}, csrfToken);
    await load();
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>{t("reminder.page.title")}</h1>
        <button className="btn" onClick={markAllRead}>全部标为已读</button>
      </div>
      <label><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> 只看未读</label>
      {loading ? <div className="loading-screen"><div className="spinner" /></div> : data.items.length === 0 ? (
        <div className="card"><p className="text-muted">暂无提醒</p></div>
      ) : (
        <div className="card">
          {data.items.map((item) => (
            <div key={item.id} style={{ padding: 12, borderBottom: "1px solid var(--color-border-light)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{item.title}</strong>
                {!item.read_at && <button className="btn btn-sm btn-ghost" onClick={() => markRead(item.id)}>标为已读</button>}
              </div>
              <p>{item.body}</p>
              {item.related_entity_type === "clue" && item.related_entity_id && <Link to={`/clues/${item.related_entity_id}`}>查看线索</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
