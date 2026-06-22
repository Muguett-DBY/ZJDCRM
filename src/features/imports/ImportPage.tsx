import { useState } from "react";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";
import { parseClueCsv } from "../../lib/csv";
import { useAuth } from "../auth/auth.store";

export default function ImportPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const rows = parseClueCsv(await file.text());
      if (rows.length === 0) throw new Error("CSV 没有可导入的数据");
      setResult(await api.post("/imports", {
        jobType: "clues",
        sourceFileName: file.name,
        rows,
      }, csrfToken));
    } catch (cause: any) {
      setError(cause.message || "导入失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>{t("import.page.title")}</h1>
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-header">招商线索 CSV</div>
        <p className="text-muted">表头支持：线索名称、企业名称、渠道来源、需求面积、行业、主营业务。未填写负责人时进入未分配线索池。</p>
        <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" disabled={!file || loading} onClick={submit}>{loading ? "导入中..." : "开始导入"}</button>
        </div>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        {result && <div style={{ marginTop: 12 }}>共 {result.totalRows} 行，成功 {result.successRows} 行，失败 {result.failedRows} 行。</div>}
      </div>
    </div>
  );
}
