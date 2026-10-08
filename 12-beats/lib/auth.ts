/** Accounts and sessions: scrypt password hashing plus a signed session cookie. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "./config";
import { findUserById } from "./data";
import { hashPassword, verifyPassword } from "./password";
import type { User } from "./types";

const COOKIE_NAME = "twelve_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export { hashPassword, verifyPassword };

async function sessionKey(): Promise<Uint8Array> {
  return new TextEncoder().encode(authSecret());
}

export async function startSession(user: User): Promise<void> {
  const token = await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(await sessionKey());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** The signed-in user, or null. Always reads the role from the database. */
export async function currentUser(): Promise<User | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, await sessionKey());
    const id = Number(payload.sub);
    if (!Number.isFinite(id)) return null;
    return await findUserById(id);
  } catch {
    return null;
  }
}

export async function requireUser(next?: string): Promise<User> {
  const user = await currentUser();
  if (user) return user;
  redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export async function requireProducer(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (user.role !== "producer") redirect("/dashboard?notice=not-producer");
  return user;
}
