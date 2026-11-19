import type { ExportPlan } from "./plan";
import { storeZip } from "./zip";

const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const types = "http://schemas.openxmlformats.org/package/2006/content-types";
const packageRel =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const officeRel =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const workbookType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const worksheetType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
const colLetters = "ABCDEFGHIJKL";
export function xmlText(value: string) {
  // XML 1.0 forbids most ASCII controls and lone UTF-16 surrogates; retain tab/newline/CR.
  // xl text also reserves the _xHHHH_ marker. Escape literal markers before writing inline strings.
  /* eslint-disable no-control-regex */
  const safe = value
    .toWellFormed()
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/gu,
      "\uFFFD",
    );
  /* eslint-enable no-control-regex */
  return safe
    .replace(/_(?=x[0-9a-f]{4}_)/gi, "_x005F_")
    .replace(
      /[&<>\r]/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\r": "&#13;" })[char] ??
        char,
    );
}
const cell = (ref: string, value: string) =>
  `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
export function xlsxParts(plan: ExportPlan) {
  const last = `${colLetters[plan.columns.length - 1]}${plan.rows.length + 1}`;
  const sheet = [
    `${head}<worksheet xmlns="${main}"><dimension ref="A1:${last}"/><sheetData><row r="1">`,
  ];
  plan.columns.forEach(({ label }, i) =>
    sheet.push(cell(`${colLetters[i]}1`, label)),
  );
  sheet.push("</row>");
  plan.rows.forEach(({ cells }, i) => {
    const n = i + 2;
    sheet.push(`<row r="${n}">`);
    cells.forEach((value, j) => {
      if (value !== null) sheet.push(cell(`${colLetters[j]}${n}`, value));
    });
    sheet.push("</row>");
  });
  sheet.push("</sheetData></worksheet>");
  return storeZip([
    {
      name: "[Content_Types].xml",
      parts: [
        `${head}<Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${workbookType}"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${worksheetType}"/></Types>`,
      ],
    },
    {
      name: "_rels/.rels",
      parts: [
        `${head}<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ],
    },
    {
      name: "xl/workbook.xml",
      parts: [
        `${head}<workbook xmlns="${main}" xmlns:r="${officeRel}"><sheets><sheet name="Captured records" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ],
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      parts: [
        `${head}<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${officeRel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      ],
    },
    { name: "xl/worksheets/sheet1.xml", parts: sheet },
  ]);
}
