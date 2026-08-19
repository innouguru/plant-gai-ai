import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { fetchHistory, fetchDiagnosis, submitDiagnosis } from "../api/diagnosis";

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
vi.mock("../api/diagnosis", () => ({
  submitDiagnosis: vi.fn(),
  fetchHistory: vi.fn(),
  fetchDiagnosis: vi.fn(),
}));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const fetchHistoryMock = vi.mocked(fetchHistory);
const fetchDiagnosisMock = vi.mocked(fetchDiagnosis);
const submitDiagnosisMock = vi.mocked(submitDiagnosis);

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

const newer = {
  id: "diag-2",
  disease: "Cassava mosaic",
  confidence: 0.95,
  crop: "Cassava",
  model_version: "1.0.0",
  created_at: "2026-01-02T10:00:00Z",
};

const older = {
  id: "diag-1",
  disease: "Tomato healthy",
  confidence: 0.88,
  crop: "Tomato",
  model_version: "1.0.0",
  created_at: "2026-01-01T10:00:00Z",
};

function renderApp(route = "/history") {
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
});

describe("farmer diagnosis history", () => {
  it("loads and shows the farmer's diagnoses newest first", async () => {
    fetchHistoryMock.mockResolvedValue([newer, older]);
    const { container } = renderApp("/history");

    expect(await screen.findByRole("heading", { name: "History" }, { timeout: 3000 })).toBeInTheDocument();
    expect(fetchHistoryMock).toHaveBeenCalledWith(SESSION.access_token);

    const cards = container.querySelectorAll(".diagnosis-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Cassava Mosaic Disease");
    expect(cards[0].textContent).toContain("95% Confidence");
    expect(cards[0].getAttribute("href")).toBe("/history/diag-2");
    expect(cards[1].textContent).toContain("Tomato");
    expect(cards[1].getAttribute("href")).toBe("/history/diag-1");
  });

  it("shows an empty state when there are no diagnoses", async () => {
    fetchHistoryMock.mockResolvedValue([]);
    renderApp("/history");

    expect(await screen.findByRole("heading", { name: "No diagnoses yet" })).toBeInTheDocument();
    expect(
      screen.getByText("Scans you run will appear here so you can review them any time."),
    ).toBeInTheDocument();
  });

  it("shows an error state and retries the request", async () => {
    fetchHistoryMock
      .mockRejectedValueOnce(Object.assign(new Error("We could not load your history."), { status: 500 }))
      .mockResolvedValueOnce([newer]);
    renderApp("/history");

    expect(await screen.findByText("We could not load your history.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Cassava Mosaic Disease")).toBeInTheDocument();
    expect(fetchHistoryMock).toHaveBeenCalledTimes(2);
  });

  it("shows the detail of a selected diagnosis", async () => {
    fetchDiagnosisMock.mockResolvedValue(older);
    renderApp("/history/diag-1");

    expect(await screen.findByRole("heading", { name: "Healthy Tomato Plant" })).toBeInTheDocument();
    expect(screen.getByText(/88% Confidence/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to History" })).toBeInTheDocument();
    expect(fetchDiagnosisMock).toHaveBeenCalledWith("diag-1", SESSION.access_token);
  });

  it("shows a not-found state for an unknown diagnosis id", async () => {
    fetchDiagnosisMock.mockRejectedValue(
      Object.assign(new Error("That diagnosis could not be found."), { status: 404 }),
    );
    renderApp("/history/nope");

    expect(await screen.findByText("We could not find that diagnosis.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to History" })).toBeInTheDocument();
  });

  it("persists a diagnosis and shows it in history after the result", async () => {
    submitDiagnosisMock.mockResolvedValue(newer);
    fetchHistoryMock.mockResolvedValue([newer]);
    renderApp("/diagnose");

    await screen.findByRole("button", { name: "Take Photo" });

    const uploadInput = document.querySelector('input[type="file"]:not([capture])');
    fireEvent.change(uploadInput, {
      target: { files: [new File([new Uint8Array([1, 2, 3])], "leaf.png", { type: "image/png" })] },
    });

    await screen.findByRole("button", { name: "Use Photo" });
    fireEvent.click(screen.getByRole("button", { name: "Use Photo" }));

    expect(
      await screen.findByRole("heading", { name: "Cassava Mosaic Disease" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "View History" }));

    expect(await screen.findByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(fetchHistoryMock).toHaveBeenCalledWith(SESSION.access_token);
    expect(await screen.findByText("Cassava Mosaic Disease")).toBeInTheDocument();
  });
});