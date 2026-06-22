import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";

export default function SpaceDetailPage() {
  const { t } = useCopy();
  const { id } = useParams();
  const [space, setSpace] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (id) api.get(`/spaces/${id}`).then(setSpace).catch((cause) => setError(cause.message));
  }, [id]);

  return (
    <div className="page">
      <h1>{t("space.detail.title")}</h1>
      {error ? <div className="form-error">{error}</div> : !space ? <div className="loading-screen"><div className="spinner" /></div> : (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-header">{space.name}（{space.code}）</div>
          <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
            <dt>园区</dt><dd>{space.park_name}</dd>
            <dt>楼宇</dt><dd>{space.building_name}</dd>
            <dt>楼层</dt><dd>{space.floor_name || space.floor_no}</dd>
            <dt>总面积</dt><dd>{space.area}㎡</dd>
            <dt>可用面积</dt><dd>{space.available_area}㎡</dd>
            <dt>状态</dt><dd>{space.status_code}</dd>
            <dt>预计释放</dt><dd>{space.expected_release_at || "-"}</dd>
            <dt>备注</dt><dd>{space.notes || "-"}</dd>
          </dl>
          <Link className="btn" to="/spaces">返回列表</Link>
        </div>
      )}
    </div>
  );
}
