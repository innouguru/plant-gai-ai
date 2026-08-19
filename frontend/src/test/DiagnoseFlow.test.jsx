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

function renderApp(route = "/diagnose") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function makeLeafFile() {
  return new File([new Blob(["leaf"])], "leaf.png", { type: "image/png" });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: SESSION } });
  fetchMeMock.mockResolvedValue(farmerProfile);
});

describe("farmer diagnose flow", () => {
  it("walks through capture, preview, analyzing and result", async () => {
    renderApp("/diagnose");

    expect(await screen.findByRole("button", { name: "Take Photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Photo" })).toBeInTheDocument();

    const uploadInput = document.querySelector('input[type="file"]:not([capture])');
    fireEvent.change(uploadInput, { target: { files: [makeLeafFile()] } });

    expect(await screen.findByRole("button", { name: "Use Photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retake" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use Photo" }));

    expect(await screen.findByText(/Checking your leaf/)).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Cassava Mosaic Disease" }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/87% Confidence/)).toBeInTheDocument();
    expect(screen.getByText("What this means")).toBeInTheDocument();
    expect(screen.getByText("What you can do")).toBeInTheDocument();
    expect(
      screen.getByText(/advisory and does not replace professional agricultural advice/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diagnose another plant" })).toBeInTheDocument();
  });

  it("lets the farmer retake a photo instead of using it", async () => {
    renderApp("/diagnose");

    await screen.findByRole("button", { name: "Upload Photo" });

    const uploadInput = document.querySelector('input[type="file"]:not([capture])');
    fireEvent.change(uploadInput, { target: { files: [makeLeafFile()] } });

    await screen.findByRole("button", { name: "Retake" });
    fireEvent.click(screen.getByRole("button", { name: "Retake" }));

    expect(screen.getByRole("button", { name: "Take Photo" })).toBeInTheDocument();
    expect(screen.queryByText("Use Photo")).not.toBeInTheDocument();
  });
});