import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "../pages/DashboardPage";

vi.mock("../api/health", () => ({
  fetchHealth: vi.fn().mockRejectedValue(new Error("offline")),
}));

describe("DashboardPage", () => {
  it("shows a message when the backend is unreachable", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText(/Backend is not reachable/)).toBeInTheDocument();
  });
});
