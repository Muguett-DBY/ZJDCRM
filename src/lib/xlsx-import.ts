import JSZip from "jszip";
import type { WorkbookSheet } from "../../shared/xlsx-import-preview";

const SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`XLSX 缺少 ${path}`);
  return file.async("text");
}

function textContent(node: Element): string {
  return [...node.getElementsByTagNameNS(SPREADSHEET_NS, "t")].map((item) => item.textContent || "").join("");
}

function columnNumber(cellRef: string): number {
  const letters = (cellRef.match(/^[A-Z]+/)?.[0] || "");
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  if (!zip.file("xl/sharedStrings.xml")) return [];
  const doc = parseXml(await readZipText(zip, "xl/sharedStrings.xml"));
  return [...doc.getElementsByTagNameNS(SPREADSHEET_NS, "si")].map(textContent);
}

function readWorkbookRelationships(doc: Document): Record<string, string> {
  const rels: Record<string, string> = {};
  for (const rel of [...doc.getElementsByTagName("Relationship")]) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) rels[id] = target.startsWith("xl/") ? target : `xl/${target.replace(/^\/+/, "")}`;
  }
  return rels;
}

function readCellValue(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return textContent(cell);
  const raw = cell.getElementsByTagNameNS(SPREADSHEET_NS, "v")[0]?.textContent || "";
  if (!raw) return "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  return raw;
}

async function readSheet(zip: JSZip, path: string, sharedStrings: string[]): Promise<unknown[][]> {
  const doc = parseXml(await readZipText(zip, path));
  const rows: unknown[][] = [];
  for (const row of [...doc.getElementsByTagNameNS(SPREADSHEET_NS, "row")]) {
    const values: string[] = [];
    let hasValue = false;
    for (const cell of [...row.getElementsByTagNameNS(SPREADSHEET_NS, "c")]) {
      const index = Math.max(0, columnNumber(cell.getAttribute("r") || "") - 1);
      const value = readCellValue(cell, sharedStrings);
      values[index] = value;
      if (value) hasValue = true;
    }
    if (hasValue) rows.push(values.map((value) => value ?? ""));
  }
  return rows;
}

export async function readWorkbook(file: File): Promise<{ sheets: WorkbookSheet[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sharedStrings = await readSharedStrings(zip);
  const relsDoc = parseXml(await readZipText(zip, "xl/_rels/workbook.xml.rels"));
  const relationships = readWorkbookRelationships(relsDoc);
  const workbook = parseXml(await readZipText(zip, "xl/workbook.xml"));
  const sheets = await Promise.all([...workbook.getElementsByTagNameNS(SPREADSHEET_NS, "sheet")].map(async (sheet) => {
    const name = sheet.getAttribute("name") || "Sheet";
    const relId = sheet.getAttributeNS(REL_NS, "id") || sheet.getAttribute("r:id") || "";
    const path = relationships[relId];
    if (!path) throw new Error(`XLSX 工作表 ${name} 缺少路径`);
    return { name, rows: await readSheet(zip, path, sharedStrings) };
  }));
  return {
    sheets,
  };
}
