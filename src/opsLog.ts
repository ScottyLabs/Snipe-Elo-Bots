/**
 * One JSON object per line on stdout — Railway and most hosts capture this as logs.
 */
export function opsLog(event: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    svc: "snipe-elo",
    ts: new Date().toISOString(),
    event,
    ...data,
  });
  console.log(line);
}
