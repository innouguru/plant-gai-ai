import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import Modal from "../components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";

afterEach(() => {
  cleanup();
});

describe("shared accessibility primitives", () => {
  it("exposes distinct accessible loading, empty, and error states", () => {
    const { rerender } = render(<LoadingState message="Loading diagnoses..." />);
    expect(screen.getByRole("status", { name: "Loading diagnoses..." })).toBeInTheDocument();

    rerender(<EmptyState title="No diagnoses yet" />);
    expect(screen.getByRole("status", { name: "No diagnoses yet" })).toBeInTheDocument();

    rerender(<ErrorState message="Could not load diagnoses." />);
    expect(screen.getByRole("alert", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("Could not load diagnoses.")).toBeInTheDocument();
  });

  it("labels the modal, focuses its close control, and restores focus on close", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
          <Modal open={open} title="Invite a farmer" onClose={() => setOpen(false)}>
            <p>Invitation form</p>
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const openButton = screen.getByRole("button", { name: "Open dialog" });
    openButton.focus();
    fireEvent.click(openButton);
    const dialog = screen.getByRole("dialog", { name: "Invite a farmer" });
    const closeButton = screen.getByRole("button", { name: "Close dialog" });

    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(document.activeElement).toBe(closeButton);

    fireEvent.click(closeButton);
    expect(screen.queryByRole("dialog", { name: "Invite a farmer" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openButton);
  });
});
