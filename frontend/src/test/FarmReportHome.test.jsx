import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { fetchHistory } from "../api/diagnosis";
import { fetchFarmStatistics } from "../api/farms";

vi.mock("../auth/supabase", () => ({
  supabase: { auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(),
  } },
}));
vi.mock("../api/auth", () => ({ fetchMe: vi.fn() }));
vi.mock("../api/diagnosis", () => ({ fetchHistory: vi.fn(), fetchDiagnosis: vi.fn(), submitDiagnosis: vi.fn() }));
vi.mock("../api/farms", () => ({ fetchFarmMembers: vi.fn(), fetchFarmStatistics: vi.fn(), fetchFarmDiagnoses: vi.fn() }));
vi.mock("../api/onboarding", () => ({ completeOnboarding: vi.fn() }));
vi.mock("../api/invitations", () => ({ createInvitation: vi.fn(), acceptInvitation: vi.fn() }));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const fetchHistoryMock = vi.mocked(fetchHistory);
const fetchFarmStatisticsMock = vi.mocked(fetchFarmStatistics);
const session = { access_token: "token", user: { id: "user-1" } };
const admin = { id: "admin", email: "admin@example.com", role: "farm_admin", farm_id: "farm-1", farm: { name: "Green Acres" }, requires_onboarding: false };
const farmer = { id: "farmer", email: "farmer@example.com", role: "farmer", farm_id: "farm-1", farm: { name: "Green Acres" }, requires_onboarding: false };

function renderRoute(route) {
  return render(<MemoryRouter initialEntries={[route]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session } });
  fetchMeMock.mockResolvedValue(admin);
  fetchHistoryMock.mockResolvedValue([]);
  fetchFarmStatisticsMock.mockResolvedValue({
    farmer_count: 2, total_diagnoses: 3, healthy_diagnoses: 1, diseased_diagnoses: 2,
    disease_counts: { "Cassava mosaic": 2 }, crop_counts: { Cassava: 3 },
    top_diseases: [{ disease: "Cassava mosaic", count: 2 }],
    top_crops: [{ crop: "Cassava", count: 3 }], recent_diagnoses: [],
  });
});

describe("real report and farmer home data", () => {
  it("loads report values from farm statistics", async () => {
    renderRoute("/admin/report");
    expect(await screen.findByText("Green Acres")).toBeInTheDocument();
    expect(await screen.findByText("Crops scanned")).toBeInTheDocument();
    expect(screen.getAllByText(/Cassava/).length).toBeGreaterThan(0);
    expect(fetchFarmStatisticsMock).toHaveBeenCalledWith("farm-1", "token");
  });

  it("loads the farmer's most recent diagnosis from history", async () => {
    fetchMeMock.mockResolvedValue(farmer);
    fetchHistoryMock.mockResolvedValue([{
      id: "diagnosis-1", disease: "Cassava mosaic", confidence: 0.88,
      crop: "Cassava", model_version: "1.0.0", created_at: "2026-08-19T10:00:00Z",
    }]);
    renderRoute("/home");
    expect(await screen.findByText("Cassava Mosaic Disease")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cassava Mosaic Disease/ })).toHaveAttribute("href", "/history/diagnosis-1");
    expect(fetchHistoryMock).toHaveBeenCalledWith("token");
  });
});
