import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production"
  ? (() => { throw new Error("JWT_SECRET must be set in production"); })()
  : "dev-only-insecure-secret");

export type SessionPayload = {
  role: "admin" | "streamer";
  id: number;
  username: string;
};

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}
export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compareSync(pw, hash);
}

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

const COOKIE_NAME = "session_token";

export async function setSessionCookie(payload: SessionPayload) {
  const token = signSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
