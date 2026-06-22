import { useState } from "react";
import { api } from "../../lib/api";
import { useCopy } from "../../lib/copy-provider";
import { parseClueCsv } from "../../lib/csv";
import { readWorkbook } from "../../lib/xlsx-import";
import { useAuth } from "../auth/auth.store";

export default function ImportPage() {
  const { t } = useCopy();
  const { csrfToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isXlsx = !!file && /\.xlsx$/i.test(file.name);

  const submitCsv = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setPreview(null);
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

  const previewXlsx = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const workbook = await readWorkbook(file);
      setPreview(await api.post("/imports/ai-preview", { workbook }, csrfToken));
    } catch (cause: any) {
      setError(cause.message || "AI 预览失败");
    } finally {
      setLoading(false);
    }
  };

  const confirmXlsxImport = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setError("");
    try {
      setResult(await api.post("/imports", {
        jobType: "ai-xlsx",
        sourceFileName: file.name,
        rows: preview.leadRows || [],
        spaces: preview.spaceRows || [],
      }, csrfToken));
      setPreview(null);
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
        <div className="card-header">招商线索导入</div>
        <p className="text-muted">支持 CSV 模板，也支持上传《招商共享信息.xlsx》这类多 Sheet 台账。XLSX 会先调用 AI 生成预览，确认后再入库。</p>
        <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setResult(null); setError(""); }} />
        <div style={{ marginTop: 16 }}>
          {!isXlsx && <button className="btn btn-primary" disabled={!file || loading} onClick={submitCsv}>{loading ? "导入中..." : "开始导入"}</button>}
          {isXlsx && <button className="btn btn-primary" disabled={!file || loading} onClick={previewXlsx}>{loading ? "AI 识别中..." : "AI 识别并预览"}</button>}
        </div>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        {result && <div style={{ marginTop: 12 }}>共 {result.totalRows} 行，成功 {result.successRows} 行，失败 {result.failedRows} 行。</div>}
      </div>

      {preview && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">AI 导入预览</div>
          <p className="text-muted">
            识别到 {preview.stats?.leads || preview.leadRows?.length || 0} 条线索，
            {preview.stats?.spaces || preview.spaceRows?.length || 0} 个空间。
            {preview.warnings?.length ? ` ${preview.warnings.length} 条提示需要留意。` : ""}
          </p>
          {preview.warnings?.length > 0 && (
            <div className="form-error" style={{ marginBottom: 12 }}>
              {preview.warnings.slice(0, 3).map((warning: string) => <div key={warning}>{warning}</div>)}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>企业</th><th>空间</th><th>面积</th><th>阶段</th><th>行业</th><th>标签</th></tr></thead>
              <tbody>
                {(preview.leadRows || []).slice(0, 20).map((row: any, index: number) => (
                  <tr key={`${row.companyName}-${index}`}>
                    <td>{row.companyName}</td>
                    <td>{row.spaceLocation || "-"}</td>
                    <td>{row.desiredArea ?? "-"}</td>
                    <td>{row.stageCode}</td>
                    <td>{row.industryCode}</td>
                    <td>{(row.tags || []).join("、")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={loading || !(preview.leadRows?.length || preview.spaceRows?.length)} onClick={confirmXlsxImport}>{loading ? "导入中..." : "确认导入"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
