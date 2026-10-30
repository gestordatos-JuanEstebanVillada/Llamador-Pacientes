import type { Rol } from "../types";

export function routeAfterLogin(rol: Rol): string {
  switch (rol) {
    case "ADMIN":
    case "GESTOR":
      return "/admin";
    case "MEDICO":
      return "/medico/setup";
    case "PANTALLA":
      return "/pantalla/setup";
    default:
      return "/login";
  }
}

export function defaultRouteForSession(
  rol: Rol | null,
  hasMedicoConfig: boolean,
  hasPantallaConfig: boolean,
): string {
  if (!rol) return "/login";
  if (rol === "ADMIN" || rol === "GESTOR") return "/admin";
  if (rol === "MEDICO") return hasMedicoConfig ? "/medico/call" : "/medico/setup";
  if (rol === "PANTALLA") return hasPantallaConfig ? "/pantalla/view" : "/pantalla/setup";
  return "/login";
}
