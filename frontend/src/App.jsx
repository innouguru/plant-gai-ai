import { Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminSignupPage from "./pages/AdminSignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import CompleteRegistrationPage from "./pages/CompleteRegistrationPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FarmerShell from "./pages/FarmerShell";
import FarmerHomePage from "./pages/farmer/FarmerHomePage";
import DiagnosePage from "./pages/farmer/DiagnosePage";
import HistoryPage from "./pages/farmer/HistoryPage";
import AdminShell from "./pages/AdminShell";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import FarmersPage from "./pages/admin/FarmersPage";
import DiagnosticsPage from "./pages/admin/DiagnosticsPage";
import MessagesPage from "./pages/admin/MessagesPage";
import { HomeRedirect, ProtectedRoute, RequireRole } from "./routing/ProtectedRoutes";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<AdminSignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/complete-registration" element={<CompleteRegistrationPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route path="/" element={<HomeRedirect />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RequireRole role="farmer" />}>
          <Route element={<FarmerShell />}>
            <Route path="/home" element={<FarmerHomePage />} />
            <Route path="/diagnose" element={<DiagnosePage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="farm_admin" />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/farmers" element={<FarmersPage />} />
            <Route path="/admin/diagnostics" element={<DiagnosticsPage />} />
            <Route path="/admin/messages" element={<MessagesPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;