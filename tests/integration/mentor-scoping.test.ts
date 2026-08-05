import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/auth/authorization";
import { getRiskAlerts, getScholarDirectory, getScholarProfile } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/db";
import { resetDb, seedAmbiguousNamesake, seedFixture } from "./helpers";

// seedFixture() creates scholar BT-CO-001; seedAmbiguousNamesake() adds BT-CO-002. A mentor
// assigned only to BT-CO-001 must never see BT-CO-002 in ANY server-side query — enforcement
// lives in the query layer, not just the UI.
const mentor: CurrentUser = {
  id: "mentor-1",
  email: "mentor1@becatech.test",
  role: "MENTOR",
  assignedScholarIds: ["BT-CO-001"],
};

const admin: CurrentUser = {
  id: "admin-1",
  email: "admin@becatech.test",
  role: "ANALYST_ADMIN",
  assignedScholarIds: [],
};

beforeEach(async () => {
  await resetDb();
  await seedFixture();
  await seedAmbiguousNamesake();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("mentor scholar-access scoping (server-side)", () => {
  it("scholar directory returns only the mentor's assigned scholars", async () => {
    const rows = await getScholarDirectory({}, undefined, mentor);
    expect(rows.map((r) => r.scholarId)).toEqual(["BT-CO-001"]);
  });

  it("an admin sees every scholar in the directory", async () => {
    const rows = await getScholarDirectory({}, undefined, admin);
    expect(rows.map((r) => r.scholarId).sort()).toEqual(["BT-CO-001", "BT-CO-002"]);
  });

  it("the risk-alert list never includes an unassigned scholar for a mentor", async () => {
    // Give BT-CO-002 a current risk row so it WOULD surface if scoping were missing.
    await prisma.riskAssessment.create({
      data: {
        scholarId: "BT-CO-002",
        period: "2026-06",
        academicRiskLevel: "CRITICO",
        academicRiskValue: 4,
        psychosocialRiskLevel: "SIN_RIESGO",
        psychosocialRiskValue: 0,
        participationRiskLevel: "SIN_RIESGO",
        participationRiskValue: 0,
        globalRiskLevel: "CRITICO",
        globalRiskValue: 4,
      },
    });
    const result = await getRiskAlerts({}, mentor);
    expect(result.attentionList.some((r) => r.scholarId === "BT-CO-002")).toBe(false);
  });

  it("a mentor cannot load an unassigned scholar's profile (returns null, like not-found)", async () => {
    expect(await getScholarProfile("BT-CO-002", mentor)).toBeNull();
  });

  it("a mentor can load their own assigned scholar's profile", async () => {
    const profile = await getScholarProfile("BT-CO-001", mentor);
    expect(profile?.scholarId).toBe("BT-CO-001");
  });

  it("an admin can load any scholar's profile", async () => {
    expect((await getScholarProfile("BT-CO-002", admin))?.scholarId).toBe("BT-CO-002");
  });
});
