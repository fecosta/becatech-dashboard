import { FeaturePlaceholder } from "@/components/FeaturePlaceholder";
import { AccessDenied, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Temporary gating: same permission as Tracking (VIEW_SCHOLAR_TRACKING) per the
// implementation prompt §4.3. A dedicated Actors permission is defined in a later
// phase, once real University/Operator content exists.
export default async function ActorsPage() {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Actores" />
        <AccessDenied />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Actores"
        subtitle="Universidades aliadas y operadores del ecosistema del programa"
      />
      <FeaturePlaceholder
        title="Actores — Universidades y operadores"
        description="Aquí se mostrará el ecosistema del programa: universidades aliadas y operadores. Aún no hay datos reales que mostrar."
        pendingOn={["Modelos de Universidad y Operador (fase futura)"]}
        futureIncludes={[
          "Universidades aliadas: número de becarios, GPA, retención, riesgo, calendario académico y periodos de exámenes",
          "Operadores: becarios asignados, satisfacción, participación, tiempo de respuesta e indicadores de calidad",
        ]}
      />
    </div>
  );
}
