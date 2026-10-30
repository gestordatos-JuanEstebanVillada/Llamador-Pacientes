import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import MedicoCallPage from "./pages/medico/MedicoCallPage";
import MedicoSetupPage from "./pages/medico/MedicoSetupPage";
import PantallaSetupPage from "./pages/pantalla/PantallaSetupPage";
import PantallaViewPage from "./pages/pantalla/PantallaViewPage";

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/admin/*"
          element={
            <RequireAuth roles={["ADMIN", "GESTOR"]}>
              <AdminPage />
            </RequireAuth>
          }
        />

        <Route
          path="/medico/setup"
          element={
            <RequireAuth roles={["MEDICO", "ADMIN"]}>
              <MedicoSetupPage />
            </RequireAuth>
          }
        />
        <Route
          path="/medico/call"
          element={
            <RequireAuth roles={["MEDICO", "ADMIN"]}>
              <MedicoCallPage />
            </RequireAuth>
          }
        />
        <Route path="/medico" element={<Navigate to="/medico/setup" replace />} />

        <Route
          path="/pantalla/setup"
          element={
            <RequireAuth roles={["PANTALLA", "ADMIN"]}>
              <PantallaSetupPage />
            </RequireAuth>
          }
        />
        <Route
          path="/pantalla/view"
          element={
            <RequireAuth roles={["PANTALLA", "ADMIN"]}>
              <PantallaViewPage />
            </RequireAuth>
          }
        />
        <Route path="/pantalla" element={<Navigate to="/pantalla/setup" replace />} />
        <Route path="/pantalla/*" element={<Navigate to="/pantalla/setup" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
