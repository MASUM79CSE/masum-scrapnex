import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { detectActions, actOnPage } from "../src/core/pagination/page";
import {
  isAction,
  linked,
  type RunCommand,
} from "../src/core/pagination/contracts";
import { findPlans } from "../src/core/detector";
import {
  candidateSignature,
  schemaSignature,
} from "../src/core/extraction/signature";
import {
  changedCollection,
  collectRows,
  unavailableCollection,
} from "../src/core/extraction/collect";

export default defineUnlistedScript(async () => {
  const scope = globalThis as typeof globalThis & {
    __masumPagination?: { href: string; command: RunCommand };
  };
  const input = scope.__masumPagination;
  delete scope.__masumPagination;
  if (
    !input ||
    window !== window.top ||
    !/^https?:$/.test(location.protocol) ||
    input.href !== location.href
  )
    return null;
  const { command } = input;
  if (command.kind === "inspect") return detectActions(document);
  if (
    command.kind === "act" &&
    isAction(command.action, input.href) &&
    !linked(command.action)
  )
    return actOnPage(document, command.action, command.delay);
  if (
    command.kind !== "read" ||
    typeof command.id !== "string" ||
    command.id.length > 32 ||
    typeof command.signature !== "string" ||
    command.signature.length > 75000
  )
    return null;
  const snapshot = await findPlans(document);
  if (snapshot.report.status === "changed" || location.href !== input.href)
    return changedCollection();
  const candidate = snapshot.report.candidates.find(
    ({ id }) => id === command.id,
  );
  const plan = snapshot.plans.get(command.id);
  if (
    !candidate ||
    !plan ||
    (command.initial
      ? candidateSignature(candidate)
      : schemaSignature(candidate)) !== command.signature
  )
    return unavailableCollection();
  return collectRows(
    document,
    plan,
    input.href,
    snapshot.report.status === "partial" ||
      candidate.explanations.some((reason) =>
        reason.includes("outside the preview limit"),
      ),
  );
});
