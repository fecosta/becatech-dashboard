import { type Column, DataTable } from "@/components/DataTable";
import { AccessDenied, Badge, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import {
  DATA_QUALITY_ISSUE_LABEL,
  DATA_QUALITY_SEVERITY_LABEL,
  DATA_QUALITY_SEVERITY_TONE,
  DATA_QUALITY_STATUS_LABEL,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

type IssueRow = {
  id: string;
  issueType: string;
  sourceName: string | null;
  scholarId: string | null;
  issueDescription: string;
  severity: string | null;
  owner: string | null;
  status: string;
  resolvedAt: Date | null;
};

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const columns: Column<IssueRow>[] = [
  {
    header: "Issue",
    cell: (r) => (
      <div>
        <div className="font-medium text-ink">
          {DATA_QUALITY_ISSUE_LABEL[r.issueType] ?? r.issueType}
        </div>
        <div className="text-xs text-slate-400">{r.issueDescription}</div>
      </div>
    ),
  },
  { header: "Source", cell: (r) => r.sourceName ?? <span className="text-slate-300">—</span> },
  {
    header: "Severity",
    cell: (r) =>
      r.severity ? (
        <Badge tone={DATA_QUALITY_SEVERITY_TONE[r.severity] ?? "slate"}>
          {DATA_QUALITY_SEVERITY_LABEL[r.severity] ?? r.severity}
        </Badge>
      ) : (
        <span className="text-slate-300">—</span>
      ),
  },
  { header: "Owner", cell: (r) => r.owner ?? <span className="text-slate-300">—</span> },
  { header: "Status", cell: (r) => DATA_QUALITY_STATUS_LABEL[r.status] ?? r.status },
  { header: "Resolved", cell: (r) => (r.resolvedAt ? fmtDate(r.resolvedAt) : <span className="text-slate-300">—</span>) },
];

export default async function DataQualityPage() {
  const { allowed } = await requirePermission(Permission.VIEW_IMPORTS);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Data Quality" />
        <AccessDenied message="Only the Analyst / Admin role (and Program Manager, read-only) can view data quality." />
      </div>
    );
  }

  const issues = await prisma.dataQualityIssue.findMany({
    select: {
      id: true,
      issueType: true,
      sourceName: true,
      scholarId: true,
      issueDescription: true,
      severity: true,
      owner: true,
      status: true,
      resolvedAt: true,
    },
  });

  // Most severe first, then most recently detected (createdAt not selected — sort by severity only).
  const rows = [...issues].sort(
    (a, b) => (SEVERITY_RANK[a.severity ?? ""] ?? 3) - (SEVERITY_RANK[b.severity ?? ""] ?? 3),
  );

  const open = rows.filter((r) => r.status === "OPEN").length;

  return (
    <div>
      <PageHeader
        title="Data Quality"
        subtitle={`${rows.length} issue(s) detected · ${open} open`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        empty="No data quality issues detected. Run an import or the scan to refresh."
      />
    </div>
  );
}
