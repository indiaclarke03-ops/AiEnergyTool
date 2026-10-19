// IndexedDB (via Dexie) for research sessions, saved receipts, scenarios and the disclosure tracker.
import Dexie, { type EntityTable } from "dexie";
import type { ImpactEstimate, QueryInput, Range } from "../engine";

export type SessionRow = { id?: number; name: string; createdAt: string };

export type ReceiptRow = {
  id?: number;
  sessionId: number;
  createdAt: string;
  input: QueryInput;
  includeEmbodied: boolean;
  levers: string[];
  tokenSource: "manual" | "paste" | "metered";
  estimate: ImpactEstimate;
  /** Exact assumption state used, for reproducibility. */
  assumptionVersions: Record<string, string>;
  overrides: Record<string, Range>;
};

export type ScenarioRow = {
  id?: number;
  name: string;
  createdAt: string;
  overrides: Record<string, Range>;
  region: string;
  modelClass: QueryInput["modelClass"];
};

export type DisclosureRow = {
  id?: number;
  provider: string;
  perQueryEnergy: string;
  water: string;
  methodology: string;
  boundary: string;
  date: string;
  link: string;
  notes: string;
};

export class LensDB extends Dexie {
  sessions!: EntityTable<SessionRow, "id">;
  receipts!: EntityTable<ReceiptRow, "id">;
  scenarios!: EntityTable<ScenarioRow, "id">;
  disclosures!: EntityTable<DisclosureRow, "id">;

  constructor() {
    super("ai-energy-lens");
    this.version(1).stores({
      sessions: "++id, createdAt",
      receipts: "++id, sessionId, createdAt, input.modelClass, input.region",
      scenarios: "++id, createdAt",
      disclosures: "++id, provider",
    });
  }
}

export const db = new LensDB();

/** Return the most recent session, creating one if none exist. */
export async function ensureSession(): Promise<SessionRow & { id: number }> {
  const last = await db.sessions.orderBy("createdAt").last();
  if (last?.id !== undefined) return last as SessionRow & { id: number };
  return newSession();
}

export async function newSession(name?: string): Promise<SessionRow & { id: number }> {
  const createdAt = new Date().toISOString();
  const row = { name: name ?? `Session ${createdAt.slice(0, 16).replace("T", " ")}`, createdAt };
  const id = await db.sessions.add(row);
  return { ...row, id: id as number };
}

import seed from "../../data/disclosures_seed.json";

/** Seed the disclosure tracker once, on first use. */
export async function ensureDisclosuresSeeded(): Promise<void> {
  await db.transaction("rw", db.disclosures, async () => {
    if ((await db.disclosures.count()) === 0) await db.disclosures.bulkAdd(seed.rows);
  });
}
