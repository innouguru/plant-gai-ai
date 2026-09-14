import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { supabase } from "../auth/supabase";
import { fetchMe } from "../api/auth";
import { fetchMessages, markMessageRead, sendMessage } from "../api/messages";
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
vi.mock("../api/farms", () => ({
  fetchFarmMembers: vi.fn(),
  fetchFarmStatistics: vi.fn(),
  fetchFarmDiagnoses: vi.fn(),
}));
vi.mock("../api/messages", () => ({
  fetchMessages: vi.fn(),
  markMessageRead: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock("../api/diagnosis", () => ({
  submitDiagnosis: vi.fn(),
  fetchHistory: vi.fn(() => Promise.resolve([])),
  fetchDiagnosis: vi.fn(),
}));

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMeMock = vi.mocked(fetchMe);
const fetchMessagesMock = vi.mocked(fetchMessages);
const sendMessageMock = vi.mocked(sendMessage);
const markMessageReadMock = vi.mocked(markMessageRead);
const fetchFarmMembersMock = vi.mocked(fetchFarmMembers);

const farmerSession = { access_token: "farmer-token", refresh_token: "rt", user: { id: "farmer-1", email: "farmer@example.com" } };
const adminSession = { access_token: "admin-token", refresh_token: "rt", user: { id: "admin-1", email: "admin@example.com" } };

const farmerProfile = {
  id: "farmer-1",
  email: "farmer@example.com",
  full_name: "Ada Farmer",
  role: "farmer",
  farm_id: "farm-1",
  farm: { id: "farm-1", name: "Green Acres", admin_id: "admin-1" },
  requires_onboarding: false,
};
const adminProfile = {
  id: "admin-1",
  email: "admin@example.com",
  full_name: "Ali Admin",
  role: "farm_admin",
  farm_id: "farm-1",
  farm: { id: "farm-1", name: "Green Acres" },
  requires_onboarding: false,
};

function renderAppAs(role, route) {
  if (role === "farmer") {
    getSession.mockResolvedValue({ data: { session: farmerSession } });
    fetchMeMock.mockResolvedValue(farmerProfile);
  } else {
    getSession.mockResolvedValue({ data: { session: adminSession } });
    fetchMeMock.mockResolvedValue(adminProfile);
  }
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
  fetchMessagesMock.mockResolvedValue([]);
  markMessageReadMock.mockImplementation((messageId) =>
    Promise.resolve({ id: messageId, read_at: new Date().toISOString() }),
  );
  sendMessageMock.mockResolvedValue({
    id: "msg-99",
    sender_id: "admin-1",
    sender_name: "Ali Admin",
    recipient_id: "farmer-1",
    recipient_name: "Ada Farmer",
    body: "Hello farmer",
    read_at: null,
    delivered_at: null,
    created_at: "2026-08-19T10:02:00Z",
  });
  fetchFarmMembersMock.mockResolvedValue([
    { id: "farmer-1", full_name: "Ada Farmer", email: "farmer@example.com", role: "farmer" },
    { id: "farmer-2", full_name: "Bose Ade", email: "bose@example.com", role: "farmer" },
  ]);
});

afterEach(() => {
  cleanup();
});

describe("farmer messaging", () => {
  it("farmer navigation includes Messages", async () => {
    renderAppAs("farmer", "/home");
    expect(await screen.findByRole("link", { name: "Messages" })).toBeInTheDocument();
  });

  it("farmer can access Messages route", async () => {
    renderAppAs("farmer", "/messages");
    expect(await screen.findByRole("heading", { name: "Messages" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMessagesMock).toHaveBeenCalledWith("farmer-token"));
  });

  it("farmer sees existing conversation", async () => {
    fetchMessagesMock.mockResolvedValue([
      {
        id: "m1",
        sender_id: "admin-1",
        sender_name: "Ali Admin",
        recipient_id: "farmer-1",
        recipient_name: "Ada Farmer",
        body: "Hello farmer, how is your crop?",
        read_at: null,
        created_at: "2026-08-19T10:00:00Z",
      },
    ]);
    renderAppAs("farmer", "/messages");
    expect(await screen.findByText("Hello farmer, how is your crop?")).toBeInTheDocument();
  });

  it("farmer can send a reply", async () => {
    fetchMessagesMock.mockResolvedValue([
      {
        id: "m1",
        sender_id: "admin-1",
        sender_name: "Ali Admin",
        recipient_id: "farmer-1",
        recipient_name: "Ada Farmer",
        body: "Hello",
        read_at: null,
        created_at: "2026-08-19T10:00:00Z",
      },
    ]);
    sendMessageMock.mockResolvedValue({
      id: "m2",
      sender_id: "farmer-1",
      sender_name: "Ada Farmer",
      recipient_id: "admin-1",
      recipient_name: "Ali Admin",
      body: "Thanks, all good!",
      read_at: null,
      delivered_at: null,
      created_at: "2026-08-19T10:05:00Z",
    });
    renderAppAs("farmer", "/messages");
    const composer = await screen.findByRole("textbox", { name: "Write a message" });
    fireEvent.change(composer, { target: { value: "Thanks, all good!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledWith("admin-1", "Thanks, all good!", "farmer-token"));
    expect((await screen.findAllByText("Thanks, all good!")).length).toBeGreaterThan(0);
  });

  it("farmer can start a conversation with the farm administrator", async () => {
    fetchMessagesMock.mockResolvedValue([]);
    renderAppAs("farmer", "/messages");
    const button = await screen.findByRole("button", { name: "Contact Administrator" });
    fireEvent.click(button);
    expect(await screen.findByPlaceholderText("Write a message…")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Farm Administrator" })).toBeInTheDocument();
    expect(screen.getByText("No messages yet. Send the first message below.")).toBeInTheDocument();
    expect(fetchFarmMembersMock).not.toHaveBeenCalled();
  });

  it("farmer can send the first message to the farm administrator", async () => {
    fetchMessagesMock.mockResolvedValue([]);
    sendMessageMock.mockResolvedValue({
      id: "m2",
      sender_id: "farmer-1",
      sender_name: "Ada Farmer",
      recipient_id: "admin-1",
      recipient_name: "Ali Admin",
      body: "Hello admin, I need help.",
      read_at: null,
      delivered_at: null,
      created_at: "2026-08-19T10:05:00Z",
    });
    renderAppAs("farmer", "/messages");
    fireEvent.click(await screen.findByRole("button", { name: "Contact Administrator" }));
    const composer = await screen.findByPlaceholderText("Write a message…");
    fireEvent.change(composer, { target: { value: "Hello admin, I need help." } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledWith("admin-1", "Hello admin, I need help.", "farmer-token"));
    expect((await screen.findAllByText("Hello admin, I need help.")).length).toBeGreaterThan(0);
    expect(await screen.findByText("✓ Sent")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ali Admin" })).toBeInTheDocument();
  });

  it("does not show Contact Administrator when a conversation already exists", async () => {
    fetchMessagesMock.mockResolvedValue([
      {
        id: "m1",
        sender_id: "admin-1",
        sender_name: "Ali Admin",
        recipient_id: "farmer-1",
        recipient_name: "Ada Farmer",
        body: "Hello farmer, how is your crop?",
        read_at: null,
        created_at: "2026-08-19T10:00:00Z",
      },
    ]);
    renderAppAs("farmer", "/messages");
    await screen.findByText("Hello farmer, how is your crop?");
    expect(screen.queryByRole("button", { name: "Contact Administrator" })).not.toBeInTheDocument();
  });
});

describe("admin new conversation", () => {
  it("admin sees New Message button when no conversations", async () => {
    fetchMessagesMock.mockResolvedValue([]);
    renderAppAs("admin", "/admin/messages");
    expect(await screen.findByRole("button", { name: "New Message" })).toBeInTheDocument();
  });

  it("admin can start new conversation by selecting farmer", async () => {
    fetchMessagesMock.mockResolvedValue([]);
    renderAppAs("admin", "/admin/messages");
    await screen.findByRole("button", { name: "New Message" });
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    expect(await screen.findByText("Select a farmer")).toBeInTheDocument();
    expect(fetchFarmMembersMock).toHaveBeenCalledWith("farm-1", "admin-token");
    expect(await screen.findByText("Ada Farmer")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ada Farmer"));
    expect(await screen.findByPlaceholderText("Write a message…")).toBeInTheDocument();
    expect(screen.getByText("No messages yet. Send the first message below.")).toBeInTheDocument();
  });

  it("admin can send first message in new conversation", async () => {
    fetchMessagesMock.mockResolvedValue([]);
    renderAppAs("admin", "/admin/messages");
    fireEvent.click(await screen.findByRole("button", { name: "New Message" }));
    await screen.findByText("Ada Farmer");
    fireEvent.click(screen.getByText("Ada Farmer"));
    const composer = await screen.findByPlaceholderText("Write a message…");
    fireEvent.change(composer, { target: { value: "Welcome to the farm!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledWith("farmer-1", "Welcome to the farm!", "admin-token"));
  });

  it("handles no eligible farmers", async () => {
    fetchMessagesMock.mockResolvedValue([]);
    fetchFarmMembersMock.mockResolvedValue([]);
    renderAppAs("admin", "/admin/messages");
    fireEvent.click(await screen.findByRole("button", { name: "New Message" }));
    expect(await screen.findByText("No farmers yet")).toBeInTheDocument();
  });

  it("polls for new messages", async () => {
    fetchMessagesMock.mockResolvedValue([]);
    renderAppAs("admin", "/admin/messages");
    await screen.findByRole("button", { name: "New Message" });
    expect(fetchMessagesMock).toHaveBeenCalledWith("admin-token");
  });
});
