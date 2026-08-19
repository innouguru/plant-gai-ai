/**
 * Supported model classes.
 *
 * This array MIRRORS `model/metadata/class_names.json` (22 classes) and is the
 * single frontend source of truth for crop/disease labels. Keep it in sync
 * with the model metadata. It is NOT the model itself and does not replace the
 * real inference response.
 */
export const CLASS_NAMES = [
  "Cashew anthracnose",
  "Cashew gumosis",
  "Cashew healthy",
  "Cashew leaf miner",
  "Cashew red rust",
  "Cassava bacterial blight",
  "Cassava brown spot",
  "Cassava green mite",
  "Cassava healthy",
  "Cassava mosaic",
  "Maize fall armyworm",
  "Maize grasshoper",
  "Maize healthy",
  "Maize leaf beetle",
  "Maize leaf blight",
  "Maize leaf spot",
  "Maize streak virus",
  "Tomato healthy",
  "Tomato leaf blight",
  "Tomato leaf curl",
  "Tomato septoria leaf spot",
  "Tomato verticulium wilt",
];

export const CROPS = ["Cashew", "Cassava", "Maize", "Tomato"];

/** Determine the crop from a class name, e.g. "Cassava mosaic" -> "Cassava". */
export function cropFromClass(className) {
  const found = CROPS.find((crop) => className.startsWith(crop));
  return found ?? "Plant";
}

/** A class name that contains "healthy" is a healthy plant. */
export function isHealthyClass(className) {
  return className.toLowerCase().includes("healthy");
}

/** Human-friendly status label for a class name. */
export function statusFromClass(className) {
  return isHealthyClass(className) ? "healthy" : "sick";
}

/** Human-friendly disease label; healthy classes read as "Healthy {Crop} Plant". */
export function diseaseLabelFromClass(className) {
  if (isHealthyClass(className)) {
    return `Healthy ${cropFromClass(className)} Plant`;
  }
  return className;
}