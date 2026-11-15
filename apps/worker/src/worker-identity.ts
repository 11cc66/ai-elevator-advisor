export const WORKER_SERVICE_NAME = "elevator-advisor-worker";

export function getWorkerIdentity(): { service: string } {
  return { service: WORKER_SERVICE_NAME };
}
