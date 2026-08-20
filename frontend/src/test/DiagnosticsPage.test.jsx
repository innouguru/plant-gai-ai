import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { fetchFarmDiagnoses } from "../api/farms";
import { DevPreviewProvider } from "../preview/devPreview";

vi.mock("../auth/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("../api/auth", () => ({ fetchMe: vi.fn() }));
vi.mock("../api/onboarding", () => ({ completeOnboarding: vi.fn() }));
vi.mock("../api/invitations", () => ({ createInvitation: vi.fn(), acceptInvitation: vi.fn() }));
vi.mock("../api/farms", () => ({
  fetchFarmMembers: vi.fn(),
  fetchFarmStatistics: vi.fn(),
  fetchFarmDiagnoses: vi.fn(),
}));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const fetchFarmDiagnosesMock = vi.mocked(fetchFarmDiagnoses);

const SESSION = {
  access_token: "admin-token",
  user: { id: "admin-1", email: "admin@example.com" },
};

const ADMIN_PROFILE = {
  id: "admin-1",
  email: "admin@example.com",
  full_name: "Farm Admin",
  role: "farm_admin",
  farm_id: "farm-1",
  farm: { id: "farm-1", name: "Green Acres" },
  requires_onboarding: false,
};

const diagnoses = [
  {
    id: "diagnosis-1",
    farmer_id: "farmer-1",
    farmer_name: "Ada Farmer",
    disease: "Cassava mosaic",
    crop: "Cassava",
    confidence: 0.88,
    model_version: "1.0.0",
    created_at: "2026-08-19T10:00:00Z",
  },
  {
    id: "diagnosis-2",
    farmer_id: "farmer-2",
    farmer_name: "Bola Farmer",
    disease: "Tomato healthy",
    crop: "Tomato",
    confidence: 0.94,
    model_version: "1.0.0",
    created_at: "2026-08-18T10:00:00Z",
  },
];

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/admin/diagnostics"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  getSession.mockResolvedValue({ data: { session: SESSION } });
  fetchMeMock.mockResolvedValue(ADMIN_PROFILE);
  fetchFarmDiagnosesMock.mockResolvedValue(diagnoses);
});

describe("admin diagnostics", () => {
  it("requests the authenticated admin farm and renders real diagnosis rows", async () => {
    renderApp();

    expect(await screen.findByText("Ada Farmer")).toBeInTheDocument();
    expect(screen.getByText("Bola Farmer")).toBeInTheDocument();
    expect(screen.getByText("Cassava Mosaic Disease")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(fetchFarmDiagnosesMock).toHaveBeenCalledWith("farm-1", "admin-token");
  });

  it("shows loading, empty, and API error states", async () => {
    let resolveRequest;
    fetchFarmDiagnosesMock.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderApp();
    expect(await screen.findByText("Loading diagnoses...")).toBeInTheDocument();
    resolveRequest([]);
    expect(await screen.findByText("No diagnoses found")).toBeInTheDocument();

    fetchFarmDiagnosesMock.mockRejectedValueOnce(new Error("Could not load farm diagnoses."));
    renderApp();
    expect(await screen.findByText("Could not load farm diagnoses.")).toBeInTheDocument();
  });

  it("keeps search and status filtering on live rows", async () => {
    renderApp();
    await screen.findByText("Ada Farmer");

    fireEvent.change(screen.getByLabelText("Search diagnoses"), { target: { value: "tomato" } });
    expect(screen.queryByText("Ada Farmer")).not.toBeInTheDocument();
    expect(screen.getByText("Bola Farmer")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "sick" } });
    expect(screen.queryByText("Bola Farmer")).not.toBeInTheDocument();
  });

  it("keeps development preview diagnostics on mock data without an API call", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <DevPreviewProvider>
            <App />
          </DevPreviewProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Farm Admin" }));
    await screen.findByRole("heading", { name: "Green Valley Farm" });
    fireEvent.click(await screen.findByRole("link", { name: "Diagnostics" }));

    expect(await screen.findByText("Adamu Ibrahim")).toBeInTheDocument();
    expect(fetchFarmDiagnosesMock).not.toHaveBeenCalled();
  });
});
