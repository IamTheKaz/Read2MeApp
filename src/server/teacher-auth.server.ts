import { getSql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password.server";

const TEACHER_KEY = "teacher";

type ConfigRow = { password_hash: string | null; salt: string | null };

/** Server-only: true when `password` matches the stored teacher hash. */
export async function checkTeacherPassword(password: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<ConfigRow>`select password_hash, salt from app_config where id = ${TEACHER_KEY}`;
  const row = rows[0];
  if (!row?.password_hash || !row.salt) return false;
  return verifyPassword(password, row.salt, row.password_hash);
}

export function hashTeacherPassword(password: string): { hash: string; salt: string } {
  return hashPassword(password);
}

export { TEACHER_KEY };
