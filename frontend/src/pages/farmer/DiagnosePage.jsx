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
} from "../../api/client";

const STEP_CAPTURE = "capture";
const STEP_PREVIEW = "preview";
const STEP_ANALYZING = "analyzing";
const STEP_RESULT = "result";
const STEP_ERROR = "error";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];

function fileErrorFor(file) {
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
  if (error?.networkError) return NETWORK_ERROR_MESSAGE;
  if (error?.message) return error.message;
  return "We could not analyze the photo right now. Please try again.";
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

  function handleFile(nextFile) {
    if (!nextFile) return;
    const validationError = fileErrorFor(nextFile);
    if (validationError) {
      setError(validationError);
      setStep(STEP_CAPTURE);
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(nextFile);
    setImageUrl(URL.createObjectURL(nextFile));
    setResult(null);
    setError(null);
    setStep(STEP_PREVIEW);
  }

  function handleCaptureInput(event) {
    handleFile(event.target.files?.[0]);
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