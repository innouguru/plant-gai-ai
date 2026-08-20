import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MessagesPage from "../pages/admin/MessagesPage";
import { fetchMessages, markMessageRead, sendMessage } from "../api/messages";
import { useDevPreview } from "../preview/devPreview";

const { SESSION, PROFILE } = vi.hoisted(() => ({
  SESSION: { access_token: "token" },
  PROFILE: { id: "admin-1", farmId: "farm-1" },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    session: SESSION,
    profile: PROFILE,
  })),
}));
vi.mock("../preview/devPreview", () => ({ useDevPreview: vi.fn(() => ({ previewRole: null })) }));
vi.mock("../api/messages", () => ({
  fetchMessages: vi.fn(),
  markMessageRead: vi.fn(),
  sendMessage: vi.fn(),
}));

const message = (overrides = {}) => ({
  id: "message-1",
  sender_id: "farmer-1",
  sender_name: "Adamu Ibrahim",
  recipient_id: "admin-1",
  recipient_name: "Admin",
  body: "My cassava leaves are yellow.",
  read_at: "2026-08-19T09:45:00Z",
  created_at: "2026-08-19T09:40:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchMessages.mockResolvedValue([message()]);
  markMessageRead.mockResolvedValue(message({ read_at: "2026-08-19T10:00:00Z" }));
  sendMessage.mockResolvedValue(message({
    id: "message-2",
    sender_id: "admin-1",
    sender_name: "Admin",
    body: "Please send a clearer photo.",
    created_at: "2026-08-19T10:01:00Z",
  }));
});

afterEach(() => {
  cleanup();
});

describe("MessagesPage", () => {
  it("loads and renders a conversation thread", async () => {
    render(<MessagesPage />);

    await screen.findByRole("textbox", { name: "Write a message" });
    expect(screen.getAllByText("My cassava leaves are yellow.").length).toBeGreaterThan(0);
    expect(fetchMessages).toHaveBeenCalledWith("token");
  });

  it("shows loading, error, and empty states", async () => {
    let resolveMessages;
    fetchMessages.mockReturnValueOnce(new Promise((resolve) => { resolveMessages = resolve; }));
    render(<MessagesPage />);
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
    resolveMessages([]);
    await waitFor(() => expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument());
    expect(screen.getByText("No conversation selected")).toBeInTheDocument();

    cleanup();
    fetchMessages.mockRejectedValueOnce(new Error("Messages unavailable"));
    render(<MessagesPage />);
    expect(await screen.findByText("Messages unavailable")).toBeInTheDocument();
  });

  it("marks unread incoming messages as read", async () => {
    fetchMessages.mockResolvedValueOnce([message({ read_at: null })]);
    render(<MessagesPage />);

    await screen.findByRole("textbox", { name: "Write a message" });
    await waitFor(() => expect(markMessageRead).toHaveBeenCalledWith("message-1", "token"));
  });

  it("sends a message to the selected farmer", async () => {
    render(<MessagesPage />);
    const composer = await screen.findByRole("textbox", { name: "Write a message" });
    fireEvent.change(composer, {
      target: { value: "Please send a clearer photo." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(
      "farmer-1",
      "Please send a clearer photo.",
      "token",
    ));
    expect(await screen.findByText("Please send a clearer photo.")).toBeInTheDocument();
  });

  it("uses the development preview conversations without calling the API", async () => {
    useDevPreview.mockReturnValue({ previewRole: "farm_admin" });
    render(<MessagesPage />);

    await screen.findByRole("textbox", { name: "Write a message" });
    expect(screen.getByText("Good morning. My cassava leaves are showing yellow marks.")).toBeInTheDocument();
    expect(fetchMessages).not.toHaveBeenCalled();
  });
});
