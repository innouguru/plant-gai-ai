import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";

vi.mock("../api/health", () => ({
  fetchHealth: vi.fn().mockResolvedValue({
    status: "ok",
    message: "Plant-GAI-AI API is running",
  }),
}));

describe("App", () => {
  it("renders the Plant-GAI-AI application shell and shows backend health", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Plant-GAI-AI" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText(/Plant-GAI-AI API is running/)).toBeInTheDocument();
  });
});
