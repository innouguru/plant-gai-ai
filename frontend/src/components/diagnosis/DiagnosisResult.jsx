import { getClassInfo } from "../../data/crops";
import { formatRelativeTime } from "../../data/dates";
import { DISCLAIMER } from "../../data/devMocks";
import CropThumb from "../ui/CropThumb";
import StatusBadge from "../ui/StatusBadge";

// Configurable low-confidence threshold for user-facing warning only.
// Not scientifically calibrated and does not reliably detect non-leaf images;
// high softmax can still occur for OOD inputs. Keep as guidance, not rejection.
export const LOW_CONFIDENCE_THRESHOLD = 70;

function DiagnosisResult({ diagnosis, imageUrl }) {
  const info = getClassInfo(diagnosis.className);
  const isLowConfidence = typeof diagnosis.confidence === "number" && diagnosis.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <div className="result-card">
      <div className="result-head">
        {imageUrl ? (
          <img className="result-thumb" src={imageUrl} alt={`${info.crop} leaf used for diagnosis`} />
        ) : (
          <CropThumb crop={info.crop} size="lg" />
        )}
        <div>
          <p className="result-crop">{info.crop}</p>
          <StatusBadge status={info.healthy ? "healthy" : "sick"} />
        </div>
      </div>

      <h1 className="result-disease">{info.diseaseDisplay}</h1>
      <p className="result-confidence">
        {diagnosis.confidence}% Confidence
        {diagnosis.scannedAt ? ` • ${formatRelativeTime(diagnosis.scannedAt)}` : ""}
      </p>

      {isLowConfidence && (
        <p className="form-error" role="alert" style={{ marginTop: "0.75rem" }}>
          Low confidence. Please retake a clear photo of a supported plant leaf.
        </p>
      )}

      {imageUrl && (
        <img className="result-image" src={imageUrl} alt={`${info.crop} leaf used for diagnosis`} />
      )}

      <div className="result-section">
        <h3>What this means</h3>
        <p>{info.whatThisMeans}</p>
      </div>

      <div className="result-section">
        <h3>What you can do</h3>
        <p>{info.whatYouCanDo}</p>
      </div>

      <p className="disclaimer">{DISCLAIMER}</p>
    </div>
  );
}

export default DiagnosisResult;