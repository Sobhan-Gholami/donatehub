// Run with: npx tsx scripts/create-admin.ts <username> <password>
import db from "../lib/db";
import { hashPassword } from "../lib/auth";

const [, , username, password] = process.argv;
if (!username || !password) {
  console.log("Usage: npx tsx scripts/create-admin.ts <username> <password>");
  process.exit(1);
}

const hash = hashPassword(password);
const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username);
if (existing) {
  db.prepare("UPDATE admins SET password_hash = ? WHERE username = ?").run(hash, username);
  console.log(`Updated password for admin '${username}'`);
} else {
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(username, hash);
  console.log(`Created admin '${username}'`);
}
