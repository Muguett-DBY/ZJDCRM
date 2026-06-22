/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";
import { useAuth } from "../auth/auth.store";

export default function UnassignedPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<any>("/clues", { unassigned: "true", pageSize: "100" });
      setItems(data.items);
      try { setUsers(await api.get("/users/assignable")); } catch { setUsers([]); }
    } catch (cause: any) { setError(cause.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const assign = async (id: string) => {
    if (!owners[id]) return;
    await api.post(`/clues/${id}/assign`, { ownerId: owners[id] }, csrfToken);
    await load();
  };

  return (
    <div className="page">
      <h1>{t("nav.unassigned")}</h1>
      {error && <div className="form-error">{error}</div>}
      {items.length === 0 ? <div className="card"><p className="text-muted">暂无未分配线索</p></div> : (
        <div className="table-wrapper"><table>
          <thead><tr><th>线索</th><th>企业</th><th>阶段</th><th>分配</th></tr></thead>
          <tbody>{items.map((item) => (
            <tr key={item.id}>
              <td><Link to={`/clues/${item.id}`}>{item.title}</Link></td>
              <td>{item.company_name}</td><td>{item.stage_code}</td>
              <td>{users.length ? <>
                <select value={owners[item.id] || ""} onChange={(event) => setOwners({ ...owners, [item.id]: event.target.value })}>
                  <option value="">选择负责人</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                </select>
                <button className="btn btn-sm" onClick={() => assign(item.id)}>分配</button>
              </> : "无分配权限"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
