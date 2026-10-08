"use server";

import { redirect } from "next/navigation";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { DatabaseUnavailableError } from "@/lib/db";
import { createUser, emailTaken, findUserWithHash, usernameTaken } from "@/lib/data";
import { sendWelcomeEmail } from "@/lib/emails";
import { isEmail, passwordProblem, usernameProblem } from "@/lib/utils";
import type { AuthState } from "@/lib/form-state";

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  const fieldErrors: Record<string, string> = {};
  const usernameIssue = usernameProblem(username);
  if (usernameIssue) fieldErrors.username = usernameIssue;
  if (!isEmail(email)) fieldErrors.email = "Enter a valid email address.";
  const passwordIssue = passwordProblem(password, username);
  if (passwordIssue) fieldErrors.password = passwordIssue;
  if (password !== confirm) fieldErrors.password_confirm = "The two passwords do not match.";
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  let created;
  try {
    if (await usernameTaken(username)) return { error: "", fieldErrors: { username: "That username is taken." } };
    if (await emailTaken(email)) return { error: "", fieldErrors: { email: "An account with this email already exists." } };
    created = await createUser({ username, email, passwordHash: await hashPassword(password) });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return { error: "Sign-ups need a database. Set DATABASE_URL and try again." };
    }
    console.error("[12] signup failed:", (error as Error).message);
    return { error: "Could not create the account. Please try again." };
  }

  await startSession(created);
  try {
    await sendWelcomeEmail(created);
  } catch (error) {
    console.error("[12] welcome email failed:", (error as Error).message);
  }
  redirect("/dashboard?notice=welcome");
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!identifier || !password) return { error: "Enter your username (or email) and password." };

  let user;
  try {
    user = await findUserWithHash(identifier);
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return { error: "Logging in needs a database. Set DATABASE_URL and try again." };
    }
    console.error("[12] login failed:", (error as Error).message);
    return { error: "Could not log you in. Please try again." };
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Those details did not match an account." };
  }

  const { passwordHash: _passwordHash, ...session } = user;
  await startSession(session);
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/?notice=logged-out");
}
