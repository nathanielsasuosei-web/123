/**
 * Shared state shapes for forms driven by `useActionState`.
 *
 * These live outside the `"use server"` action modules, which may only export
 * async functions.
 */

export type AuthState = { error: string; fieldErrors?: Record<string, string> };

export const emptyAuthState: AuthState = { error: "" };

export type AdminState = { error: string; fieldErrors?: Record<string, string> };

export const emptyAdminState: AdminState = { error: "" };
