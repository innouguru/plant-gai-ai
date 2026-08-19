import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  email: "new@example.com",
  full_name: null,
  role: "farmer",
  farm_id: null,
  farm: null,
  requires_onboarding: true,
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

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: null } });
  fetchMeMock.mockResolvedValue(null);
  vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
});

describe("App routing", () => {
  it("redirects unauthenticated visitors to the login page", async () => {
    renderApp("/");

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("renders the login page at /login", async () => {
    renderApp("/login");

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("sends a logged-in farmer to their home page", async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockResolvedValue(farmerProfile);

    renderApp("/");

    expect(await screen.findByRole("heading", { name: /A kuabo, Ada!/ })).toBeInTheDocument();
  });

  it("keeps farmers out of admin routes", async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockResolvedValue(farmerProfile);

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /A kuabo, Ada!/ })).toBeInTheDocument();
  });

  it("shows the admin dashboard to a farm admin", async () => {
    getSession.mockResolvedValue({
      data: { session: { ...SESSION, user: { id: "u2", email: "ali@example.com" } } },
    });
    fetchMeMock.mockResolvedValue(adminProfile);

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: "Green Acres" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Welcome back, administrator. Here is an overview of crop health and registered farmers.",
      ),
    ).toBeInTheDocument();
  });

  it("sends users who still need onboarding to the farm setup page", async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockResolvedValue(onboardingProfile);

    renderApp("/home");

    expect(
      await screen.findByRole("heading", { name: "Welcome to Plant-GAI-AI" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Farm name")).toBeInTheDocument();
  });

  it("shows a retry screen when the profile cannot be loaded", async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockRejectedValue(new Error("backend down"));

    renderApp("/home");

    expect(
      await screen.findByText("We could not load your account details."),
    ).toBeInTheDocument();
  });

  it("sends a user with an expired session back to the login page", async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    const expired = new Error("Your session has expired. Please log in again.");
    expired.status = 401;
    expired.sessionExpired = true;
    fetchMeMock.mockRejectedValue(expired);

    renderApp("/home");

    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByText(/A kuabo, Ada!/)).not.toBeInTheDocument();
  });
});