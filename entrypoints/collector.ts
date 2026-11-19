import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { collectDetected } from "../src/core/extraction/automatic";

export default defineUnlistedScript(() => {
  if (window !== window.top || !/^https?:$/.test(location.protocol))
    return null;
  const isolated = globalThis as typeof globalThis & {
    __masumCollection?: { id: string; signature: string; href: string };
  };
  const input = isolated.__masumCollection;
  delete isolated.__masumCollection;
  if (
    !input ||
    input.href !== location.href ||
    typeof input.id !== "string" ||
    input.id.length > 32 ||
    typeof input.signature !== "string" ||
    input.signature.length > 75_000
  )
    return null;
  return collectDetected(document, input.id, input.signature, input.href);
});
