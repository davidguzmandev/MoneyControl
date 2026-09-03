import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/app", label: "Resumen", end: true },
  { to: "/app/transactions", label: "Movimientos" },
  { to: "/app/categories", label: "Categorías" },
  { to: "/app/stats", label: "Estadísticas" },
  { to: "/app/settings", label: "Configuración" },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-semibold tracking-tight">MoneyControl</span>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.name}</span>
            <button
              onClick={() => logout()}
              className="rounded-full px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
