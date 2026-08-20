import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { fetchFarmStatistics } from "../api/farms";
import { fetchMessages, sendMessage } from "../api/messages";

vi.mock("../auth/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

vi.mock("../api/auth", () => ({ fetchMe: vi.fn() }));
vi.mock("../api/onboarding", () => ({ completeOnboarding: vi.fn() }));
vi.mock("../api/invitations", () => ({
  createInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
}));
vi.mock("../api/farms", () => ({ fetchFarmMembers: vi.fn(), fetchFarmStatistics: vi.fn(), fetchFarmDiagnoses: vi.fn() }));
vi.mock("../api/messages", () => ({ fetchMessages: vi.fn(), markMessageRead: vi.fn(), sendMessage: vi.fn() }));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const fetchFarmStatisticsMock = vi.mocked(fetchFarmStatistics);
const fetchMessagesMock = vi.mocked(fetchMessages);
const sendMessageMock = vi.mocked(sendMessage);

const SESSION = {
  access_token: "token",
  refresh_token: "rt",
  user: { id: "u2", email: "ali@example.com" },
};

const adminProfile = {
  id: "u2",
  email: "ali@example.com",
  full_name: "Ali Admin",
  role: "farm_admin",
  farm_id: "f1",
  farm: { id: "f1", name: "Green Acres" },
  requires_onboarding: false,
};

function renderApp(route = "/admin") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: SESSION } });
  fetchMeMock.mockResolvedValue(adminProfile);
  fetchFarmStatisticsMock.mockResolvedValue({
    farm_id: "f1",
    farmer_count: 24,
    total_diagnoses: 156,
    healthy_diagnoses: 118,
    diseased_diagnoses: 38,
    disease_counts: { "Cassava mosaic": 14, "Tomato leaf blight": 9 },
    crop_counts: { Cassava: 86, Maize: 47, Tomato: 23 },
    top_diseases: [{ disease: "Cassava mosaic", count: 14 }],
    top_crops: [
      { crop: "Cassava", count: 86 },
      { crop: "Maize", count: 47 },
      { crop: "Tomato", count: 23 },
    ],
    recent_diagnoses: [
      { id: "d1", farmer_name: "Adamu Ibrahim", disease: "Cassava mosaic", crop: "Cassava", confidence: 0.87, farmer_id: "f1", created_at: "2026-08-19T10:00:00Z" },
      { id: "d2", farmer_name: "Bose Adeban", disease: "Maize healthy", crop: "Maize", confidence: 0.94, farmer_id: "f2", created_at: "2026-08-18T08:00:00Z" },
      { id: "d3", farmer_name: "Chinedu Okafor", disease: "Tomato leaf blight", crop: "Tomato", confidence: 0.83, farmer_id: "f3", created_at: "2026-08-17T14:00:00Z" },
    ],
  });
  fetchMessagesMock.mockResolvedValue([
    {
      id: "msg-1",
      sender_id: "f1",
      sender_name: "Adamu Ibrahim",
      recipient_id: "u2",
      recipient_name: "Ali Admin",
      body: "Good morning. My leaves are showing yellow marks.",
      read_at: "2026-08-19T09:45:00Z",
      created_at: "2026-08-19T09:40:00Z",
    },
  ]);
  sendMessageMock.mockResolvedValue({
    id: "msg-2",
    sender_id: "u2",
    sender_name: "Ali Admin",
    recipient_id: "f1",
    recipient_name: "Adamu Ibrahim",
    body: "Please send an update",
    read_at: null,
    created_at: "2026-08-19T09:50:00Z",
  });
});

describe("admin dashboard", () => {
  it("shows the farm name, summary stats, recent diagnoses, quick actions and top crops", async () => {
    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: "Green Acres" })).toBeInTheDocument();

    expect(screen.getByText("Total Farmers")).toBeInTheDocument();
    expect(screen.getByText("Diagnoses Run")).toBeInTheDocument();
    expect(screen.getByText("Identified Diseases")).toBeInTheDocument();

    expect(await screen.findByText("Adamu Ibrahim — Cassava")).toBeInTheDocument();
    expect(screen.getByText("Bose Adeban — Maize")).toBeInTheDocument();
    expect(screen.getByText("Chinedu Okafor — Tomato")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Invite New Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Generate Farm Report" })).toBeInTheDocument();

    expect(screen.getByText("Top Crops Scanned")).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
  });
});

describe("admin messages", () => {
  it("loads a conversation and sends a message through the API", async () => {
    renderApp("/admin/messages");

    expect(await screen.findByRole("heading", { name: "Adamu Ibrahim" })).toBeInTheDocument();

    const composer = screen.getByLabelText("Write a message");
    fireEvent.change(composer, { target: { value: "Please send an update" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Good morning. My leaves are showing yellow marks.")).toBeInTheDocument();
    expect(sendMessageMock).toHaveBeenCalledWith("f1", "Please send an update", "token");
    expect(screen.getAllByText("Please send an update")).toHaveLength(2);
  });
});