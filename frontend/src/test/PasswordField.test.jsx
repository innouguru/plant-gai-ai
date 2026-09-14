import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PasswordField from "../components/ui/PasswordField";

function StatefulPasswordField(props) {
  const [value, setValue] = useState("");
  return <PasswordField {...props} value={value} onChange={(event) => setValue(event.target.value)} />;
}

function renderField(props) {
  return render(<StatefulPasswordField id="password" label="Password" {...props} />);
}

describe("PasswordField", () => {
  it("shows a Show password button and masks the input by default", () => {
    renderField();
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("reveals the password and labels the button Hide password after clicking Show password", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("masks the password again after clicking Hide password", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("keeps the typed value while toggling visibility", () => {
    renderField();
    const input = screen.getByLabelText("Password");
    fireEvent.change(input, { target: { value: "my-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveValue("my-secret");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveValue("my-secret");
  });

  it("forwards input props and keeps the label association", () => {
    renderField({ minLength: 6, required: true, autoComplete: "current-password" });
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("minLength", "6");
    expect(input).toHaveAttribute("autoComplete", "current-password");
    expect(input).toBeRequired();
  });
});