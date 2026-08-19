import { getClassInfo } from "../../data/crops";
import { formatRelativeTime } from "../../data/dates";
import { DISCLAIMER } from "../../data/devMocks";
import CropThumb from "../ui/CropThumb";
import StatusBadge from "../ui/StatusBadge";

function DiagnosisResult({ diagnosis, imageUrl }) {
  const info = getClassInfo(diagnosis.className);

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