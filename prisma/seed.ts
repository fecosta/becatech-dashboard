// Demo seed for the Beca Tech dashboard — ~100 fake scholars plus related records.
// Run with: npm run db:seed   (or npm run db:reset to re-migrate + reseed)
//
// Idempotent: clears existing data then reseeds. Uses a fixed RNG seed so runs are
// reproducible. NO real personal data — names, notes and scores are synthetic.
//
// `import "dotenv/config"` must stay first so DATABASE_URL is loaded before src/lib/db
// (which builds the Prisma pg adapter at module load) is evaluated.
import "dotenv/config";
import { deriveExpectedProgressStatus } from "../src/lib/academic/progress";
import { prisma } from "../src/lib/db";
import {
  computeAlertType,
  computeGlobalRiskValue,
  computeRiskChange,
  riskChangeLabel,
  riskLevelFromValue,
} from "../src/lib/risk/risk";
import type { Prisma } from "../src/generated/prisma/client";
import {
  ActivityType,
  AlertType,
  Country,
  ProgramStatus,
  RequestStatus,
  ReviewStatus,
  SelectionStage,
  UserRole,
} from "../src/generated/prisma/enums";

// ------------------------------------------------------------------
// Deterministic RNG + helpers
// ------------------------------------------------------------------
function makeRng(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRng(20260702);

const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const round2 = (n: number) => Math.round(n * 100) / 100;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function weightedIndex(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    if ((r -= weights[i]) < 0) return i;
  }
  return weights.length - 1;
}
function weighted<T>(pairs: [T, number][]): T {
  return pairs[weightedIndex(pairs.map((p) => p[1]))][0];
}

const monthToDate = (period: string, day = 15): Date => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};
const jitterDate = (base: Date, maxDays: number): Date =>
  new Date(base.getTime() + randInt(0, maxDays) * 24 * 60 * 60 * 1000);

// ------------------------------------------------------------------
// Reference data (all synthetic)
// ------------------------------------------------------------------
const FIRST_NAMES = [
  "Ana", "Luis", "María", "Carlos", "Valentina", "Santiago", "Camila", "Andrés",
  "Daniela", "Juan", "Sofía", "Miguel", "Laura", "Diego", "Gabriela", "Sebastián",
  "Isabella", "Mateo", "Lucía", "Nicolás", "Paula", "Felipe", "Sara", "David",
  "Manuela", "Alejandro", "Valeria", "Samuel", "Antonella", "Emilio",
] as const;
const LAST_NAMES = [
  "García", "Rodríguez", "Martínez", "López", "González", "Pérez", "Sánchez",
  "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Vargas", "Castro",
  "Romero", "Suárez", "Álvarez", "Mendoza", "Rojas", "Moreno", "Muñoz", "Ortiz",
  "Delgado", "Guerrero", "Medina", "Cruz", "Reyes", "Aguilar", "Paredes",
] as const;

const COLOMBIA_UNIS = [
  "Universidad Nacional de Colombia", "Universidad de los Andes", "Universidad del Valle",
  "Universidad de Antioquia", "Pontificia Universidad Javeriana",
  "Universidad Industrial de Santander",
] as const;
const PERU_UNIS = [
  "Pontificia Universidad Católica del Perú", "Universidad Nacional Mayor de San Marcos",
  "Universidad de Ingeniería y Tecnología", "Universidad del Pacífico",
  "Universidad Nacional de Ingeniería", "Universidad Peruana Cayetano Heredia",
] as const;

const PROGRAMS = [
  "Computer Science", "Software Engineering", "Data Science", "Systems Engineering",
  "Industrial Engineering", "Electronic Engineering", "Mathematics", "Statistics",
  "Artificial Intelligence", "Information Systems",
] as const;

const COLOMBIA_DEPTS: Record<string, string> = {
  "Bogotá D.C.": "Bogotá", Antioquia: "Medellín", "Valle del Cauca": "Cali",
  Atlántico: "Barranquilla", Santander: "Bucaramanga", Cundinamarca: "Soacha",
  Bolívar: "Cartagena",
};
const PERU_DEPTS: Record<string, string> = {
  Lima: "Lima", Arequipa: "Arequipa", Cusco: "Cusco", "La Libertad": "Trujillo",
  Piura: "Piura", Junín: "Huancayo", Lambayeque: "Chiclayo",
};

const GENDERS: [string, number][] = [
  ["Female", 0.48], ["Male", 0.48], ["Non-binary", 0.02], ["Prefer not to say", 0.02],
];
const ETHNIC_GROUPS = [
  "Mestizo", "Afrodescendiente", "Indígena", "Blanco", "Otro", "Prefiere no responder",
] as const;

const MENTORS = [
  { id: "user-mentor-1", name: "Paola Jiménez", email: "mentor1@becatech.test" },
  { id: "user-mentor-2", name: "Ricardo Salazar", email: "mentor2@becatech.test" },
  { id: "user-mentor-3", name: "Natalia Vega", email: "mentor3@becatech.test" },
  { id: "user-mentor-4", name: "Óscar Cabrera", email: "mentor4@becatech.test" },
  { id: "user-mentor-5", name: "Carolina Ríos", email: "mentor5@becatech.test" },
  { id: "user-mentor-6", name: "Julián Ospina", email: "mentor6@becatech.test" },
] as const;

const PM_NAMES = ["Carlos Méndez", "Lucía Fernández"] as const;

const ALL_MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"] as const;

const ACTIVITY_TYPES = [
  ActivityType.INDIVIDUAL_TUTORING, ActivityType.GROUP_TUTORING,
  ActivityType.INDIVIDUAL_MENTORING, ActivityType.GROUP_MENTORING,
  ActivityType.WORKSHOP, ActivityType.PSYCHOSOCIAL_SUPPORT,
  ActivityType.INDIVIDUAL_SESSION, ActivityType.OTHER,
] as const;

const RISK_REASON_BY_ALERT: Record<AlertType, string> = {
  ACADEMIC: "Bajo rendimiento académico y materias en riesgo.",
  PSYCHOSOCIAL: "Señales de afectación emocional reportadas en el check-in.",
  PARTICIPATION: "Baja participación en actividades de acompañamiento.",
  PERMANENCE: "Factores combinados que comprometen la permanencia.",
  COMBINED: "Dificultades relevantes en varias dimensiones simultáneamente.",
  NONE: "Sin señales de riesgo relevantes.",
};
const RECOMMENDED_ACTION_BY_VALUE = [
  "Seguimiento regular.",
  "Monitoreo y recordatorio de recursos disponibles.",
  "Agendar tutoría/mentoría y seguimiento mensual.",
  "Plan de acompañamiento intensivo y contacto con bienestar.",
  "Intervención inmediata y evaluación de permanencia.",
];

const LEVEL_LABELS = ["Alto", "Medio", "Bajo"] as const;
const ACADEMIC_SELF = [
  "Me ha ido bien en la mayoría de materias.",
  "He tenido algunas dificultades puntuales.",
  "Estoy atrasado en un par de cursos.",
  "Voy al día con el plan de estudios.",
] as const;
const EMOTIONAL_SELF = [
  "Me he sentido tranquilo y motivado.",
  "He tenido semanas de estrés por los exámenes.",
  "Me he sentido algo abrumado últimamente.",
  "En general estable, con buen ánimo.",
] as const;
const EXTERNAL_FACTOR = [
  "Nada relevante este mes.",
  "Temas familiares que ocupan mi atención.",
  "Dificultades económicas puntuales.",
  "Adaptación a una nueva ciudad.",
] as const;
const SESSION_SUMMARIES = [
  "Revisamos el avance académico y organizamos el plan de estudio.",
  "Trabajamos estrategias de manejo del tiempo y motivación.",
  "Seguimiento a materias en riesgo y plan de nivelación.",
  "Conversación de bienestar y derivación a apoyo psicosocial.",
] as const;

// ------------------------------------------------------------------
// Wipe (child → parent order, independent of cascade rules)
// ------------------------------------------------------------------
async function clearAll() {
  await prisma.userScholarAccess.deleteMany();
  await prisma.selectionStageHistory.deleteMany();
  await prisma.selectionCandidate.deleteMany();
  await prisma.dataQualityIssue.deleteMany();
  await prisma.financialInput.deleteMany();
  await prisma.riskAssessment.deleteMany();
  await prisma.supportActivity.deleteMany();
  await prisma.scholarRequest.deleteMany();
  await prisma.mentorReport.deleteMany();
  await prisma.monthlyCheckin.deleteMany();
  await prisma.academicTerm.deleteMany();
  await prisma.rawJotformSubmission.deleteMany();
  await prisma.controlValue.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.scholar.deleteMany();
}

async function insertChunked<T>(
  create: (rows: T[]) => Promise<unknown>,
  rows: T[],
  size = 500,
) {
  for (let i = 0; i < rows.length; i += size) {
    await create(rows.slice(i, i + size));
  }
}

// ------------------------------------------------------------------
// Term sequences per cohort (brief §8.2: 2–5 terms)
// ------------------------------------------------------------------
function termsForCohort(cohort: string): string[] {
  if (cohort === "2024") {
    return ["2024-1", "2024-2", "2025-1", "2025-2", "2026-1"].slice(0, randInt(4, 5));
  }
  if (cohort === "2025") {
    return ["2025-1", "2025-2", "2026-1"].slice(0, randInt(2, 3));
  }
  return ["2026-1", "2026-2"]; // 2026 cohort
}

const NORMAL_STAGES: SelectionStage[] = [
  SelectionStage.APPLICATION_RECEIVED, SelectionStage.ELIGIBILITY_REVIEW,
  SelectionStage.ASSESSMENT, SelectionStage.INTERVIEW,
  SelectionStage.FINAL_COMMITTEE, SelectionStage.SELECTED,
];
function stagePath(current: SelectionStage): SelectionStage[] {
  const idx = NORMAL_STAGES.indexOf(current);
  if (idx >= 0) return NORMAL_STAGES.slice(0, idx + 1);
  // terminal REJECTED / WITHDRAWN: branch off after a normal (non-SELECTED) stage
  const branch = randInt(1, 4); // ELIGIBILITY_REVIEW .. FINAL_COMMITTEE
  return [...NORMAL_STAGES.slice(0, branch + 1), current];
}
const APPLICATION_BASE: Record<string, Date> = {
  "2024": new Date(Date.UTC(2023, 9, 1)),
  "2025": new Date(Date.UTC(2024, 9, 1)),
  "2026": new Date(Date.UTC(2025, 9, 1)),
};

// ------------------------------------------------------------------
// Seed
// ------------------------------------------------------------------
async function main() {
  console.log("Clearing existing data…");
  await clearAll();

  const scholars: Prisma.ScholarCreateManyInput[] = [];
  const academicTerms: Prisma.AcademicTermCreateManyInput[] = [];
  const checkins: Prisma.MonthlyCheckinCreateManyInput[] = [];
  const mentorReports: Prisma.MentorReportCreateManyInput[] = [];
  const supportActivities: Prisma.SupportActivityCreateManyInput[] = [];
  const riskAssessments: Prisma.RiskAssessmentCreateManyInput[] = [];
  const requests: Prisma.ScholarRequestCreateManyInput[] = [];
  const financialInputs: Prisma.FinancialInputCreateManyInput[] = [];
  const candidates: Prisma.SelectionCandidateCreateManyInput[] = [];
  const stageHistory: Prisma.SelectionStageHistoryCreateManyInput[] = [];
  const access: Prisma.UserScholarAccessCreateManyInput[] = [];

  // Distribution pools (exact counts), decorrelated from index via shuffle.
  const countryPool = shuffle([
    ...Array<Country>(60).fill(Country.COLOMBIA),
    ...Array<Country>(40).fill(Country.PERU),
  ]);
  const cohortPool = shuffle([
    ...Array<string>(35).fill("2024"),
    ...Array<string>(40).fill("2025"),
    ...Array<string>(25).fill("2026"),
  ]);
  const statusPool = shuffle([
    ...Array<ProgramStatus>(82).fill(ProgramStatus.ACTIVE),
    ...Array<ProgramStatus>(8).fill(ProgramStatus.WITHDRAWN),
    ...Array<ProgramStatus>(5).fill(ProgramStatus.PAUSED),
    ...Array<ProgramStatus>(5).fill(ProgramStatus.GRADUATED),
  ]);

  let checkinSeq = 0;
  let mentorSeq = 0;
  let requestSeq = 0;
  let activeIndex = -1;

  for (let i = 0; i < 100; i++) {
    const country = countryPool[i];
    const cohort = cohortPool[i];
    const programStatus = statusPool[i];
    const isActive = programStatus === ProgramStatus.ACTIVE;
    const countryCode = country === Country.COLOMBIA ? "CO" : "PE";
    const scholarId = `BT-${countryCode}-${String(i + 1).padStart(3, "0")}`;
    const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${pick(LAST_NAMES)}`;
    const university = pick(country === Country.COLOMBIA ? COLOMBIA_UNIS : PERU_UNIS);
    const academicProgram = pick(PROGRAMS);
    const deptMap = country === Country.COLOMBIA ? COLOMBIA_DEPTS : PERU_DEPTS;
    const department = pick(Object.keys(deptMap));
    const mentor = MENTORS[i % MENTORS.length];
    const durationYears = randInt(4, 5);
    const totalSemesters = durationYears * 2;
    const totalProgramCredits = randInt(140, 180);
    const terms = termsForCohort(cohort);
    const startYear = Number(cohort);
    const startDate = new Date(Date.UTC(startYear, 1, randInt(1, 20)));

    scholars.push({
      scholarId,
      fullName,
      country,
      cohort,
      university,
      academicProgram,
      gender: weighted(GENDERS),
      ethnicGroup: pick(ETHNIC_GROUPS),
      departmentOrigin: department,
      municipalityOrigin: deptMap[department],
      currentDepartment: department,
      currentMunicipality: deptMap[department],
      programStatus,
      currentSemester: terms.length,
      currentMentor: mentor.name,
      startDate,
      expectedEndDate: new Date(Date.UTC(startYear + durationYears, 11, 15)),
      driveFolderUrl: `https://drive.google.com/drive/folders/demo-${scholarId}`,
    });

    // ---- Academic terms ----
    let accumulatedCredits = 0;
    let gpaSum = 0;
    const perTermCredits = Math.max(10, Math.round(totalProgramCredits / totalSemesters));
    terms.forEach((term, t) => {
      const failed = weighted<number>([[0, 0.55], [1, 0.25], [2, 0.12], [3, 0.05], [4, 0.03]]);
      const creditsEnrolled = Math.max(6, perTermCredits + randInt(-3, 3));
      const creditsCompleted = Math.max(0, creditsEnrolled - failed * 3);
      accumulatedCredits += creditsCompleted;
      const gpa = round2(2.5 + rand() * 2.5); // 2.5–5.0
      gpaSum += gpa;
      const progressPercentage = round2(
        Math.min(100, (accumulatedCredits / totalProgramCredits) * 100),
      );
      const expectedProgressPct = round2(((t + 1) / totalSemesters) * 100);
      academicTerms.push({
        scholarId,
        term,
        enrollmentStatus: isActive ? "Matriculado" : programStatus === "WITHDRAWN" ? "Retirado" : "Aplazado",
        creditsEnrolled,
        creditsCompleted,
        accumulatedCredits,
        totalProgramCredits,
        progressPercentage,
        gpa,
        accumulatedGpa: round2(gpaSum / (t + 1)),
        failedSubjectsCount: failed,
        failedSubjectsDetail: failed > 0 ? `${failed} materia(s) reprobada(s)` : null,
        delayedSubjects: failed > 1 ? "Cálculo, Física" : null,
        levelingAlternative: failed > 0 ? "Curso intersemestral" : null,
        isLeveling: failed > 0 && chance(0.5),
        maxDeadline: failed > 0 ? new Date(Date.UTC(startYear + durationYears + 1, 5, 30)) : null,
        receivedSupport: chance(0.6),
        expectedProgressStatus: deriveExpectedProgressStatus(progressPercentage, expectedProgressPct),
        academicStatus: gpa >= 4 ? "Al día" : gpa >= 3.2 ? "Con observaciones" : "En riesgo",
        source: "seed:excel-general-info",
      });
    });

    // ---- Data-quality gap flags (only meaningful for active scholars) ----
    if (isActive) activeIndex++;
    const noCheckins = isActive && activeIndex % 12 === 3; // ~7 scholars
    const checkinMissingLatest = isActive && activeIndex % 6 === 2; // ~13 scholars
    const noMentorReports = isActive && activeIndex % 12 === 7; // ~7 scholars
    const mentorMissingLatest = isActive && activeIndex % 6 === 4; // ~13 scholars
    const lowParticipation = isActive && activeIndex % 7 === 1; // ~11 scholars

    // ---- Monthly check-ins (active scholars) ----
    if (isActive && !noCheckins) {
      const available = checkinMissingLatest ? ALL_MONTHS.slice(0, 5) : [...ALL_MONTHS];
      const count = randInt(3, available.length);
      const months = available.slice(available.length - count);
      for (const month of months) {
        checkinSeq++;
        checkins.push({
          scholarId,
          country,
          cohort,
          university,
          reportingMonth: month,
          submissionDate: monthToDate(month, randInt(3, 26)),
          scholarName: fullName,
          academicSelfReport: pick(ACADEMIC_SELF),
          academicLevel: pick(LEVEL_LABELS),
          emotionalSelfReport: pick(EMOTIONAL_SELF),
          psychosocialLevel: pick(LEVEL_LABELS),
          externalFactorReport: pick(EXTERNAL_FACTOR),
          externalFactorLevel: pick(LEVEL_LABELS),
          finalStatus: weighted([["Estable", 0.6], ["Requiere seguimiento", 0.3], ["En riesgo", 0.1]]),
          submissionId: `CHK-${String(checkinSeq).padStart(5, "0")}`,
          sourceForm: country === Country.COLOMBIA ? "checkin_col" : "checkin_per",
        });
      }
    }

    // ---- Mentor reports ----
    if (!noMentorReports) {
      const available = mentorMissingLatest ? ALL_MONTHS.slice(0, 5) : [...ALL_MONTHS];
      const count = randInt(2, Math.min(5, available.length));
      const months = available.slice(available.length - count);
      for (const month of months) {
        mentorSeq++;
        const approved = randInt(2, 6);
        const atRisk = randInt(0, 3);
        mentorReports.push({
          scholarId,
          scholarName: fullName,
          mentorName: mentor.name,
          country,
          cohort,
          university,
          reportingMonth: month,
          registrationDate: monthToDate(month, randInt(20, 28)),
          sessionDate: monthToDate(month, randInt(3, 18)),
          sessionType: pick(["Individual", "Grupal", "Seguimiento"]),
          sessionSummary: pick(SESSION_SUMMARIES),
          modality: pick(["Virtual", "Presencial", "Híbrido"]),
          permanenceRisk: weighted([["Bajo", 0.5], ["Medio", 0.3], ["Alto", 0.2]]),
          academicStatus: weighted([["Al día", 0.5], ["Con observaciones", 0.3], ["En riesgo", 0.2]]),
          academicAlertType: atRisk > 1 ? "Materias en riesgo" : "Sin alerta",
          approvedCoursesCount: approved,
          atRiskCoursesCount: atRisk,
          difficultSubjects: atRisk > 0 ? "Cálculo, Programación" : null,
          psychosocialStatus: weighted([["Estable", 0.6], ["En observación", 0.3], ["En riesgo", 0.1]]),
          psychosocialAlertType: chance(0.2) ? "Ansiedad / estrés" : "Sin alerta",
          accompanimentPlan: "Tutorías semanales y seguimiento de bienestar.",
          estimatedSupportTime: pick(["2 semanas", "1 mes", "El semestre"]),
          individualTutoring: randInt(0, 3),
          groupTutoring: randInt(0, 2),
          individualMentoring: randInt(0, 2),
          groupMentoring: randInt(0, 2),
          workshops: randInt(0, 2),
          highlights: chance(0.25) ? "Participó en un hackathon universitario." : null,
          academicProgressNotes: "Avance acorde al plan; refuerzo en materias base.",
          nextSteps: "Agendar próxima sesión y revisar notas parciales.",
          submissionId: `MR-${String(mentorSeq).padStart(5, "0")}`,
        });
      }
    }

    // ---- Support activities (active scholars, last 3 months × types) ----
    if (isActive) {
      for (const month of ALL_MONTHS.slice(3)) {
        for (const activityType of ACTIVITY_TYPES) {
          const count = lowParticipation
            ? weighted<number>([[0, 0.85], [1, 0.15]])
            : weighted<number>([[0, 0.4], [1, 0.25], [2, 0.2], [3, 0.1], [4, 0.05]]);
          supportActivities.push({
            scholarId,
            period: month,
            country,
            cohort,
            university,
            activityType,
            activityCount: count,
            attendanceStatus: count === 0 ? "No asistió" : count >= 3 ? "Asistió" : "Parcial",
            participationRate: count === 0 ? 0 : round2(Math.min(1, count / 3)),
            source: "seed",
          });
        }
      }
    }

    // ---- Risk assessments (monthly time series, last 3–6 months) ----
    const riskCount = randInt(3, 6);
    const riskPeriods = ALL_MONTHS.slice(ALL_MONTHS.length - riskCount);
    let previousGlobal: number | null = null;
    for (const period of riskPeriods) {
      const globalValue = weightedIndex([0.45, 0.25, 0.18, 0.09, 0.03]);
      const dims = [0, 0, 0];
      const driver = randInt(0, 2);
      dims[driver] = globalValue;
      // Non-driver dimensions stay strictly below the max so the driver is the unique
      // alert type, unless we explicitly inject a tie below.
      for (let d = 0; d < 3; d++) {
        if (d !== driver) dims[d] = randInt(0, Math.max(0, globalValue - 1));
      }
      if (globalValue > 0 && chance(0.25)) {
        dims[(driver + 1 + randInt(0, 1)) % 3] = globalValue; // occasional tie → COMBINED
      }
      const [academicRiskValue, psychosocialRiskValue, participationRiskValue] = dims;
      const computedGlobal = computeGlobalRiskValue(
        academicRiskValue,
        psychosocialRiskValue,
        participationRiskValue,
      );
      let alertType = computeAlertType(
        academicRiskValue,
        psychosocialRiskValue,
        participationRiskValue,
      );
      if (computedGlobal >= 3 && chance(0.2)) alertType = AlertType.PERMANENCE;
      const change = computeRiskChange(computedGlobal, previousGlobal);
      const reviewStatus = weighted([
        [ReviewStatus.PENDING, 0.5], [ReviewStatus.REVIEWED, 0.25],
        [ReviewStatus.IN_PROGRESS, 0.15], [ReviewStatus.RESOLVED, 0.1],
      ]);
      const reviewed = reviewStatus !== ReviewStatus.PENDING;
      riskAssessments.push({
        scholarId,
        period,
        country,
        cohort,
        university,
        academicRiskLevel: riskLevelFromValue(academicRiskValue),
        academicRiskValue,
        psychosocialRiskLevel: riskLevelFromValue(psychosocialRiskValue),
        psychosocialRiskValue,
        participationRiskLevel: riskLevelFromValue(participationRiskValue),
        participationRiskValue,
        globalRiskLevel: riskLevelFromValue(computedGlobal),
        globalRiskValue: computedGlobal,
        previousGlobalRiskValue: previousGlobal,
        riskChange: change,
        riskChangeLabel: riskChangeLabel(change),
        alertType,
        riskReason: RISK_REASON_BY_ALERT[alertType],
        recommendedAction: RECOMMENDED_ACTION_BY_VALUE[computedGlobal],
        reviewStatus,
        reviewedBy: reviewed ? pick(PM_NAMES) : null,
        reviewedAt: reviewed ? monthToDate(period, 27) : null,
        source: "seed:risk-engine",
      });
      previousGlobal = computedGlobal;
    }

    // ---- Scholar requests (~30% of scholars) ----
    const requestCount = chance(0.32) ? (chance(0.3) ? 2 : 1) : 0;
    const [firstName, ...rest] = fullName.split(" ");
    for (let r = 0; r < requestCount; r++) {
      requestSeq++;
      const requestType = pick([
        "Academic support", "Certificate request", "Exchange request", "Tuition support",
        "Repeated course support", "Psychosocial support", "Data update", "Other",
      ]);
      const status = weighted([
        [RequestStatus.SUBMITTED, 0.3], [RequestStatus.IN_REVIEW, 0.2],
        [RequestStatus.RESOLVED, 0.3], [RequestStatus.REJECTED, 0.1], [RequestStatus.PENDING, 0.1],
      ]);
      const resolved = status === RequestStatus.RESOLVED || status === RequestStatus.REJECTED;
      const subDate = monthToDate(pick(ALL_MONTHS), randInt(1, 27));
      requests.push({
        scholarId,
        submissionDate: subDate,
        country,
        cohort,
        university,
        firstName,
        lastName: rest.join(" "),
        requestType,
        requestDescription: "Solicitud de apoyo del becario para el programa.",
        exchangeUniversitySemester:
          requestType === "Exchange request" ? "Universidad de destino, 2026-2" : null,
        homologationSubjects:
          requestType === "Exchange request" ? "Cálculo III, Física II" : null,
        tuitionLivingCosts:
          requestType === "Tuition support" ? "Matrícula: 5.000.000; Manutención: 1.200.000" : null,
        certificateReason:
          requestType === "Certificate request" ? "Trámite ante entidad externa." : null,
        difficultSubject:
          requestType === "Repeated course support"
            ? pick(["Cálculo", "Física", "Programación", "Álgebra Lineal"])
            : null,
        context: "Contexto y motivación de la solicitud (dato de demostración).",
        attachmentUrl: chance(0.5) ? `https://drive.google.com/file/demo-REQ-${requestSeq}` : null,
        submissionId: `REQ-${String(requestSeq).padStart(5, "0")}`,
        status,
        responseChannel: pick(["Email", "WhatsApp", "Llamada"]),
        observations: resolved ? "Solicitud atendida por el equipo." : null,
        owner: pick(PM_NAMES),
        resolvedDate: resolved ? jitterDate(subDate, 20) : null,
      });
    }

    // ---- Financial inputs ----
    const isHighCost = i % 15 === 0; // ~7 scholars for unit-economics outliers
    const localCurrency = country === Country.COLOMBIA ? "COP" : "PEN";
    const scholarshipAmount =
      country === Country.COLOMBIA
        ? randInt(10_000_000, 24_000_000) * (isHighCost ? 1.4 : 1)
        : randInt(12_000, 30_000) * (isHighCost ? 1.4 : 1);
    financialInputs.push({
      scholarId,
      period: "2026",
      country,
      cohort,
      university,
      costCategory: "Scholarship amount",
      costAmount: Math.round(scholarshipAmount),
      currency: localCurrency,
      fundingSource: "ver+ Beca Tech",
      isDirectCost: true,
      notes: "Monto anual de beca (demostración).",
    });
    const supportCosts: [string, number, string][] = [
      ["Tuition", country === Country.COLOMBIA ? randInt(3_000_000, 9_000_000) : randInt(4_000, 12_000), localCurrency],
      ["Maintenance / stipend", country === Country.COLOMBIA ? randInt(1_000_000, 3_000_000) : randInt(1_500, 4_000), localCurrency],
      ["English support", randInt(300, 1_500), "USD"],
      ["Tutoring", country === Country.COLOMBIA ? randInt(200_000, 900_000) : randInt(300, 1_200), localCurrency],
      ["Mentoring", country === Country.COLOMBIA ? randInt(150_000, 700_000) : randInt(200, 900), localCurrency],
      ["Psychosocial support", country === Country.COLOMBIA ? randInt(100_000, 600_000) : randInt(150, 800), localCurrency],
    ];
    const chosen = shuffle(supportCosts).slice(0, isHighCost ? supportCosts.length : randInt(2, 4));
    for (const [costCategory, amount, currency] of chosen) {
      financialInputs.push({
        scholarId,
        period: "2026",
        country,
        cohort,
        university,
        costCategory,
        costAmount: amount,
        currency,
        fundingSource: "ver+ Beca Tech",
        isDirectCost: costCategory !== "English support" || chance(0.5),
        notes: isHighCost ? "Becario con costos de apoyo elevados." : null,
      });
    }

    // ---- Selection candidate mapped to this scholar (they were SELECTED) ----
    const candidateId = `CAND-${scholarId}`;
    const appBase = APPLICATION_BASE[cohort];
    const path = stagePath(SelectionStage.SELECTED);
    candidates.push({
      candidateId,
      scholarId,
      fullName,
      country,
      cohort,
      university,
      applicationDate: appBase,
      currentStage: SelectionStage.SELECTED,
      stageStatus: "Selected",
      selectionScore: randInt(75, 95),
      evaluationNotes: "Candidato seleccionado para la cohorte.",
      decisionDate: new Date(appBase.getTime() + path.length * 14 * 24 * 60 * 60 * 1000),
    });
    path.forEach((stageName, s) => {
      const start = new Date(appBase.getTime() + s * 14 * 24 * 60 * 60 * 1000);
      stageHistory.push({
        candidateId,
        stageName,
        stageStatus: stageName === SelectionStage.SELECTED ? "Selected" : "Passed",
        stageStartDate: start,
        stageEndDate: new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000),
        score: randInt(70, 95),
        notes: null,
      });
    });

    // ---- Mentor → scholar access ----
    access.push({ userId: mentor.id, scholarId, accessType: "MENTOR" });
  }

  // ---- 40 extra (non-selected) candidates ----
  const extraStages = shuffle([
    ...Array<SelectionStage>(18).fill(SelectionStage.REJECTED),
    ...Array<SelectionStage>(7).fill(SelectionStage.WITHDRAWN),
    ...Array<SelectionStage>(3).fill(SelectionStage.APPLICATION_RECEIVED),
    ...Array<SelectionStage>(3).fill(SelectionStage.ELIGIBILITY_REVIEW),
    ...Array<SelectionStage>(3).fill(SelectionStage.ASSESSMENT),
    ...Array<SelectionStage>(3).fill(SelectionStage.INTERVIEW),
    ...Array<SelectionStage>(3).fill(SelectionStage.FINAL_COMMITTEE),
  ]);
  extraStages.forEach((currentStage, k) => {
    const candidateId = `CAND-X-${String(k + 1).padStart(3, "0")}`;
    const country = weighted([[Country.COLOMBIA, 0.6], [Country.PERU, 0.4]]);
    const cohort = weighted([["2025", 0.5], ["2026", 0.5]]);
    const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${pick(LAST_NAMES)}`;
    const university = pick(country === Country.COLOMBIA ? COLOMBIA_UNIS : PERU_UNIS);
    const appBase = APPLICATION_BASE[cohort];
    const path = stagePath(currentStage);
    const terminal =
      currentStage === SelectionStage.REJECTED || currentStage === SelectionStage.WITHDRAWN;
    const inProgress = !terminal;
    candidates.push({
      candidateId,
      scholarId: null,
      fullName,
      country,
      cohort,
      university,
      applicationDate: appBase,
      currentStage,
      stageStatus: terminal
        ? currentStage === SelectionStage.REJECTED
          ? "Rejected"
          : "Withdrawn"
        : "In progress",
      selectionScore: terminal ? randInt(40, 70) : randInt(55, 85),
      evaluationNotes: terminal ? "No continúa en el proceso." : "En evaluación.",
      decisionDate: terminal
        ? new Date(appBase.getTime() + path.length * 14 * 24 * 60 * 60 * 1000)
        : null,
    });
    path.forEach((stageName, s) => {
      const isLast = s === path.length - 1;
      const start = new Date(appBase.getTime() + s * 14 * 24 * 60 * 60 * 1000);
      stageHistory.push({
        candidateId,
        stageName,
        stageStatus: isLast
          ? terminal
            ? stageName === SelectionStage.REJECTED
              ? "Rejected"
              : "Withdrawn"
            : "In progress"
          : "Passed",
        stageStartDate: start,
        stageEndDate: isLast && inProgress ? null : new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000),
        score: randInt(40, 90),
        notes: null,
      });
    });
  });

  // ---- Program-level financial inputs (no scholar) ----
  for (const [costCategory, amount] of [
    ["Program staff allocation", 45_000] as const,
    ["Administrative allocation", 18_000] as const,
    ["Program staff allocation", 32_000] as const,
    ["Other direct support", 9_500] as const,
  ]) {
    financialInputs.push({
      scholarId: null,
      period: "2026",
      country: null,
      cohort: null,
      university: null,
      costCategory,
      costAmount: amount,
      currency: "USD",
      fundingSource: "ver+ Beca Tech",
      isDirectCost: costCategory === "Other direct support",
      notes: "Costo a nivel de programa (demostración).",
    });
  }

  // ---- Control values ----
  const controlValues: Prisma.ControlValueCreateManyInput[] = [];
  const addControls = (category: string, entries: [string, string][]) =>
    entries.forEach(([value, label], idx) =>
      controlValues.push({ category, value, label, sortOrder: idx }),
    );
  addControls("country", [["COLOMBIA", "Colombia"], ["PERU", "Perú"]]);
  addControls("program_status", [
    ["ACTIVE", "Activo"], ["WITHDRAWN", "Retirado"], ["GRADUATED", "Graduado"], ["PAUSED", "En pausa"],
  ]);
  addControls("risk_level", [
    ["SIN_RIESGO", "Sin riesgo"], ["RIESGO_BAJO", "Riesgo bajo"], ["RIESGO_MEDIO", "Riesgo medio"],
    ["RIESGO_ALTO", "Riesgo alto"], ["CRITICO", "Crítico"],
  ]);
  addControls("alert_type", [
    ["ACADEMIC", "Académica"], ["PSYCHOSOCIAL", "Psicosocial"], ["PARTICIPATION", "Participación"],
    ["PERMANENCE", "Permanencia"], ["COMBINED", "Combinada"], ["NONE", "Sin alerta"],
  ]);
  addControls("request_status", [
    ["SUBMITTED", "Enviada"], ["IN_REVIEW", "En revisión"], ["RESOLVED", "Resuelta"],
    ["REJECTED", "Rechazada"], ["PENDING", "Pendiente"],
  ]);
  addControls("activity_type", [
    ["INDIVIDUAL_TUTORING", "Tutoría individual"], ["GROUP_TUTORING", "Tutoría grupal"],
    ["INDIVIDUAL_MENTORING", "Mentoría individual"], ["GROUP_MENTORING", "Mentoría grupal"],
    ["WORKSHOP", "Taller"], ["PSYCHOSOCIAL_SUPPORT", "Apoyo psicosocial"],
    ["INDIVIDUAL_SESSION", "Sesión individual"], ["OTHER", "Otro"],
  ]);
  addControls("academic_progress_status", [
    ["ON_TRACK", "Al día"], ["SLIGHTLY_BEHIND", "Ligeramente atrasado"],
    ["BEHIND", "Atrasado"], ["CRITICAL_DELAY", "Atraso crítico"],
  ]);
  addControls("review_status", [
    ["PENDING", "Pendiente"], ["REVIEWED", "Revisado"], ["IN_PROGRESS", "En progreso"],
    ["RESOLVED", "Resuelto"],
  ]);
  addControls("user_role", [
    ["EXECUTIVE", "Directivo"], ["PROGRAM_MANAGER", "Gestor de programa"], ["MENTOR", "Mentor"],
    ["ANALYST_ADMIN", "Analista / Admin"], ["FINANCE", "Finanzas"], ["SELECTION_TEAM", "Equipo de selección"],
  ]);

  // ---- Demo users ----
  const users: Prisma.AppUserCreateManyInput[] = [
    { id: "user-executive", fullName: "Ana Restrepo", email: "executive@becatech.test", role: UserRole.EXECUTIVE },
    { id: "user-pm-1", fullName: "Carlos Méndez", email: "program.manager@becatech.test", role: UserRole.PROGRAM_MANAGER },
    { id: "user-pm-2", fullName: "Lucía Fernández", email: "program.manager2@becatech.test", role: UserRole.PROGRAM_MANAGER },
    ...MENTORS.map((m) => ({ id: m.id, fullName: m.name, email: m.email, role: UserRole.MENTOR })),
    { id: "user-analyst", fullName: "Diego Ramírez", email: "analyst@becatech.test", role: UserRole.ANALYST_ADMIN },
    { id: "user-finance", fullName: "Sofía Torres", email: "finance@becatech.test", role: UserRole.FINANCE },
    { id: "user-selection", fullName: "Mateo Gómez", email: "selection@becatech.test", role: UserRole.SELECTION_TEAM },
  ];

  // ---- Insert (FK-safe order) ----
  console.log("Inserting scholars and related records…");
  await insertChunked((r) => prisma.scholar.createMany({ data: r }), scholars);
  await insertChunked((r) => prisma.academicTerm.createMany({ data: r }), academicTerms);
  await insertChunked((r) => prisma.monthlyCheckin.createMany({ data: r }), checkins);
  await insertChunked((r) => prisma.mentorReport.createMany({ data: r }), mentorReports);
  await insertChunked((r) => prisma.supportActivity.createMany({ data: r }), supportActivities);
  await insertChunked((r) => prisma.riskAssessment.createMany({ data: r }), riskAssessments);
  await insertChunked((r) => prisma.scholarRequest.createMany({ data: r }), requests);
  await insertChunked((r) => prisma.financialInput.createMany({ data: r }), financialInputs);
  await insertChunked((r) => prisma.selectionCandidate.createMany({ data: r }), candidates);
  await insertChunked((r) => prisma.selectionStageHistory.createMany({ data: r }), stageHistory);
  await insertChunked((r) => prisma.controlValue.createMany({ data: r }), controlValues);
  await prisma.appUser.createMany({ data: users });
  await insertChunked((r) => prisma.userScholarAccess.createMany({ data: r }), access);

  // ---- Summary ----
  const counts = {
    scholars: scholars.length,
    academicTerms: academicTerms.length,
    checkins: checkins.length,
    mentorReports: mentorReports.length,
    supportActivities: supportActivities.length,
    riskAssessments: riskAssessments.length,
    requests: requests.length,
    financialInputs: financialInputs.length,
    candidates: candidates.length,
    stageHistory: stageHistory.length,
    controlValues: controlValues.length,
    users: users.length,
    userScholarAccess: access.length,
  };
  console.log("Seed complete:");
  console.table(counts);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
