import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3010),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-insecure-secret",
  cookieName: "moneycontrol_token",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
};
