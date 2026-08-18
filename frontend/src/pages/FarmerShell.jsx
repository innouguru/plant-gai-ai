import { Outlet } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";

function FarmerShell() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export default FarmerShell;