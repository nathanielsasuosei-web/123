"use client";

import { useActionState } from "react";
import { loginAction, signupAction } from "@/app/actions/auth";
import { emptyAuthState } from "@/lib/form-state";

const inputClass =
  "w-full rounded-[10px] border border-line-strong bg-panel-soft px-4 py-2.5 text-body outline-none placeholder:text-muted focus:border-accent";
const labelClass = "block text-sm font-semibold";
const errorClass = "mt-1 text-sm text-bad";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, emptyAuthState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className={labelClass} htmlFor="identifier">
          Username or email
        </label>
        <input id="identifier" name="identifier" autoComplete="username" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      {state.error ? <p className={errorClass}>{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, emptyAuthState);
  const fieldError = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="username">
          Username
        </label>
        <input id="username" name="username" autoComplete="username" required className={inputClass} />
        {fieldError("username") ? <p className={errorClass}>{fieldError("username")}</p> : null}
      </div>
      <div>
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        <p className="mt-1 text-xs text-muted">Your beats and receipts are sent here.</p>
        {fieldError("email") ? <p className={errorClass}>{fieldError("email")}</p> : null}
      </div>
      <div>
        <label className={labelClass} htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} />
        {fieldError("password") ? <p className={errorClass}>{fieldError("password")}</p> : null}
      </div>
      <div>
        <label className={labelClass} htmlFor="password_confirm">
          Repeat password
        </label>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
        {fieldError("password_confirm") ? <p className={errorClass}>{fieldError("password_confirm")}</p> : null}
      </div>
      {state.error ? <p className={errorClass}>{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
