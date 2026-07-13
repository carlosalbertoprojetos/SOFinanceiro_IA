export type DatabaseHealth = {
  status: "down" | "up";
};

export type HealthResult = {
  database: DatabaseHealth;
  service: "api";
  status: "degraded" | "ok";
};
