import { analyzeDocument } from "../../../src/core/analyzer";

declare global {
  interface Window {
    scrapnexAnalyze: typeof analyzeDocument;
  }
}
window.scrapnexAnalyze = analyzeDocument;
