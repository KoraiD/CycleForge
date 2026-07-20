export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureRuntimeConfigLoaded } = await import("@/lib/runtime-config");
    ensureRuntimeConfigLoaded();
  }
}
