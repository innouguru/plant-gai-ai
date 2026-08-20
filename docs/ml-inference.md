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

## Current implementation (Phase 2 complete)

Diagnosis inference is implemented with the final model and lazy loading:

- `backend/app/services/ml/inference_service.py` loads the ResNet-18
   checkpoint once, validates class metadata, preprocesses images, and runs
   CPU inference.
- Preprocessing is `Resize((224, 224))`, RGB conversion, `ToTensor()`, and
   ImageNet normalization with mean `[0.485, 0.456, 0.406]` and standard
   deviation `[0.229, 0.224, 0.225]`.
- Model loading is lazy; the checkpoint is not loaded at application import
   time.

## Implemented pipeline

1. **Load** — instantiate `torchvision.models.resnet18`, load `state_dict`
   from `model/weights/`, move to CPU, set to eval mode. One-time load cached
   in memory.
2. **Preprocess** — resize to 224x224, convert to RGB, and apply ImageNet
   normalization.
3. **Predict** — forward pass, output logits, softmax.
4. **Confidence evaluation** — return the top class and softmax confidence.
5. **Version** — the `MODEL_VERSION` (env `MODEL_VERSION`) is returned with
   each prediction and stored with diagnoses.

## Guardrails

- Do **not** change preprocessing (normalization, resize, class mapping,
  confidence thresholds) without explicit approval.
- Do **not** retrain or regenerate weights.
- Inference runs on CPU (`MODEL_DEVICE=cpu`) in the local and Render
  environments.