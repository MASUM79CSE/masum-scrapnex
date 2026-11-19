import { analyzeDocument } from "../../../src/core/analyzer";

import { collectRows } from "../../../src/core/extraction/collect";

declare global {
  interface Window {
    scrapnexCollect: typeof collectRows;
    scrapnexAnalyze: typeof analyzeDocument;
  }
}
window.scrapnexAnalyze = analyzeDocument;

window.scrapnexCollect = collectRows;
