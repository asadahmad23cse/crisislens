/**
 * CrisisLens Evaluation Dataset v1.0 — pipeline outputs for the dashboard.
 *
 * These JSON files are written by `python analysis/export_dashboard.py` from
 * CrisisLens_dataset_v1.xlsx using the final (v2) method. The dashboard reads
 * them instead of generating scenario posts, so every screen matches the
 * numbers in the project report.
 */
import nepal from "./nepal-2015.json";
import maria from "./maria-2017.json";
import kerala from "./kerala-2018.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DATASET_RESULTS: Record<string, any> = {
  "nepal-2015": nepal,
  "maria-2017": maria,
  "kerala-2018": kerala,
};
