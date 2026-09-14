import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { fetchHistory } from "../api/diagnosis";

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
vi.mock("../api/diagnosis", () => ({ submitDiagnosis: vi.fn(), fetchHistory: vi.fn(() => Promise.resolve([])), fetchDiagnosis: vi.fn() }));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const signOutMock = vi.mocked(supabase.auth.signOut);

const SESSION = {
  access_token: "token",
  refresh_token: "rt",
  user: { id: "u1", email: "farmer@example.com" },
};

const farmerProfile = {
  id: "u1",
  email: "farmer@example.com",
  full_name: "Ada Farmer",
  role: "farmer",
  farm_id: "f1",
  farm: { id: "f1", name: "Green Acres" },
  requires_onboarding: false,
};

function renderApp(route = "/home") {
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
  fetchMeMock.mockResolvedValue(farmerProfile);
  signOutMock.mockResolvedValue({ error: null });
  vi.mocked(fetchHistory).mockResolvedValue([]);
});

describe("farmer shell logout", () => {
  it("renders a Log out button with type button", async () => {
    renderApp("/home");

    const button = await screen.findByRole("button", { name: "Log out" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("calls signOut and navigates to login on click", async () => {
    renderApp("/home");

    const button = await screen.findByRole("button", { name: "Log out" });
    fireEvent.click(button);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });
});
