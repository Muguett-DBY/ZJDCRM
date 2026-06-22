/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";

interface SpaceItem {
  id: string; name: string; code: string; area: number; available_area: number;
  status_code: string; derived_status_code?: string; locked_area?: number; candidate_count?: number; park_name: string; building_name: string; floor_no: string;
}

export default function SpacesListPage() {
  const { t } = useCopy();
  const [data, setData] = useState<{ items: SpaceItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      const result = await api.get<any>("/spaces", params);
      setData(result);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div className="page">
      <h1>{t("space.page.title")}</h1>
      <div className="filter-bar">
        <div className="form-field">
          <label>状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="available">可招商</option>
            <option value="negotiating">洽谈中</option>
            <option value="signed">已签约</option>
            <option value="occupied">已入驻</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : data && data.items.length > 0 ? (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>园区</th><th>楼宇</th><th>楼层</th><th>空间</th><th>总/可用面积</th><th>备选线索</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td>{s.park_name}</td><td>{s.building_name}</td><td>{s.floor_no}层</td>
                  <td>{s.name}</td><td>{s.area}㎡ / {s.available_area}㎡</td><td>{s.candidate_count || 0}</td>
                  <td><span className="badge badge-primary">{s.derived_status_code || s.status_code}</span>{Number(s.locked_area || 0) > 0 && <small> 锁定 {s.locked_area}㎡</small>}</td>
                  <td><Link to={`/spaces/${s.id}`} className="btn btn-ghost btn-sm">详情</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p className="text-muted">暂无空间资源</p>
        </div>
      )}
    </div>
  );
}

