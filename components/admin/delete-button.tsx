"use client";

export function DeleteButton({
  action,
  id,
  label,
  confirmText,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  id: number;
  label: string;
  confirmText: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={
          className ??
          "cursor-pointer rounded-full border border-bad/40 bg-bad/10 px-4 py-1.5 text-sm font-semibold text-bad"
        }
      >
        {label}
      </button>
    </form>
  );
}
