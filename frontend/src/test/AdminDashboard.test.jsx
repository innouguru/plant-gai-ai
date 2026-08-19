import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";

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
vi.mock("../api/farms", () => ({ fetchFarmMembers: vi.fn() }));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);

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
});

describe("admin dashboard", () => {
  it("shows the farm name, summary stats, recent diagnoses, quick actions and top crops", async () => {
    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: "Green Acres" })).toBeInTheDocument();

    expect(screen.getByText("Total Farmers")).toBeInTheDocument();
    expect(screen.getByText("Diagnoses Run")).toBeInTheDocument();
    expect(screen.getByText("Identified Diseases")).toBeInTheDocument();

    expect(screen.getByText("Adamu Ibrahim — Cassava")).toBeInTheDocument();
    expect(screen.getByText("Bose Adeban — Maize")).toBeInTheDocument();
    expect(screen.getByText("Chinedu Okafor — Tomato")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Invite New Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Generate Farm Report" })).toBeInTheDocument();

    expect(screen.getByText("Top Crops Scanned")).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
  });
});

describe("admin messages", () => {
  it("shows a conversation and does not claim messages are delivered", async () => {
    renderApp("/admin/messages");

    expect(await screen.findByRole("heading", { name: "Adamu Ibrahim" })).toBeInTheDocument();

    const composer = screen.getByLabelText("Write a message");
    fireEvent.change(composer, { target: { value: "Please send an update" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText(
        /Messaging is not connected yet/,
      ),
    ).toBeInTheDocument();
  });
});