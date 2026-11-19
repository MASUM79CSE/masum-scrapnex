import { ArrowUpRight, FlaskConical, ShieldCheck } from "lucide-react";

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`brand-mark${small ? " brand-mark--small" : ""}`}
      aria-hidden="true"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 32 32"
        fill="none"
        focusable="false"
      >
        <path
          d="M12.5 5.5H6v6.5M19.5 5.5H26V12M26 20v6.5h-6.5M12.5 26.5H6V20"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m16 9 7 4.3-7 4.3-7-4.3L16 9Zm-7 8.5 7 4.3 7-4.3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <Mark />
      <div>
        <span className="brand-name">
          MASUM <strong>SCRAPNEXS</strong>
        </span>
        <span className="brand-caption">WEB DATA WORKSPACE</span>
      </div>
    </div>
  );
}

export function SampleBadge() {
  return (
    <span className="badge badge--sample">
      <FlaskConical size={14} aria-hidden="true" /> Sample mode
    </span>
  );
}

export function LocalBadge() {
  return (
    <span className="badge badge--local">
      <ShieldCheck size={14} aria-hidden="true" /> Local only
    </span>
  );
}

export function OpenLabel() {
  return (
    <>
      Open side panel <ArrowUpRight size={17} aria-hidden="true" />
    </>
  );
}
