import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  Monitor,
  Stethoscope,
  Users,
  UserRound,
} from "lucide-react";

import { BrandLogo } from "../BrandLogo";

export type AdminTab =
  | "dashboard"
  | "sedes"
  | "salas"
  | "consultorios"
  | "pantallas"
  | "medicos"
  | "usuarios"
  | "auditoria";

type NavItem = {
  id: AdminTab;
  label: string;
  icon: ReactNode;
};

type NavCategory = {
  title: string;
  items: NavItem[];
};

const NAV_CATEGORIES: NavCategory[] = [
  {
    title: "Módulos",
    items: [{ id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5 shrink-0" /> }],
  },
  {
    title: "Gestión clínica",
    items: [
      { id: "sedes", label: "Sedes", icon: <Building2 className="h-5 w-5 shrink-0" /> },
      { id: "salas", label: "Salas", icon: <Layers className="h-5 w-5 shrink-0" /> },
      { id: "consultorios", label: "Consultorios", icon: <Stethoscope className="h-5 w-5 shrink-0" /> },
    ],
  },
  {
    title: "Dispositivos",
    items: [{ id: "pantallas", label: "Pantallas", icon: <Monitor className="h-5 w-5 shrink-0" /> }],
  },
  {
    title: "Control de accesos",
    items: [
      { id: "medicos", label: "Médicos", icon: <UserRound className="h-5 w-5 shrink-0" /> },
      { id: "usuarios", label: "Usuarios", icon: <Users className="h-5 w-5 shrink-0" /> },
    ],
  },
  {
    title: "Reportes",
    items: [
      {
        id: "auditoria",
        label: "Auditoría",
        icon: <ClipboardList className="h-5 w-5 shrink-0" />,
      },
    ],
  },
];

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
}

export function AdminSidebar({ activeTab, onTabChange, onLogout }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } h-full shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-sm transition-all duration-300 ease-in-out overflow-hidden`}
    >
      <div
        className={`shrink-0 flex items-center gap-2 border-b border-gray-100 p-3 ${
          isCollapsed ? "flex-col justify-center" : "justify-between"
        }`}
      >
        <BrandLogo
          className={`${isCollapsed ? "h-8 w-8 object-contain" : "h-10 w-auto"} transition-all duration-300`}
        />
        <button
          type="button"
          onClick={() => setIsCollapsed((c) => !c)}
          aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-4">
        {NAV_CATEGORIES.map((category) => (
          <div key={category.title}>
            <p
              className={`px-3 mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider transition-opacity duration-200 ${
                isCollapsed ? "opacity-0 h-0 mb-0 overflow-hidden" : "opacity-100"
              }`}
            >
              {category.title}
            </p>
            <ul className="space-y-0.5">
              {category.items.map((item) => {
                const active = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      title={isCollapsed ? item.label : undefined}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center gap-3 text-sm transition-colors ${
                        isCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                      } ${
                        active
                          ? "bg-rose-50 text-rose-600 rounded-xl font-medium"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl"
                      }`}
                    >
                      <span className={active ? "text-rose-600" : "text-slate-500"}>{item.icon}</span>
                      <span
                        className={`truncate whitespace-nowrap transition-all duration-200 ${
                          isCollapsed ? "w-0 opacity-0 hidden" : "opacity-100"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto shrink-0 border-t border-gray-200 p-2 space-y-1">
        {!isCollapsed && (
          <Link
            to="/medico/setup"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
          >
            Vista médico
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          title={isCollapsed ? "Cerrar sesión" : undefined}
          className={`w-full flex items-center gap-3 rounded-xl text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors ${
            isCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <span className={isCollapsed ? "hidden" : ""}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
