export type LivenessResult = {
  service: "api";
  status: "ok";
};

export type ReadinessResult = {
  authentication: { reason?: string; status: "down" | "up" };
  database: { status: "down" | "up" };
  service: "api";
  status: "degraded" | "ok";
};
