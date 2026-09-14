import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DiagnosisResult, { LOW_CONFIDENCE_THRESHOLD } from "../components/diagnosis/DiagnosisResult";

function makeDiagnosis(overrides = {}) {
  return {
    className: "Cassava mosaic",
    confidence: 91,
    scannedAt: "2026-01-01T10:00:00Z",
    ...overrides,
  };
}

describe("DiagnosisResult confidence warning", () => {
  it("does not show low confidence warning for high confidence", () => {
    render(<DiagnosisResult diagnosis={makeDiagnosis({ confidence: 91 })} imageUrl={null} />);
    expect(screen.queryByText(/Low confidence/i)).not.toBeInTheDocument();
  });

  it("shows low confidence warning below threshold", () => {
    render(<DiagnosisResult diagnosis={makeDiagnosis({ confidence: 55 })} imageUrl={null} />);
    expect(screen.getByText(/Low confidence\. Please retake/i)).toBeInTheDocument();
  });

  it("threshold is configurable and exported", () => {
    expect(typeof LOW_CONFIDENCE_THRESHOLD).toBe("number");
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(70);
  });

  it("does not introduce unknown class", () => {
    const diag = makeDiagnosis({ confidence: 10, className: "Tomato healthy" });
    render(<DiagnosisResult diagnosis={diag} imageUrl={null} />);
    expect(screen.getByText(/Healthy Tomato Plant/i)).toBeInTheDocument();
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
  });

  it("preserves class name and confidence display", () => {
    render(<DiagnosisResult diagnosis={makeDiagnosis({ className: "Maize healthy", confidence: 85 })} imageUrl={null} />);
    expect(screen.getByText(/Healthy Maize Plant/i)).toBeInTheDocument();
    expect(screen.getByText(/85% Confidence/)).toBeInTheDocument();
  });
});
