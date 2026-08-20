import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { createInvitation, acceptInvitation } from "../api/invitations";
import { fetchFarmMembers } from "../api/farms";

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

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const fetchFarmMembersMock = vi.mocked(fetchFarmMembers);

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

function renderApp(route = "/admin/farmers") {
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
  fetchFarmMembersMock.mockResolvedValue([
    { id: "m1", email: "bella@example.com", full_name: "Bella Farmer", role: "farmer" },
  ]);
  vi.mocked(createInvitation).mockResolvedValue({
    id: "i1",
    farm_id: "f1",
    email: "carl@example.com",
    invited_name: null,
    status: "pending",
  });
  vi.mocked(acceptInvitation).mockResolvedValue({ profile: adminProfile });
});

describe("FarmersPage", () => {
  it("lists the members of the admin's farm", async () => {
    renderApp();

    expect(await screen.findByRole("heading", { name: "Farmers" })).toBeInTheDocument();
    expect(await screen.findByText("Bella Farmer")).toBeInTheDocument();
  });

  it("invites a farmer and confirms with a success message", async () => {
    renderApp();
    await screen.findByText("Bella Farmer");

    fireEvent.click(screen.getByRole("button", { name: "Invite New Farmer" }));

    const emailField = await screen.findByLabelText("Email");
    fireEvent.change(emailField, {
      target: { value: "carl@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Invitation" }));

    expect(
      await screen.findByText(/Invitation sent\. The farmer will receive an email/),
    ).toBeInTheDocument();
    expect(createInvitation).toHaveBeenCalledWith(
      "carl@example.com",
      null,
      "token",
    );
  });
});