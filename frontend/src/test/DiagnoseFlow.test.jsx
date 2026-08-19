import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { submitDiagnosis } from "../api/diagnosis";
import { NETWORK_ERROR_MESSAGE, SESSION_EXPIRED_MESSAGE } from "../api/client";

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
vi.mock("../api/diagnosis", () => ({ submitDiagnosis: vi.fn() }));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const submitDiagnosisMock = vi.mocked(submitDiagnosis);
const signOutMock = vi.mocked(supabase.auth.signOut);

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

const REAL_RESULT = {
  id: "diag-1",
  disease: "Cassava mosaic",
  confidence: 0.91,
  crop: "Cassava",
  model_version: "1.0.0",
  created_at: "2026-01-01T10:00:00Z",
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

function makeLeafFile({ type = "image/png", bytes = 1000 } = {}) {
  return new File([new Uint8Array(bytes)], "leaf.png", { type });
}

function selectLeafFile(file) {
  const uploadInput = document.querySelector('input[type="file"]:not([capture])');
  fireEvent.change(uploadInput, { target: { files: [file] } });
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: SESSION } });
  fetchMeMock.mockResolvedValue(farmerProfile);
});

describe("farmer diagnose flow", () => {
  it("analyzes a selected photo against the real backend and shows the result", async () => {
    const { promise, resolve } = deferred();
    submitDiagnosisMock.mockReturnValue(promise);
    renderApp("/diagnose");

    expect(await screen.findByRole("button", { name: "Take Photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Photo" })).toBeInTheDocument();

    selectLeafFile(makeLeafFile());
    expect(await screen.findByRole("button", { name: "Use Photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retake" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use Photo" }));

    expect(await screen.findByText(/Checking your leaf/)).toBeInTheDocument();
    expect(submitDiagnosisMock).toHaveBeenCalledTimes(1);
    expect(submitDiagnosisMock).toHaveBeenCalledWith(expect.any(File), SESSION.access_token);

    resolve(REAL_RESULT);

    expect(
      await screen.findByRole("heading", { name: "Cassava Mosaic Disease" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/91% Confidence/)).toBeInTheDocument();
    expect(screen.getByText("What this means")).toBeInTheDocument();
    expect(screen.getByText("What you can do")).toBeInTheDocument();
    expect(
      screen.getByText(/AI-assisted prediction and does not replace professional agricultural advice/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diagnose another plant" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View History" })).toBeInTheDocument();
  });

  it("lets the farmer retake a photo instead of using it", async () => {
    renderApp("/diagnose");

    await screen.findByRole("button", { name: "Upload Photo" });

    selectLeafFile(makeLeafFile());
    await screen.findByRole("button", { name: "Retake" });
    fireEvent.click(screen.getByRole("button", { name: "Retake" }));

    expect(screen.getByRole("button", { name: "Take Photo" })).toBeInTheDocument();
    expect(screen.queryByText("Use Photo")).not.toBeInTheDocument();
    expect(submitDiagnosisMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file type before uploading", async () => {
    renderApp("/diagnose");
    await screen.findByRole("button", { name: "Upload Photo" });

    selectLeafFile(makeLeafFile({ type: "text/plain" }));

    expect(
      await screen.findByText(/That image type is not supported/),
    ).toBeInTheDocument();
    expect(submitDiagnosisMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Take Photo" })).toBeInTheDocument();
  });

  it("rejects an oversized photo before uploading", async () => {
    renderApp("/diagnose");
    await screen.findByRole("button", { name: "Upload Photo" });

    selectLeafFile(makeLeafFile({ bytes: 10 * 1024 * 1024 + 1 }));

    expect(
      await screen.findByText(/The photo is too large/),
    ).toBeInTheDocument();
    expect(submitDiagnosisMock).not.toHaveBeenCalled();
  });

  it("shows an error card when the backend rejects the photo and lets the farmer retry", async () => {
    submitDiagnosisMock.mockRejectedValue(
      Object.assign(new Error("The photo could not be read. Please try a different photo."), {
        status: 422,
      }),
    );
    renderApp("/diagnose");

    await screen.findByRole("button", { name: "Upload Photo" });
    selectLeafFile(makeLeafFile());
    await screen.findByRole("button", { name: "Use Photo" });
    fireEvent.click(screen.getByRole("button", { name: "Use Photo" }));

    expect(
      await screen.findByText(/We could not analyze the photo/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The photo could not be read. Please try a different photo."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/We could not analyze the photo/)).toBeInTheDocument();
    expect(submitDiagnosisMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Choose another photo" }));
    expect(screen.getByRole("button", { name: "Take Photo" })).toBeInTheDocument();
    expect(screen.queryByText("Use Photo")).not.toBeInTheDocument();
  });

  it("shows a network message when the request fails to reach the backend", async () => {
    submitDiagnosisMock.mockRejectedValue(Object.assign(new Error(NETWORK_ERROR_MESSAGE), { networkError: true }));
    renderApp("/diagnose");

    await screen.findByRole("button", { name: "Upload Photo" });
    selectLeafFile(makeLeafFile());
    await screen.findByRole("button", { name: "Use Photo" });
    fireEvent.click(screen.getByRole("button", { name: "Use Photo" }));

    expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
  });

  it("signs the farmer out when the session has expired", async () => {
    submitDiagnosisMock.mockRejectedValue(
      Object.assign(new Error(SESSION_EXPIRED_MESSAGE), { status: 401, sessionExpired: true }),
    );
    renderApp("/diagnose");

    await screen.findByRole("button", { name: "Upload Photo" });
    selectLeafFile(makeLeafFile());
    await screen.findByRole("button", { name: "Use Photo" });
    fireEvent.click(screen.getByRole("button", { name: "Use Photo" }));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(signOutMock).toHaveBeenCalled();
  });
});