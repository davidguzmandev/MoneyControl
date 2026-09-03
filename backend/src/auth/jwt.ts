import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthTokenPayload {
  userId: string;
}

const EXPIRES_IN = "30d";

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
  } catch {
    return null;
  }
}
