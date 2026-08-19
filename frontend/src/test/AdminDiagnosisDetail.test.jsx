import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { DevPreviewProvider } from "../preview/devPreview";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { fetchDiagnosis } from "../api/diagnosis";

vi.mock("../auth/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}));
vi.mock("../api/auth", () => ({ fetchMe: vi.fn() }));
vi.mock("../api/diagnosis", () => ({ fetchDiagnosis: vi.fn(), fetchHistory: vi.fn(), submitDiagnosis: vi.fn() }));
vi.mock("../api/farms", () => ({ fetchFarmMembers: vi.fn(), fetchFarmStatistics: vi.fn(), fetchFarmDiagnoses: vi.fn() }));
vi.mock("../api/onboarding", () => ({ completeOnboarding: vi.fn() }));
vi.mock("../api/invitations", () => ({ createInvitation: vi.fn(), acceptInvitation: vi.fn() }));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const fetchDiagnosisMock = vi.mocked(fetchDiagnosis);
const session = { access_token: "admin-token", user: { id: "admin-1" } };
const profile = {
  id: "admin-1", email: "admin@example.com", role: "farm_admin", farm_id: "farm-1",
  farm: { id: "farm-1", name: "Green Acres" }, requires_onboarding: false,
};
const diagnosis = {
  id: "diagnosis-1", farmer_id: "farmer-1", farmer_name: "Ada Farmer",
  disease: "Cassava mosaic", crop: "Cassava", confidence: 0.88,
  model_version: "1.0.0", created_at: "2026-08-19T10:00:00Z",
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/admin/diagnostics/diagnosis-1"]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  getSession.mockResolvedValue({ data: { session } });
  fetchMeMock.mockResolvedValue(profile);
  fetchDiagnosisMock.mockResolvedValue(diagnosis);
});

describe("admin diagnosis detail", () => {
  it("requests the selected id and renders real fields and farmer identity", async () => {
    renderDetail();
    expect(await screen.findByText("Ada Farmer", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("Cassava Mosaic Disease")).toBeInTheDocument();
    expect(screen.getByText(/88% Confidence/)).toBeInTheDocument();
    expect(fetchDiagnosisMock).toHaveBeenCalledWith("diagnosis-1", "admin-token");
  });

  it("shows loading and not-found states", async () => {
    let resolveRequest;
    fetchDiagnosisMock.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderDetail();
    expect(await screen.findByText("Loading diagnosis...")).toBeInTheDocument();
    resolveRequest(diagnosis);
    expect(await screen.findByText("Ada Farmer")).toBeInTheDocument();

    fetchDiagnosisMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 404 }));
    renderDetail();
    expect(await screen.findByText("We could not find that diagnosis.")).toBeInTheDocument();
  });

  it("shows API errors and preserves preview mock details", async () => {
    fetchDiagnosisMock.mockRejectedValueOnce(new Error("Service unavailable"));
    renderDetail();
    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();

    getSession.mockResolvedValue({ data: { session: null } });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider><DevPreviewProvider><App /></DevPreviewProvider></AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Farm Admin" }));
    await screen.findByRole("heading", { name: "Green Valley Farm" });
    fireEvent.click(screen.getAllByRole("link", { name: "Diagnostics" }).at(-1));
    await screen.findByRole("heading", { name: "Diagnostics" });
    fireEvent.click(screen.getByRole("link", { name: "Adamu Ibrahim" }));
    expect(await screen.findByText("Adamu Ibrahim")).toBeInTheDocument();
    expect(fetchDiagnosisMock).toHaveBeenCalledTimes(1);
  });
});
