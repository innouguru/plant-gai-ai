import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import DiagnosisResult from "../../components/diagnosis/DiagnosisResult";
import { DEV_SAMPLE_DIAGNOSIS } from "../../data/devMocks";

const STEP_CAPTURE = "capture";
const STEP_PREVIEW = "preview";
const STEP_ANALYZING = "analyzing";
const STEP_RESULT = "result";

function DiagnosePage() {
  const captureInput = useRef(null);
  const uploadInput = useRef(null);
  const [step, setStep] = useState(STEP_CAPTURE);
  const [imageUrl, setImageUrl] = useState(null);
  const [result, setResult] = useState(null);

  function handleFile(file) {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
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

  function startAnalysis() {
    setStep(STEP_ANALYZING);
    window.setTimeout(() => {
      setResult(DEV_SAMPLE_DIAGNOSIS);
      setStep(STEP_RESULT);
    }, 1600);
  }

  function retake() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setResult(null);
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