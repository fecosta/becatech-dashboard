import { Suspense } from "react";
import { FeaturePlaceholder } from "@/components/FeaturePlaceholder";
import { ScholarDirectory } from "@/components/ScholarDirectory";
import { TrackingTabs } from "@/components/TrackingTabs";
import { AccessDenied, KpiCard, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getExecutiveOverview } from "@/lib/dashboard/queries";
import { parseTrackingTab, TRACKING_TAB_LABEL } from "@/lib/dashboard/tracking";
import { fmtGpa, fmtInt, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

// Compact operational summary for the currently selected group — reuses the same
// query as Home (no duplicated aggregation logic in the page).
async function SummaryTab({ filters }: { filters: ReturnType<typeof parseFilters> }) {
  const o = await getExecutiveOverview(filters);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard label="Becarios activos" value={fmtInt(o.activeScholars)} sub={`${fmtInt(o.totalScholars)} en total`} />
      <KpiCard label="Retiros" value={fmtInt(o.withdrawnScholars)} sub="En el grupo seleccionado" />
      <KpiCard label="Retención" value={fmtPct(o.retentionRate)} sub="Activos + pausa + graduados" />
      <KpiCard label="Satisfacción" value="—" sub="Fuente de datos pendiente" />
      <KpiCard label="GPA promedio" value={fmtGpa(o.averageGpa)} sub="Escala 0–5" />
    </div>
  );
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  const sp = await searchParams;
  const tab = parseTrackingTab(sp.tab);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Seguimiento" />
        <AccessDenied />
      </div>
    );
  }

  const filters = parseFilters(sp);
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;

  return (
    <div>
      <PageHeader title="Seguimiento" subtitle={TRACKING_TAB_LABEL[tab]} />
      <Suspense fallback={<div className="mb-6 h-10" />}>
        <TrackingTabs />
      </Suspense>

      {tab === "summary" ? <SummaryTab filters={filters} /> : null}
      {tab === "scholars" ? <ScholarDirectory filters={filters} q={q} /> : null}
      {tab === "years-1-2" ? (
        <FeaturePlaceholder
          title="Años 1–2 — Acompañamiento académico y psicosocial"
          description="Aquí se identificará qué becarios de los primeros años necesitan apoyo académico o psicosocial, y por qué."
          pendingOn={["Regla de etapa del programa (Años 1–2 vs. Años 3–5) por aprobar"]}
          futureIncludes={[
            "Distribución de riesgo (medio / alto / crítico)",
            "Alertas académicas vs. psicosociales",
            "Cobertura de check-ins y reportes de mentoría",
            "Avance vs. ritmo esperado",
            "Lista de atención con acción recomendada y responsable",
          ]}
        />
      ) : null}
      {tab === "years-3-5" ? (
        <FeaturePlaceholder
          title="Años 3–5 — Desarrollo profesional"
          description="Aquí se seguirá el avance de los becarios en la trayectoria de desarrollo profesional."
          pendingOn={["Definición de los KPIs de desarrollo profesional"]}
          futureIncludes={[
            "Avance vs. ritmo esperado",
            "Participación",
            "Desarrollo de inglés",
            "Prácticas y empleabilidad",
            "Emprendimiento y liderazgo",
          ]}
        />
      ) : null}
    </div>
  );
}
