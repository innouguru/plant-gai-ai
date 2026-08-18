import { Outlet } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";

function AdminShell() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export default AdminShell;