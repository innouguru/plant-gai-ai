# ML inference

## Model facts (final, immutable)

| Property | Value |
| --- | --- |
| File | `plant_disease_resnet18_best.pth` |
| Architecture | ResNet-18 |
| Input size | 224 x 224 |
| Class count | 22 |
| Test accuracy | 88.04% |

The 22 class names are recorded in `model/metadata/class_names.json`
(Cashew, Cassava, Maize, Tomato healthy/disease classes). Model facts are also
mirrored in `model/metadata/model_info.json`.

**This model is final.** It must never be retrained, fine-tuned, or replaced.

## Where weights live

```
model/weights/plant_disease_resnet18_best.pth   <- local only, Git-ignored
model/metadata/class_names.json                 <- committed
model/metadata/model_info.json                  <- committed
```

The `.pth` file must never be committed. Git ignores `*.pth`, `*.pt`, `*.ckpt`,
and the whole `model/weights/` directory.

## Current phase (Phase 0)

Phase 0 provides **scaffolding only**:

- `backend/app/services/ml/inference_service.py` — an `InferenceService`
  class with stubbed `load_model`, `preprocess`, and `predict` methods that
  raise `NotImplementedError`.
- `backend/app/services/ml/model_info.py` — static model metadata constants
  used as configuration.
- The backend **never** imports `torch` and never touches the `.pth` file.

Nothing is loaded, preprocessed, or predicted yet.

## Planned pipeline (Phase 2)

Phase 2 will implement, **after** the original training/inference
configuration has been verified:

1. **Load** — instantiate `torchvision.models.resnet18`, load `state_dict`
   from `model/weights/`, move to CPU, set to eval mode. One-time load cached
   in memory.
2. **Preprocess** — resize to 224x224 and apply the exact normalization used
   during training. Values will be copied from the verified notebook rather
   than invented.
3. **Predict** — forward pass, output logits, softmax.
4. **Confidence evaluation** — a confidence threshold policy (decided in
   Phase 2, with approval).
5. **Version** — the `MODEL_VERSION` (env `MODEL_VERSION`) is returned with
   each prediction and stored with diagnoses.

## Guardrails

- Do **not** change preprocessing (normalization, resize, class mapping,
  confidence thresholds) without explicit approval.
- Do **not** retrain or regenerate weights.
- Inference runs on CPU (`MODEL_DEVICE=cpu`) in the local and Render
  environments.