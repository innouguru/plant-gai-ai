import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { completeOnboarding } from "../api/onboarding";
import { acceptInvitation } from "../api/invitations";
import { hashParams } from "./hashParamsMock";

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

vi.mock("../auth/hashParams", async () => {
  const { hashParams } = await import("./hashParamsMock");
  return { getHashParams: () => hashParams };
});

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);

const SESSION = {
  access_token: "token",
  refresh_token: "rt",
  user: { id: "u1", email: "ada@example.com" },
};

const farmerProfile = {
  id: "u1",
  email: "ada@example.com",
  full_name: "Ada Farmer",
  role: "farmer",
  farm_id: "f1",
  farm: { id: "f1", name: "Green Acres" },
  requires_onboarding: false,
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

const onboardingProfile = {
  id: "u3",
  email: "bella@example.com",
  full_name: null,
  role: "farmer",
  farm_id: null,
  farm: null,
  requires_onboarding: true,
};

const onboardedFarmerProfile = {
  id: "u3",
  email: "bella@example.com",
  full_name: "Bella Farmer",
  role: "farmer",
  farm_id: "f1",
  farm: { id: "f1", name: "Green Acres" },
  requires_onboarding: false,
};

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function type(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  hashParams.delete("type");
  getSession.mockResolvedValue({ data: { session: null } });
  fetchMeMock.mockResolvedValue(null);
  vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
  vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ error: null });
  vi.mocked(supabase.auth.signUp).mockResolvedValue({ error: null, data: {} });
  vi.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null });
  vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null });
});

describe("auth flows", () => {
  it("logs a farmer in and lands on their home page", async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockResolvedValue(farmerProfile);

    renderApp("/login");

    await screen.findByLabelText("Email");
    type("Email", "ada@example.com");
    type("Password", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByRole("heading", { name: /A kuabo, Ada!/ }),
    ).toBeInTheDocument();
  });

  it("shows an error message for invalid credentials", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    renderApp("/login");

    await screen.findByLabelText("Email");
    type("Email", "ada@example.com");
    type("Password", "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByText("Email or password is incorrect. Please try again."),
    ).toBeInTheDocument();
  });

  it("lets an admin sign up and reach the admin dashboard", async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockResolvedValue(adminProfile);
    vi.mocked(completeOnboarding).mockResolvedValue({
      profile: adminProfile,
      farm: { id: "f1", name: "Green Acres" },
    });

    renderApp("/signup");

    await screen.findByLabelText("Farm name");
    type("Email", "ali@example.com");
    type("Password", "secret123");
    type("Farm name", "Green Acres");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Green Acres" })).toBeInTheDocument();
  });

  it("completes registration for an invited farmer", async () => {
    hashParams.set("type", "invite");
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockReset();
    fetchMeMock
      .mockResolvedValueOnce(onboardingProfile)
      .mockResolvedValueOnce(onboardedFarmerProfile);
    vi.mocked(acceptInvitation).mockResolvedValue({ profile: onboardedFarmerProfile });

    renderApp("/complete-registration");

    expect(
      await screen.findByRole("heading", { name: /Finish creating your account/ }),
    ).toBeInTheDocument();

    type("Full name", "Bella Farmer");
    type("Password", "secret123");
    type("Confirm password", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByRole("heading", { name: /A kuabo, Bella!/ }),
    ).toBeInTheDocument();
  });

  it("shows a message when the invitation link is invalid", async () => {
    renderApp("/complete-registration");

    expect(
      await screen.findByText(/This invitation link is invalid or has expired/),
    ).toBeInTheDocument();
  });
});