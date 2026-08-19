import { Link } from "react-router-dom";
import { getClassInfo } from "../../data/crops";
import { formatRelativeTime } from "../../data/dates";
import CropThumb from "./CropThumb";
import StatusBadge from "./StatusBadge";

function DiagnosisCard({
  className = "Cassava healthy",
  confidence,
  scannedAt,
  imageUrl,
  to,
  badgeClassName = "",
  thumbSize = "",
  meta,
}) {
  const info = getClassInfo(className);
  const body = (
    <>
      {imageUrl ? (
        <img className="diagnosis-image" src={imageUrl} alt={`${info.crop} leaf photo`} />
      ) : (
        <CropThumb crop={info.crop} size={thumbSize} />
      )}
      <div className="diagnosis-card-main">
        <p className="diagnosis-crop">{info.crop}</p>
        <p className="diagnosis-disease">{info.diseaseDisplay}</p>
        <p className="diagnosis-meta">
          {confidence != null ? `${confidence}% Confidence` : ""}
          {confidence != null && scannedAt ? " • " : ""}
          {scannedAt ? formatRelativeTime(scannedAt) : meta}
        </p>
      </div>
      <StatusBadge status={info.healthy ? "healthy" : "sick"} className={badgeClassName} />
    </>
  );

  if (to) {
    return (
      <Link to={to} className="diagnosis-card">
        {body}
      </Link>
    );
  }
  return <article className="diagnosis-card">{body}</article>;
}

export default DiagnosisCard;