import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { detectPage } from "../src/core/detector";

// Called only by the chrome adapter on an explicit scan. The isolated script runs once;
// it registers no listener and launches no network requests, clicks or navigation.
export default defineUnlistedScript(() => {
  if (window !== window.top || !/^https?:$/.test(location.protocol))
    return null;
  return detectPage(document);
});
