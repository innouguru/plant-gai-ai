// ---------------------------------------------------------------------------
// DEVELOPMENT / MOCK DATA
//
// Live farmer diagnosis now runs against the real backend (Phase 2). History,
// admin dashboard, and messaging screens are not yet backed by services, so
// this file keeps clearly isolated sample data used ONLY to render the
// approved UI screens. Nothing here is served as if it came from the backend,
// and inference is never faked.
// ---------------------------------------------------------------------------

const DAY = 86400000;
const now = Date.now();
const at = (daysAgo, hour = 9) => {
  const date = new Date(now - daysAgo * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

// Farmer diagnosis history (Home "Recent Diagnosis" + History page).
export const devFarmerDiagnoses = [
  {
    id: "dev-d-1",
    className: "Cassava mosaic",
    confidence: 87,
    scannedAt: at(0, 10),
    imageUrl: null,
  },
  {
    id: "dev-d-2",
    className: "Tomato healthy",
    confidence: 94,
    scannedAt: at(1, 15),
    imageUrl: null,
  },
  {
    id: "dev-d-3",
    className: "Maize leaf blight",
    confidence: 81,
    scannedAt: at(3, 12),
    imageUrl: null,
  },
  {
    id: "dev-d-4",
    className: "Cassava healthy",
    confidence: 92,
    scannedAt: at(6, 8),
    imageUrl: null,
  },
];

export function devFarmerDiagnosisById(id) {
  return devFarmerDiagnoses.find((entry) => entry.id === id) ?? null;
}

// Admin dashboard summary statistics.
export const devAdminStats = {
  totalFarmers: 24,
  diagnosesRun: 156,
  identifiedDiseases: 8,
};

// Admin dashboard recent diagnoses feed.
export const devRecentFarmDiagnoses = [
  {
    id: "dev-r-1",
    farmer: "Adamu Ibrahim",
    className: "Cassava mosaic",
    confidence: 87,
    scannedAt: at(0, 10),
    imageUrl: null,
  },
  {
    id: "dev-r-2",
    farmer: "Bose Adeban",
    className: "Maize healthy",
    confidence: 94,
    scannedAt: at(0, 8),
    imageUrl: null,
  },
  {
    id: "dev-r-3",
    farmer: "Chinedu Okafor",
    className: "Tomato leaf blight",
    confidence: 83,
    scannedAt: at(1, 14),
    imageUrl: null,
  },
];

export function devFarmDiagnosisById(id) {
  return devRecentFarmDiagnoses.find((entry) => entry.id === id) ?? null;
}

// Admin dashboard "Top Crops Scanned" bar chart data.
export const devTopCrops = [
  { crop: "Cassava", percent: 55 },
  { crop: "Maize", percent: 30 },
  { crop: "Tomato", percent: 15 },
];

export const devCropDistribution = devTopCrops;

// Farm report data (print view).
export const devFarmReport = {
  reportDate: new Date().toISOString(),
  totalFarmers: 24,
  totalDiagnoses: 156,
  healthyDiagnoses: 118,
  sickDiagnoses: 38,
  identifiedDiseases: 8,
  cropsScanned: [
    { crop: "Cassava", count: 86 },
    { crop: "Maize", count: 47 },
    { crop: "Tomato", count: 23 },
  ],
  topDiseases: [
    { disease: "Cassava Mosaic Disease", count: 14 },
    { disease: "Tomato Leaf Blight", count: 9 },
    { disease: "Maize Fall Armyworm", count: 6 },
  ],
  recentDiagnoses: devRecentFarmDiagnoses,
};

// Admin Messages (UI structure only; no delivery is simulated).
export const devConversations = [
  {
    id: "dev-c-1",
    farmerName: "Adamu Ibrahim",
    preview: "Thank you, I will apply the advice today.",
    time: "10:12",
    unread: true,
    messages: [
      { id: "m1", from: "farmer", text: "Good morning. My cassava leaves are showing yellow marks.", time: "09:40" },
      { id: "m2", from: "admin", text: "Can you send a photo of the affected leaves?", time: "09:52" },
      { id: "m3", from: "farmer", text: "I added it to my diagnosis history just now.", time: "10:05" },
      { id: "m4", from: "admin", text: "Seen it. Follow the treatment advice and check again in one week.", time: "10:08" },
      { id: "m5", from: "farmer", text: "Thank you, I will apply the advice today.", time: "10:12" },
    ],
  },
  {
    id: "dev-c-2",
    farmerName: "Bose Adeban",
    preview: "Great, thank you. I will keep monitoring.",
    time: "Yesterday",
    unread: false,
    messages: [
      { id: "m1", from: "farmer", text: "Are my maize plants okay?", time: "Yesterday" },
      { id: "m2", from: "admin", text: "Yes, the scan came back healthy. Keep up the good work.", time: "Yesterday" },
      { id: "m3", from: "farmer", text: "Great, thank you. I will keep monitoring.", time: "Yesterday" },
    ],
  },
  {
    id: "dev-c-3",
    farmerName: "Chinedu Okafor",
    preview: "What should I do about the blight on my tomatoes?",
    time: "Mon",
    unread: false,
    messages: [
      { id: "m1", from: "farmer", text: "What should I do about the blight on my tomatoes?", time: "Mon" },
    ],
  },
];

export function devConversationById(id) {
  return devConversations.find((conversation) => conversation.id === id) ?? null;
}

// Admin "Farmers" listing (dev preview only; real members come from the API).
export const devFarmMembers = [
  { id: "dev-m-1", full_name: "Adamu Ibrahim", email: "adamu.ibrahim@example.com", role: "farmer" },
  { id: "dev-m-2", full_name: "Bose Adeban", email: "bose.adeban@example.com", role: "farmer" },
  { id: "dev-m-3", full_name: "Chinedu Okafor", email: "chinedu.okafor@example.com", role: "farmer" },
  { id: "dev-m-4", full_name: "Fechi Obi", email: "fechi.obi@example.com", role: "farmer" },
  { id: "dev-m-5", full_name: "Grace Akin", email: "grace.akin@example.com", role: "farmer" },
];

export function devFarmMemberById(id) {
  return devFarmMembers.find((member) => member.id === id) ?? null;
}

export const DEV_SAMPLE_DIAGNOSIS = {
  id: "dev-sample-1",
  className: "Cassava mosaic",
  confidence: 87,
  scannedAt: new Date().toISOString(),
};

export const DISCLAIMER =
  "This is an AI-assisted prediction and does not replace professional agricultural advice.";