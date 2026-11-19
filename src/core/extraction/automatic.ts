import { candidateSignature } from "./signature";
import { findPlans } from "../detector";
import {
  changedCollection,
  collectRows,
  unavailableCollection,
} from "./collect";

export async function collectDetected(
  doc: Document,
  id: string,
  signature: string,
  href: string,
) {
  const snapshot = await findPlans(doc);
  if (
    snapshot.report.status === "changed" ||
    doc.defaultView?.location.href !== href
  )
    return changedCollection();
  const candidate = snapshot.report.candidates.find((item) => item.id === id);
  const plan = snapshot.plans.get(id);
  if (!candidate || !plan || candidateSignature(candidate) !== signature)
    return unavailableCollection();
  return collectRows(
    doc,
    plan,
    href,
    snapshot.report.status === "partial" ||
      candidate.explanations.some((reason) =>
        reason.includes("outside the preview limit"),
      ),
  );
}
