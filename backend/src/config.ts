import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3010),
  nodeEnv: process.env.NODE_ENV ?? "development",
};
