import { db } from "./db";

export async function getSettings() {
  return db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
