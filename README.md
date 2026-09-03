# MoneyControl

Web app full-stack: React + Vite + TypeScript (frontend) y Node.js + Express + TypeScript (backend).

Desplegada automáticamente en cada push a `main` a través de GitHub Actions, en un VPS con nginx y PM2, bajo [moneycontrol.davidguzman.dev](https://moneycontrol.davidguzman.dev).

## Estructura

```
frontend/   # React + Vite + TS
backend/    # Node + Express + TS (API en /api)
```

## Desarrollo local

```bash
# Backend
cd backend
npm install
npm run dev      # http://localhost:3010

# Frontend
cd frontend
npm install
npm run dev       # http://localhost:5173 (proxy /api -> :3010)
```

## Despliegue

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) hace build de frontend y backend, y sincroniza los artefactos al VPS vía `rsync` sobre SSH, reiniciando el proceso `moneycontrol-backend` en PM2.

Requiere los siguientes secrets configurados en el repositorio de GitHub (Settings → Secrets and variables → Actions):

- `VPS_SSH_KEY`: llave privada SSH dedicada para el despliegue (con acceso de solo escritura a `/var/www/moneycontrol` en el VPS).
