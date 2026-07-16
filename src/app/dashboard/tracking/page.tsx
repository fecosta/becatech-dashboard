import { Suspense } from "react";
import { FeaturePlaceholder } from "@/components/FeaturePlaceholder";
import { TrackingTabs } from "@/components/TrackingTabs";
import { AccessDenied, Card, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { type SearchParams } from "@/lib/dashboard/filters";
import { parseTrackingTab, TRACKING_TAB_LABEL } from "@/lib/dashboard/tracking";

export const dynamic = "force-dynamic";

// Transient placeholder for tabs whose real content lands in sprint A3 (Summary,
// Scholar Progress). Neutral copy — not the FeaturePlaceholder "future feature" framing.
function ComingSoon() {
  return (
    <Card>
      <div className="py-8 text-center text-sm text-slate-500">Disponible próximamente.</div>
    </Card>
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

  return (
    <div>
      <PageHeader title="Seguimiento" subtitle={TRACKING_TAB_LABEL[tab]} />
      <Suspense fallback={<div className="mb-6 h-10" />}>
        <TrackingTabs />
      </Suspense>

      {tab === "summary" ? <ComingSoon /> : null}
      {tab === "scholars" ? <ComingSoon /> : null}
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
