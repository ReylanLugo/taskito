
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface FrontendLog {
  level: LogLevel;
  message: string;
  // optional structured metadata
  meta?: Record<string, unknown>;
  // optional extra Loki labels (e.g., { page: "/dashboard" })
  labels?: Record<string, string | number | boolean>;
}
