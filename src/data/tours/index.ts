// The guided system tours that used to live on their own site
// (ai-systems-tours). Each one is data: steps, mock screens, architecture.
// /demos lists them and /demos/<slug> plays one.
import type { Tour } from "./types";
import { docCoach } from "./doc-coach";
import { scanValidator } from "./scan-validator";
import { enterpriseSearch } from "./enterprise-search";
import { reconciliation } from "./reconciliation";
import { treatmentEstimator } from "./treatment-estimator";
import { npcCoach } from "./npc-coach";
import { coworkDashboard } from "./cowork-dashboard";
import { patientAssessment } from "./patient-assessment";
import { marketingWarehouse } from "./marketing-warehouse";

export type { Tour, TourStep, Screen } from "./types";

export const TOURS: Tour[] = [
  docCoach,
  scanValidator,
  enterpriseSearch,
  reconciliation,
  treatmentEstimator,
  npcCoach,
  coworkDashboard,
  patientAssessment,
  marketingWarehouse,
];

export const tourBySlug = (slug: string) => TOURS.find((t) => t.slug === slug);
