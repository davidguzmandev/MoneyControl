import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { verifyToken } from "../auth/jwt";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Sesión inválida o expirada" });
    return;
  }

  req.userId = payload.userId;
  next();
}
