import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import DiagnosisResult from "../../components/diagnosis/DiagnosisResult";
import { useAuth } from "../../auth/AuthContext";
import { submitDiagnosis } from "../../api/diagnosis";
import {
  isSessionExpiredError,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from "../../api/client";

const STEP_CAPTURE = "capture";
const STEP_PREVIEW = "preview";
const STEP_ANALYZING = "analyzing";
const STEP_RESULT = "result";
const STEP_ERROR = "error";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
const MAX_LONGEST_EDGE = 2048;
const JPEG_QUALITY = 0.85;
const SUPPORTED_PLANTS_TEXT = "Supported plants: Cashew, Cassava, Maize, Tomato.";
const SUPPORTED_PLANTS_HINT = "For best results, use a clear photo of a leaf from one of these plants.";

function isHeicFile(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "image/heic" || type === "image/heif" || type === "image/heic-sequence" || type === "image/heif-sequence" || name.endsWith(".heic") || name.endsWith(".heif");
}

function fileErrorFor(file) {
  if (isHeicFile(file)) {
    return "HEIC image is not supported. Please use JPEG/PNG/WebP/BMP or use Take Photo.";
  }
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return "That image type is not supported. Please upload a JPEG, PNG, WebP or BMP photo.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "The photo is too large. Please upload one that is 10 MB or smaller.";
  }
  return null;
}

function messageForError(error) {
  if (isSessionExpiredError(error)) return SESSION_EXPIRED_MESSAGE;
  // TIMEOUT_ERROR_MESSAGE already carries a distinct timeout copy; prefer its own message
  if (error?.timeoutError && error?.message) return error.message;
  if (error?.networkError) return NETWORK_ERROR_MESSAGE;
  if (error?.message) return error.message;
  return "We could not analyze the photo right now. Please try again.";
}

/**
 * Normalize large images to reduce upload size and Render processing time.
 * Resizes longest edge to MAX_LONGEST_EDGE and re-encodes as JPEG 0.85.
 * Returns original file if no normalization needed or if browser APIs unavailable.
 * Throws with user-facing message if HEIC cannot be decoded.
 */
async function normalizeForUpload(file) {
  // HEIC already handled in fileErrorFor, but double-check browser decodability
  if (isHeicFile(file)) {
    // Try to decode; if browser cannot, surface clear message instead of silent mislabel
    if (typeof createImageBitmap === "function") {
      try {
        const bmp = await createImageBitmap(file);
        bmp.close?.();
      } catch {
        throw new Error("HEIC image is not supported. Please use JPEG/PNG or Take Photo.");
      }
    } else {
      throw new Error("HEIC image is not supported. Please use JPEG/PNG or Take Photo.");
    }
  }

  // Only normalize browser-decodable supported types
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  // In test environment (jsdom), skip canvas decoding for mock files – return original quickly
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return file;
  }

  // Quick size/dimension check: need image dimensions for resize decision
  let width = 0;
  let height = 0;
  let bitmap = null;
  let imageUrl = null;
  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
    } else {
      // Fallback via Image element (for tests/jsdom where createImageBitmap missing)
      const img = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        imageUrl = url;
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Image could not be read."));
        el.src = url;
      });
      width = img.width;
      height = img.height;
    }
  } catch {
    // If we cannot read dimensions, return original (backend will handle)
    if (bitmap) bitmap.close?.();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    return file;
  }

  const longest = Math.max(width, height);
  const needsResize = longest > MAX_LONGEST_EDGE;
  const needsRecompress = file.size > 4 * 1024 * 1024; // >4MB worth recompressing even if dimensions OK

  if (!needsResize && !needsRecompress) {
    if (bitmap) bitmap.close?.();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    return file;
  }

  // Calculate target dimensions
  let targetW = width;
  let targetH = height;
  if (needsResize) {
    const scale = MAX_LONGEST_EDGE / longest;
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  try {
    // Use canvas to resize and re-encode as JPEG
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (bitmap) bitmap.close?.();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      return file;
    }

    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      bitmap.close();
    } else if (imageUrl) {
      // Fallback path already has image element
      const el = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image could not be read."));
        img.src = imageUrl;
      });
      ctx.drawImage(el, 0, 0, targetW, targetH);
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;

    const baseName = (file.name.split(".")[0] || "leaf").replace(/[^a-zA-Z0-9_-]/g, "_") || "leaf";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    if (bitmap) bitmap.close?.();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    return file;
  }
}

function DiagnosePage() {
  const { session, signOut } = useAuth();
  const captureInput = useRef(null);
  const uploadInput = useRef(null);
  const [step, setStep] = useState(STEP_CAPTURE);
  const [imageUrl, setImageUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleFile(nextFile) {
    if (!nextFile) return;
    const validationError = fileErrorFor(nextFile);
    if (validationError) {
      setError(validationError);
      setStep(STEP_CAPTURE);
      return;
    }
    // Preview uses original file for immediate feedback
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const previewUrl = URL.createObjectURL(nextFile);
    setImageUrl(previewUrl);

    // Normalize for upload (resize large images to JPEG)
    let uploadFile = nextFile;
    try {
      uploadFile = await normalizeForUpload(nextFile);
    } catch (normErr) {
      URL.revokeObjectURL(previewUrl);
      setError(normErr.message || "Image could not be processed. Please try JPEG/PNG.");
      setStep(STEP_CAPTURE);
      return;
    }

    setFile(uploadFile);
    setResult(null);
    setError(null);
    setStep(STEP_PREVIEW);
  }

  function handleCaptureInput(event) {
    handleFile(event.target.files?.[0]);
    // Reset input value so same file can be selected again
    if (event.target) event.target.value = "";
  }

  function openCamera() {
    captureInput.current?.click();
  }

  function openUpload() {
    uploadInput.current?.click();
  }

  async function startAnalysis() {
    setError(null);
    setStep(STEP_ANALYZING);
    try {
      const data = await submitDiagnosis(file, session?.access_token);
      setResult({
        className: data.disease,
        confidence: Math.round(data.confidence * 100),
        scannedAt: data.created_at,
      });
      setStep(STEP_RESULT);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        signOut();
      }
      setError(messageForError(err));
      setStep(STEP_ERROR);
    }
  }

  function retake() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setFile(null);
    setResult(null);
    setError(null);
    setStep(STEP_CAPTURE);
  }

  let content;
  if (step === STEP_CAPTURE) {
    content = (
      <div className="diagnose-card">
        <h2 className="card-title">Diagnose your plant</h2>
        <p className="card-subtitle">
          Take a clear photo of one leaf showing the part you are worried about.
        </p>
        <p className="card-subtitle" style={{ fontSize: "0.85em", opacity: 0.8 }}>
          {SUPPORTED_PLANTS_TEXT} {SUPPORTED_PLANTS_HINT}
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="capture-actions">
          <Button variant="primary" size="lg" block onClick={openCamera}>
            <Icon name="camera" />
            Take Photo
          </Button>
          <Button variant="outline" size="lg" block onClick={openUpload}>
            <Icon name="leaf" />
            Upload Photo
          </Button>
        </div>

        <input
          ref={captureInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCaptureInput}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={uploadInput}
          type="file"
          accept="image/*"
          onChange={handleCaptureInput}
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    );
  } else if (step === STEP_PREVIEW) {
    content = (
      <div className="diagnose-card">
        <h2 className="card-title">Review your photo</h2>
        <p className="card-subtitle">Does this look like the right leaf?</p>
        <img className="photo-preview" src={imageUrl} alt="Leaf photo to diagnose" />
        <div className="preview-actions">
          <Button variant="primary" onClick={startAnalysis}>
            Use Photo
          </Button>
          <Button variant="outline" onClick={retake}>
            Retake
          </Button>
        </div>
      </div>
    );
  } else if (step === STEP_ANALYZING) {
    content = (
      <div className="analyzing-screen" role="status">
        <span className="spinner" aria-hidden="true" />
        <h2>Checking your leaf…</h2>
        <p>This usually takes a few seconds.</p>
      </div>
    );
  } else if (step === STEP_ERROR) {
    content = (
      <div className="diagnose-card">
        <h2 className="card-title">We could not analyze the photo</h2>
        <p className="card-subtitle">{error}</p>
        <div className="preview-actions">
          <Button variant="primary" onClick={startAnalysis}>
            Try again
          </Button>
          <Button variant="outline" onClick={retake}>
            Choose another photo
          </Button>
        </div>
      </div>
    );
  } else {
    content = (
      <>
        <DiagnosisResult diagnosis={result} imageUrl={imageUrl} />
        <div className="aspect-result-actions">
          <Button variant="outline" block onClick={retake}>
            Diagnose another plant
          </Button>
          <Link to="/history" className="btn btn-primary btn-block">
            View History
          </Link>
        </div>
      </>
    );
  }

  return <div className="farmer-diagnose">{content}</div>;
}

export default DiagnosePage;
