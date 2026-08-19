import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastViewport } from "./components/ui/Toast";
import { AuthProvider } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
import { AdminLayout } from "./layouts/AdminLayout";
import { AddPersonPage } from "./pages/AddPersonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LiveRecognitionPage } from "./pages/LiveRecognitionPage";
import { LoginPage } from "./pages/LoginPage";
import { PeoplePage } from "./pages/PeoplePage";
import { PersonEditorPage } from "./pages/PersonEditorPage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ToastViewport />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/people/new" element={<AddPersonPage />} />
              <Route path="/people/:id" element={<PersonEditorPage mode="view" />} />
              <Route path="/people/:id/edit" element={<PersonEditorPage mode="edit" />} />
              <Route path="/live" element={<LiveRecognitionPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
