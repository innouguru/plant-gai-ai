import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
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
vi.mock("../api/farms", () => ({ fetchFarmMembers: vi.fn(), fetchFarmStatistics: vi.fn(), fetchFarmDiagnoses: vi.fn() }));

vi.mock("../auth/hashParams", async () => {
  const { hashParams } = await import("./hashParamsMock");
  return { getHashParams: () => hashParams };
});

const getSession = vi.mocked(supabase.auth.getSession);
const onAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
const updateUser = vi.mocked(supabase.auth.updateUser);

function renderApp(route = "/reset-password") {
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
  hashParams.delete("type");
  hashParams.delete("access_token");
  getSession.mockResolvedValue({ data: { session: null } });
  updateUser.mockResolvedValue({ error: null });
});

describe("password recovery", () => {
  it("shows reset form when hash contains type=recovery", async () => {
    hashParams.set("type", "recovery");
    renderApp();
    expect(await screen.findByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
  });

  it("shows invalid link when hash does not contain recovery", async () => {
    renderApp();
    expect(await screen.findByText(/This password reset link is invalid or has expired/)).toBeInTheDocument();
  });

  it("does NOT become invalid after Supabase clears hash and fires PASSWORD_RECOVERY", async () => {
    hashParams.set("type", "recovery");
    let authCallback;
    onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    renderApp();
    expect(await screen.findByRole("heading", { name: "Set a new password" })).toBeInTheDocument();

    // Simulate Supabase clearing hash and emitting PASSWORD_RECOVERY
    await act(async () => {
      hashParams.delete("type");
      hashParams.delete("access_token");
      authCallback("PASSWORD_RECOVERY", { access_token: "recovery-token", user: { id: "u1" } });
    });

    // Form should STILL be visible, not invalid
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(screen.queryByText(/This password reset link is invalid or has expired/)).not.toBeInTheDocument();
  });

  it("allows updateUser with valid recovery session", async () => {
    hashParams.set("type", "recovery");
    renderApp();
    await screen.findByRole("heading", { name: "Set a new password" });

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "newpass123" }));
    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
  });

  it("still rejects actually invalid link (no hash, no recovery event)", async () => {
    renderApp();
    expect(await screen.findByText(/This password reset link is invalid or has expired/)).toBeInTheDocument();

    // No PASSWORD_RECOVERY event fired, still invalid
    expect(screen.queryByRole("heading", { name: "Set a new password" })).not.toBeInTheDocument();
  });

  it("shows validation for mismatched passwords", async () => {
    hashParams.set("type", "recovery");
    renderApp();
    await screen.findByRole("heading", { name: "Set a new password" });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("PASSWORD_RECOVERY does not trigger normal login", () => {
  it("does not call fetchMe on PASSWORD_RECOVERY", async () => {
    const { fetchMe } = await import("../api/auth");
    const fetchMeMock = vi.mocked(fetchMe);
    let authCallback;
    onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    getSession.mockResolvedValue({ data: { session: null } });

    renderApp("/reset-password");
    // Wait for initial restore
    await act(async () => {});

    fetchMeMock.mockClear();
    await act(async () => {
      authCallback("PASSWORD_RECOVERY", { access_token: "recovery-token", user: { id: "u1" } });
    });

    // fetchMe should NOT have been called for recovery session
    expect(fetchMeMock).not.toHaveBeenCalled();
  });

  it("still calls fetchMe on SIGNED_IN", async () => {
    const { fetchMe } = await import("../api/auth");
    const fetchMeMock = vi.mocked(fetchMe);
    let authCallback;
    onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    getSession.mockResolvedValue({ data: { session: null } });
    fetchMeMock.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      full_name: "A",
      role: "farmer",
      farm_id: "f1",
      farm: { id: "f1", name: "F" },
      requires_onboarding: false,
    });

    renderApp("/login");
    await act(async () => {});
    fetchMeMock.mockClear();

    await act(async () => {
      authCallback("SIGNED_IN", { access_token: "token", user: { id: "u1" } });
    });

    expect(fetchMeMock).toHaveBeenCalledWith("token");
  });
});
