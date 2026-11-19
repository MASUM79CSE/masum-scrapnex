import { createLibrary } from "../../../src/browser/library";

declare global {
  interface Window {
    scrapnexLibrary: typeof createLibrary;
  }
}
window.scrapnexLibrary = createLibrary;
