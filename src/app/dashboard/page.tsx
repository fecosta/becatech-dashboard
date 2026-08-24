import Link from "next/link";
import { ExecTable, type ExecRow } from "@/components/ExecTable";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { SectionNav } from "@/components/SectionNav";
import { UniversityRetentionList } from "@/components/UniversityRetentionList";
import {
  AccessDenied,
  Card,
  FilterChipRow,
  HeroStat,
  PageHeader,
  ProxyBadge,
  SectionTitle,
  StatChip,
} from "@/components/ui";
import { PROGRESS_LABEL } from "@/lib/academic/academic-progress-label";
import { ENGLISH_LEVELS } from "@/lib/academic/english-level";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import {
  getAcademicProgressByCountry,
  getCohortRetention,
  getDataFreshness,
  getDropoutOverview,
  getEnglishLevelByCountry,
  getExecutiveOverview,
  getGpaByCohort,
  getOriginBreakdown,
  getScholarBaseCounts,
  getUniversityRetention,
  getVulnerabilityTiers,
} from "@/lib/dashboard/queries";
import type { OriginMatrix } from "@/lib/dashboard/types";
import { COUNTRY_LABEL } from "@/lib/labels";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";

const pctText = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/** Every program target in AUGUST 4 renders as pending: no approved figures exist, and a
 *  plausible-looking placeholder in a goal row is worse than an visible gap. */
const TARGET_PENDING = <ProxyBadge>PENDING</ProxyBadge>;

function OriginTable({ matrix, country }: { matrix: OriginMatrix; country: string }) {
  if (matrix.rows.length === 0) {
    return <p className="text-sm text-muted">No origin data for {country} in this selection.</p>;
  }
  return (
    <ExecTable
      headers={[country === "Colombia" ? "Department" : "Region", ...matrix.cohortYears, "Total"]}
      rows={[
        ...matrix.rows.map<ExecRow>((r) => ({
          key: r.origin,
          label: r.origin,
          cells: [...matrix.cohortYears.map((y) => fmtInt(r.counts[y] ?? 0)), fmtInt(r.total)],
        })),
        {
          key: "total",
          label: "TOTAL",
          summary: country === "Colombia" ? "col" : "per",
          cells: [
            ...matrix.cohortYears.map((y) => fmtInt(matrix.total.counts[y] ?? 0)),
            fmtInt(matrix.total.total),
          ],
        },
      ]}
      caption={
        matrix.notReported > 0
          ? `${fmtInt(matrix.notReported)} scholar(s) did not report an origin and are excluded.`
          : undefined
      }
    />
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_DASHBOARD);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Beca Tech+" />
        <AccessDenied />
      </div>
    );
  }

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [
    o,
    base,
    dropouts,
    retention,
    tiers,
    origins,
    universities,
    progress,
    english,
    gpa,
    freshness,
  ] = await Promise.all([
    getExecutiveOverview(filters),
    getScholarBaseCounts(filters),
    getDropoutOverview(filters),
    getCohortRetention(filters),
    getVulnerabilityTiers(filters),
    getOriginBreakdown(filters),
    getUniversityRetention(filters),
    getAcademicProgressByCountry(filters),
    getEnglishLevelByCountry(filters),
    getGpaByCohort(filters),
    getDataFreshness(new Date()),
  ]);

  const scopeChips = [
    { label: `Cohort: ${filters.cohort ?? "all"}`, tone: "black" as const },
    { label: `Country: ${filters.country ? COUNTRY_LABEL[filters.country] : "all"}`, tone: "green" as const },
    { label: `University: ${filters.university ?? "all"}`, tone: "ghost" as const },
  ];

  const retentionRows: ExecRow[] = [
    ...retention.rows.map<ExecRow>((r) => ({
      key: `${r.cohort}-${r.country}`,
      label: `${r.cohort} · ${COUNTRY_LABEL[r.country]}`,
      cells: [fmtInt(r.settled), fmtInt(r.active), `${r.retentionPct}%`],
    })),
    ...(retention.overall
      ? [
          {
            key: "actual",
            label: "OVERALL · ACTUAL",
            summary: "actual" as const,
            cells: [
              fmtInt(retention.overall.settled),
              fmtInt(retention.overall.active),
              `${retention.overall.retentionPct}%`,
            ],
          },
          {
            key: "target",
            label: "OVERALL · TARGET",
            summary: "goal" as const,
            cells: ["", "", TARGET_PENDING],
          },
        ]
      : []),
    ...retention.byCountry.map<ExecRow>((c) => ({
      key: `country-${c.country}`,
      label: `OVERALL · ${COUNTRY_LABEL[c.country].toUpperCase()}`,
      summary: c.country === "COLOMBIA" ? "col" : "per",
      cells: ["", "", `${c.retentionPct}%`],
    })),
  ];

  return (
    <div>
      {/* "Data as of {period}" is the latest data MONTH; the freshness badge below is the real
          last-sync time (last committed import/sync) plus paused/stale operational states. */}
      <PageHeader
        title="Beca Tech+"
        tag={`Data as of ${o.currentPeriod}`}
        subtitle="A scholarship program supporting talented, low-income students from Colombia and Peru through technology degrees."
      />
      <div className="-mt-3 mb-5">
        <FreshnessBadge freshness={freshness} />
      </div>

      <SectionTitle size="lg">How Do We Support Scholars?</SectionTitle>
      <Card className="flex flex-wrap items-center justify-between gap-5">
        <p className="max-w-[440px] text-sm leading-relaxed text-muted">
          Every scholar moves through two stages of support, each with its own goals and metrics —
          explore them in detail.
        </p>
        <div className="flex flex-wrap gap-3.5">
          <Link
            href="/dashboard/early-support"
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple px-[22px] py-3 text-[13.5px] font-bold text-white hover:opacity-90"
          >
            Early Support →
          </Link>
          <Link
            href="/dashboard/career-readiness"
            className="inline-flex items-center gap-1.5 rounded-xl bg-green px-[22px] py-3 text-[13.5px] font-bold text-white hover:opacity-90"
          >
            Growth &amp; Development →
          </Link>
        </div>
      </Card>

      {/* ---------- 1 · Our Scholars ---------- */}
      <SectionTitle size="lg" id="home-sec-1">
        1 · Our Scholars
      </SectionTitle>
      <FilterChipRow chips={scopeChips} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-l-4 border-l-purple">
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <div className="text-[13.5px] font-bold text-surface-dark">Total Scholars</div>
            <div className="text-xs text-muted">
              {fmtInt(base.cohortCount)} cohort{base.cohortCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="mb-3.5 text-4xl font-extrabold text-purple">
            {fmtInt(base.selectedTotal)}{" "}
            <span className="text-sm font-bold text-muted">selected</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <StatChip tone="green" value={fmtInt(base.activeTotal)} label="Active today" />
          </div>
          <p className="mt-3.5 text-xs text-muted">
            &ldquo;Selected&rdquo; is every scholar on record. The source tracks only active and
            withdrawn, so there is no separate admitted-but-never-started count.
          </p>
        </Card>

        <Card className="border-l-4 border-l-green">
          <div className="mb-3.5 text-[13.5px] font-bold text-surface-dark">Active Women</div>
          <div className="mb-3.5 text-4xl font-extrabold text-green-dark">
            {fmtInt(base.womenActive.total)}
          </div>
          <div className="flex flex-wrap gap-4">
            <StatChip tone="green" value={fmtInt(base.womenActive.colombia)} label="Colombia" />
            <StatChip tone="green" value={fmtInt(base.womenActive.peru)} label="Peru" />
          </div>
        </Card>
      </div>

      <Card className="mt-3.5">
        <div className="mb-3 text-[13.5px] font-bold text-surface-dark">Total by Cohort</div>
        <ExecTable
          headers={["Cohort / Country", "Selected", "Active"]}
          rows={[
            ...base.byCohortCountry.map<ExecRow>((r) => ({
              key: `${r.cohort}-${r.country}`,
              label: `${r.cohort} · ${COUNTRY_LABEL[r.country]}`,
              cells: [fmtInt(r.selected), fmtInt(r.active)],
            })),
            {
              key: "total",
              label: "TOTAL",
              summary: "goal",
              cells: [fmtInt(base.selectedTotal), fmtInt(base.activeTotal)],
            },
          ]}
        />
      </Card>

      {/* ---------- 2 · Drop Outs ---------- */}
      <SectionTitle size="lg" id="home-sec-2">
        2 · Drop Outs
      </SectionTitle>
      <FilterChipRow chips={scopeChips} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <div className="text-[13.5px] font-bold text-surface-dark">Total Scholars Withdrawn</div>
            <div className="text-xs text-muted">cumulative</div>
          </div>
          <div className="mb-1.5 text-[32px] font-extrabold text-[#d33636]">
            {fmtInt(dropouts.withdrawnTotal)}
          </div>
          <p className="text-xs text-muted">
            {dropouts.withdrawnPct}% of {fmtInt(dropouts.selectedTotal)} selected — both countries
            combined.
          </p>
        </Card>
        <Card>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <div className="text-[13.5px] font-bold text-surface-dark">Total Women Withdrawn</div>
            <div className="text-xs text-muted">cumulative</div>
          </div>
          <div className="mb-1.5 text-[32px] font-extrabold text-[#d33636]">
            {fmtInt(dropouts.withdrawnWomen)}
          </div>
          <p className="text-xs text-muted">
            {fmtInt(dropouts.withdrawnWomen)} of {fmtInt(dropouts.withdrawnTotal)} withdrawn scholars
            are women.
          </p>
        </Card>
      </div>
      <Card className="mt-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[13.5px] font-bold text-surface-dark">
            Main Reasons for Drop Out
          </div>
          <p className="max-w-[620px] text-xs text-muted">
            No source records why a scholar left. Mentor reports carry risk reasons, but only for the
            current semester, so they say nothing about scholars who withdrew earlier. This needs an
            exit-reason column on the scholar sheet.
          </p>
        </div>
        <ProxyBadge>PENDING</ProxyBadge>
      </Card>

      {/* ---------- 3 · Program Retention ---------- */}
      <SectionTitle size="lg" id="home-sec-3" note="— share of settled scholars still active">
        3 · Program Retention
      </SectionTitle>
      <FilterChipRow chips={scopeChips} />
      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          size="mini"
          tone="purple"
          value={retention.overall ? `${retention.overall.retentionPct}%` : "—"}
          label="Overall program retention"
        />
        {retention.byCohortYear.slice(0, 3).map((y, i) => (
          <HeroStat
            key={y.year}
            size="mini"
            tone={(["black", "green", "yellow"] as const)[i]}
            value={`${y.retentionPct}%`}
            label={`${y.year} cohort retention`}
          />
        ))}
      </div>
      <Card>
        <ExecTable
          headers={["Cohort / Country", "Settled", "Active", "Retention"]}
          rows={retentionRows}
          caption="Retention is over the settled population — active plus withdrawn. Paused and graduated scholars are not a retention outcome either way."
        />
        <div className="mt-3.5 rounded-xl bg-chip-cream px-3.5 py-3 text-xs text-muted">
          <b className="text-ink">Term-by-term retention is not shown.</b> The design tracks each
          cohort across semesters, but the source cannot support it: &ldquo;Not applicable for this
          semester&rdquo; means both &ldquo;had not started&rdquo; and &ldquo;already left&rdquo;,
          future terms are pre-filled, and some withdrawn scholars still read as enrolled. It needs
          an exit term recorded per scholar.
        </div>
      </Card>

      {/* ---------- 4 · Vulnerability Level ---------- */}
      <SectionTitle size="lg" id="home-sec-4" note="— income classification, both countries">
        4 · Vulnerability Level
      </SectionTitle>
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="max-w-[720px] text-sm text-muted">
            The source already carries one harmonised scale for both countries, so the numbers are
            available. What is not settled is the naming: the design relabels the lowest band
            &ldquo;Vulnerable&rdquo;, which reverses what that row says about the scholars in it.
            Publishing tier percentages under unapproved labels would put words in the
            program&rsquo;s mouth.
          </p>
          {tiers.overall ? (
            <p className="mt-2 text-xs text-muted">
              {fmtInt(tiers.overall.classified)} scholars classified,{" "}
              {fmtInt(tiers.overall.unclassified)} still marked pending at source.
            </p>
          ) : null}
        </div>
        <ProxyBadge>PENDING</ProxyBadge>
      </Card>

      {/* ---------- 5 · Where Our Scholars Are From ---------- */}
      <SectionTitle size="lg" id="home-sec-5" note="— department or region of origin">
        5 · Where Our Scholars Are From
      </SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-[13.5px] font-bold text-surface-dark">
            Colombia — by department of origin
          </div>
          <OriginTable matrix={origins.colombia} country="Colombia" />
        </Card>
        <Card>
          <div className="mb-3 text-[13.5px] font-bold text-surface-dark">
            Peru — by region of origin
          </div>
          <OriginTable matrix={origins.peru} country="Peru" />
        </Card>
      </div>
      <p className="mt-2.5 text-xs text-muted">
        Where the scholar was born or grew up — not necessarily where they study today.
      </p>

      {/* ---------- 6 · Program Satisfaction ---------- */}
      <SectionTitle size="lg" id="home-sec-6">
        6 · Program Satisfaction
      </SectionTitle>
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[720px] text-sm text-muted">
          No survey data source yet — pending an approved satisfaction formula. The design marks this
          section a proxy for the same reason.
        </p>
        <ProxyBadge>PROXY</ProxyBadge>
      </Card>

      {/* ---------- 7 · Retention & Dropout by University ---------- */}
      <SectionTitle size="lg" id="home-sec-7">
        7 · Retention &amp; Dropout Rate by University
      </SectionTitle>
      <Card className="p-6">
        {universities.length === 0 ? (
          <p className="text-sm text-muted">No universities in scope for this selection.</p>
        ) : (
          <UniversityRetentionList data={universities} />
        )}
      </Card>

      {/* ---------- 8 · Academic Progress ---------- */}
      <SectionTitle size="lg" id="home-sec-8">
        8 · Academic Progress
      </SectionTitle>
      <Card>
        <div className="mb-3 text-[13.5px] font-bold text-surface-dark">8.1 Academic Standing</div>
        <ExecTable
          headers={["Country", ...Object.values(PROGRESS_LABEL), "Not reported"]}
          rows={progress.map<ExecRow>((r) => ({
            key: String(r.country),
            label: r.country === "ALL" ? "ALL COUNTRIES" : COUNTRY_LABEL[r.country],
            summary: r.country === "ALL" ? "actual" : undefined,
            cells: [
              pctText(r.onTrack, r.classified),
              pctText(r.behind, r.classified),
              pctText(r.critical, r.classified),
              fmtInt(r.pending + r.notApplicable + r.unknown),
            ],
          }))}
          caption="Percentages are over scholars with a reported standing; the last column is how many are not yet reported. Computed by the program, not by the universities."
        />
      </Card>

      <Card className="mt-3.5">
        <div className="mb-3 text-[13.5px] font-bold text-surface-dark">8.2 English Level</div>
        <ExecTable
          headers={["Country", ...ENGLISH_LEVELS, "Reported"]}
          rows={english.map<ExecRow>((r) => ({
            key: String(r.country),
            label: r.country === "ALL" ? "ALL COUNTRIES" : COUNTRY_LABEL[r.country],
            summary: r.country === "ALL" ? "actual" : undefined,
            cells: [
              ...ENGLISH_LEVELS.map((l) => pctText(r.counts[l], r.classified)),
              `${fmtInt(r.classified)} / ${fmtInt(
                r.classified + r.pending + r.notApplicable + r.unrecognized,
              )}`,
            ],
          }))}
          caption="A1–B1: developing proficiency · B2–C2: professional working proficiency. Percentages are over scholars with a level on record — the last column shows how many that is. Reported by the universities, not measured by the program."
        />
      </Card>

      <div className="mt-3.5 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-[13.5px] font-bold text-surface-dark">
            8.3 Average GPA — Colombia
          </div>
          <ExecTable
            headers={["Cohort", "GPA", "Scholars"]}
            rows={[
              ...gpa.colombia.rows.map<ExecRow>((r) => ({
                key: r.cohort,
                label: r.cohort,
                cells: [r.average ?? "—", fmtInt(r.count)],
              })),
              {
                key: "avg",
                label: "COLOMBIA AVERAGE",
                summary: "col",
                cells: [
                  gpa.colombia.overall != null
                    ? `${gpa.colombia.overall} / ${gpa.colombia.scale}`
                    : "—",
                  "",
                ],
              },
            ]}
            empty="No Colombia GPA on record for this selection."
          />
        </Card>
        <Card>
          <div className="mb-3 text-[13.5px] font-bold text-surface-dark">8.4 Average GPA — Peru</div>
          <ExecTable
            headers={["Cohort", "GPA", "Scholars"]}
            rows={[
              ...gpa.peru.rows.map<ExecRow>((r) => ({
                key: r.cohort,
                label: r.cohort,
                cells: [r.average ?? "—", fmtInt(r.count)],
              })),
              {
                key: "avg",
                label: "PERU AVERAGE",
                summary: "per",
                cells: [
                  gpa.peru.overall != null ? `${gpa.peru.overall} / ${gpa.peru.scale}` : "—",
                  "",
                ],
              },
            ]}
            empty="No Peru GPA on record for this selection."
          />
        </Card>
      </div>
      <p className="mt-2.5 text-xs text-muted">
        Colombia grades on 0–5, Peru on 0–20 — different systems, never blended into one average.
        {gpa.excludedZeroGpaCount > 0
          ? ` ${fmtInt(gpa.excludedZeroGpaCount)} term(s) recorded as 0 (not enrolled) are excluded.`
          : ""}
      </p>

      <SectionNav current="/dashboard" sp={sp} user={user} />
    </div>
  );
}
