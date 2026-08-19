// Supported diagnosis classes.
//
// IMPORTANT: this list mirrors `model/metadata/class_names.json` (22 classes) so the UI
// stays aligned with the trained model. If the model metadata changes, update both files.
// The real inference service is not connected yet; these names are used by dev/mock data only.

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

const CROPS = ["Cashew", "Cassava", "Maize", "Tomato"];

const DISPLAY_OVERRIDES = {
  "Maize grasshoper": "Maize Grasshopper",
  "Tomato verticulium wilt": "Tomato Verticillium Wilt",
  "Cassava mosaic": "Cassava Mosaic Disease",
};

const SICK_ADVICE = {
  "Cassava mosaic": {
    whatThisMeans:
      "Your cassava plant is showing the leaf pattern that comes with Cassava Mosaic Disease, which is spread by whiteflies and infected cuttings.",
    whatYouCanDo:
      "Remove and destroy badly affected plants, plant disease-free cuttings next season, and control whiteflies. Ask an agricultural officer about resistant varieties.",
  },
  "Tomato leaf blight": {
    whatThisMeans:
      "Your tomato plant shows signs of leaf blight, a fungal disease that spreads quickly in warm, damp conditions.",
    whatYouCanDo:
      "Remove affected leaves, improve air flow between plants, water at the base rather than overhead, and ask an agricultural officer before applying fungicide.",
  },
  "Maize fall armyworm": {
    whatThisMeans:
      "Your maize shows damage typical of Fall Armyworm, an insect that attacks young plants and can spread across the field quickly.",
    whatYouCanDo:
      "Scout young plants early, remove egg masses and damaged leaves, and use approved control methods. Contact your extension officer for advice.",
  },
};

function titleCase(value) {
  return value.replace(/(^\w|\s\w)/g, (match) => match.toUpperCase());
}

function defaultSickMeaning(crop, display) {
  return `Your ${crop.toLowerCase()} plant shows signs of ${display}. Catching it early helps you protect the rest of your crops.`;
}

function defaultSickAdvice() {
  return "Remove badly affected leaves, keep the disease from spreading to healthy plants, and talk to an agricultural officer about the right treatment.";
}

export function getClassInfo(className) {
  const raw = String(className || "");
  const crop = CROPS.find((c) => raw.startsWith(c)) ?? raw.split(" ")[0] ?? "Plant";
  const rest = raw.split(" ").slice(1).join(" ").toLowerCase().trim();
  const healthy = rest === "healthy";

  const diseaseDisplay = healthy
    ? `Healthy ${crop} Plant`
    : (DISPLAY_OVERRIDES[raw] ?? titleCase(rest));

  let whatThisMeans;
  let whatYouCanDo;
  if (healthy) {
    whatThisMeans = `${crop} plant looks healthy. No signs of common diseases were detected in this photo.`;
    whatYouCanDo =
      "Keep up regular watering and pest control, and continue checking your plants for changes.";
  } else {
    const advice = SICK_ADVICE[raw];
    whatThisMeans = advice?.whatThisMeans ?? defaultSickMeaning(crop, diseaseDisplay);
    whatYouCanDo = advice?.whatYouCanDo ?? defaultSickAdvice();
  }

  return {
    className: raw,
    crop,
    healthy,
    diseaseDisplay,
    whatThisMeans,
    whatYouCanDo,
  };
}

export function cropOf(className) {
  return getClassInfo(className).crop;
}