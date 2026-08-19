import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { DevPreviewProvider, DEV_PREVIEW_ROLE_KEY } from "../preview/devPreview";
import { supabase } from "../auth/supabase";

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

function renderApp(route = "/login") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <DevPreviewProvider>
          <App />
        </DevPreviewProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  getSession.mockResolvedValue({ data: { session: null } });
  vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
});

afterEach(() => {
  window.localStorage.clear();
});

describe("development UI preview", () => {
  it("shows the preview selector on the login page in dev builds", async () => {
    renderApp("/login");

    expect(
      await screen.findByRole("heading", { name: "Development UI Preview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This mode is for local UI inspection only. It does not authenticate you."),
    ).toBeInTheDocument();
  });

  it("hides the preview selector when a production build is simulated", async () => {
    vi.stubEnv("DEV", false);

    renderApp("/login");

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Development UI Preview" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Farm Admin" })).not.toBeInTheDocument();
  });

  it("previews farm admin screens and persists the role", async () => {
    renderApp("/login");

    fireEvent.click(await screen.findByRole("button", { name: "Farm Admin" }));

    expect(await screen.findByRole("heading", { name: "Green Valley Farm" })).toBeInTheDocument();
    expect(window.localStorage.getItem(DEV_PREVIEW_ROLE_KEY)).toBe("farm_admin");
  });

  it("previews farmer screens and persists the role", async () => {
    renderApp("/login");

    fireEvent.click(await screen.findByRole("button", { name: "Farmer" }));

    expect(await screen.findByRole("heading", { name: /A kuabo, Amina!/ })).toBeInTheDocument();
    expect(window.localStorage.getItem(DEV_PREVIEW_ROLE_KEY)).toBe("farmer");
  });

  it("lets the previewing admin open other admin screens", async () => {
    renderApp("/login");

    fireEvent.click(await screen.findByRole("button", { name: "Farm Admin" }));

    await screen.findByRole("heading", { name: "Green Valley Farm" });
    fireEvent.click(screen.getByRole("link", { name: "Diagnostics" }));

    expect(await screen.findByRole("heading", { name: "Diagnostics" })).toBeInTheDocument();
  });

  it("restores the preview role across a refresh and enforces the role boundary", async () => {
    window.localStorage.setItem(DEV_PREVIEW_ROLE_KEY, "farmer");

    renderApp("/admin");

    await screen.findByRole("heading", { name: /A kuabo, Amina!/ });
    expect(screen.queryByRole("heading", { name: "Green Valley Farm" })).not.toBeInTheDocument();
  });

  it("exits preview back to the login flow without signing out or creating a session", async () => {
    renderApp("/login");

    fireEvent.click(await screen.findByRole("button", { name: "Farm Admin" }));
    await screen.findByRole("heading", { name: "Green Valley Farm" });

    fireEvent.click(screen.getAllByRole("button", { name: "Exit preview" })[0]);

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(window.localStorage.getItem(DEV_PREVIEW_ROLE_KEY)).toBeNull();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});