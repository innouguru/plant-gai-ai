function CropThumb({ crop, size = "" }) {
  const normalized = String(crop || "").toLowerCase();
  return (
    <span
      className={["crop-thumb", `crop-${normalized}`, size ? `crop-thumb-${size}` : ""]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {crop ? crop.slice(0, 2).toUpperCase() : "PL"}
    </span>
  );
}

export default CropThumb;