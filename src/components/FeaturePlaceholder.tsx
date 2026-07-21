// Shared placeholder for sections that are intentionally not built yet (Nav spec §10).
// Communicates what the section is for, why it's unavailable, and what's pending —
// never fake metrics, never a blank screen, and (deliberately) no loading indicator.
import { Card } from "@/components/ui";

export interface FeaturePlaceholderProps {
  title: string;
  description: string;
  pendingOn: string[];
  futureIncludes?: string[];
}

export function FeaturePlaceholder({
  title,
  description,
  pendingOn,
  futureIncludes,
}: FeaturePlaceholderProps) {
  return (
    <Card>
      <div className="mx-auto max-w-2xl py-8">
        <div className="text-center">
          <div className="text-lg font-semibold text-ink">{title}</div>
          <p className="mt-2 text-sm text-muted">{description}</p>
        </div>
        {pendingOn.length > 0 ? (
          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple">
              Pending on
            </div>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink">
              {pendingOn.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {futureIncludes && futureIncludes.length > 0 ? (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple">
              Will include
            </div>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink">
              {futureIncludes.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
