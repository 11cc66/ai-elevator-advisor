export function FormFeedback({
  id,
  kind,
  message,
}: {
  id?: string;
  kind: "error" | "success" | "info";
  message: string | null;
}) {
  if (!message) {
    return null;
  }

  const tone =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : kind === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-cyan-200 bg-cyan-50 text-cyan-900";

  return (
    <p
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={`rounded-lg border px-3 py-2 text-sm ${tone}`}
      id={id}
      role={kind === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
