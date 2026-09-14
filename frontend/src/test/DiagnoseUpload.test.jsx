import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { submitDiagnosis } from "../api/diagnosis";

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

const SESSION = { access_token: "token", refresh_token: "rt", user: { id: "u1", email: "a@b.com" } };
const farmerProfile = {
  id: "u1",
  email: "a@b.com",
  full_name: "A Farmer",
  role: "farmer",
  farm_id: "f1",
  farm: { id: "f1", name: "Farm" },
  requires_onboarding: false,
};

function renderApp(route = "/diagnose") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function makeFile({ name = "leaf.jpg", type = "image/jpeg", bytes = 5000 } = {}) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function selectFile(file) {
  const input = document.querySelector('input[type="file"]:not([capture])');
  fireEvent.change(input, { target: { files: [file] } });
}

describe("Diagnose upload normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: SESSION } });
    fetchMeMock.mockResolvedValue(farmerProfile);
  });

  it("shows supported plants guidance", async () => {
    renderApp("/diagnose");
    expect(await screen.findByText(/Supported plants: Cashew, Cassava, Maize, Tomato/)).toBeInTheDocument();
    expect(screen.getByText(/For best results, use a clear photo of a leaf/)).toBeInTheDocument();
  });

  it("small JPEG remains valid and shows preview", async () => {
    renderApp("/diagnose");
    await screen.findByRole("button", { name: "Upload Photo" });
    selectFile(makeFile({ type: "image/jpeg", bytes: 5000 }));
    expect(await screen.findByRole("button", { name: "Use Photo" })).toBeInTheDocument();
  });

  it("HEIC shows clear unsupported message and does not silently mislabel", async () => {
    renderApp("/diagnose");
    await screen.findByRole("button", { name: "Upload Photo" });
    selectFile(makeFile({ name: "photo.heic", type: "image/heic", bytes: 5000 }));
    expect(await screen.findByText(/HEIC image is not supported/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Photo" })).not.toBeInTheDocument();
  });

  it("HEIC with uppercase extension also rejected", async () => {
    renderApp("/diagnose");
    await screen.findByRole("button", { name: "Upload Photo" });
    selectFile(makeFile({ name: "IMG_1234.HEIC", type: "", bytes: 5000 }));
    expect(await screen.findByText(/HEIC image is not supported/)).toBeInTheDocument();
  });
});

describe("client timeout handling", () => {
  it("surfaces 413 too large with backend message, not network", async () => {
    const { submitDiagnosis: mockSubmit } = await import("../api/diagnosis");
    vi.mocked(mockSubmit).mockRejectedValueOnce(Object.assign(new Error("The photo is too large. Please upload one that is 10 MB or smaller."), { status: 413 }));
    renderApp("/diagnose");
    await screen.findByRole("button", { name: "Upload Photo" });
    selectFile(makeFile({ type: "image/jpeg", bytes: 5000 }));
    await screen.findByRole("button", { name: "Use Photo" });
    fireEvent.click(screen.getByRole("button", { name: "Use Photo" }));
    expect(await screen.findByText(/The photo is too large/)).toBeInTheDocument();
  });
});
