# Browser hold detector

- `holds-yolov4-tiny-fp16.onnx` is the one-class (climbing hold) YOLOv4-tiny detector behind the
  route editor's "Detect" button. It is a single self-contained file (11.8 MB, about 10.9 MB
  compressed) with no external data. `editor/model-worker.ts` loads it lazily in a dedicated Web
  Worker with ONNX Runtime Web's single-threaded WASM backend.
- Input `input`: float32 `[1, 3, 416, 416]`, NCHW, RGB scaled to 0-1, plain resize (no letterbox).
- Outputs: raw heads `boxes` `[1, 18, 13, 13]` and `confs` `[1, 18, 26, 26]`; each is 3 anchors ×
  `[tx, ty, tw, th, objectness, class]`. The names do not describe the contents. Anchors, masks,
  thresholds and decoding live in `editor/yolo.ts`.
- Opset 18, IR 10. Batch norm is folded into the convolutions.
- SHA-256: `473513aae8b49cb1513dc5840b4f9178e8d7f68adf38d895d2a93db66afa29ab`

## Provenance

- Darknet weights `lambda_backend/predict_microservice/weights/yolov4-tiny-obj.weights` (with
  `yolov4-tiny-obj.cfg` beside it), present at commit `f521d65`, the last commit of `main` before the rewrite. SHA-256 of the
  weights: `074e1076d834e78f7ffc9d090e89548a77095e89da61a0f7e29b73cd3df07939`.
- The licence of the training data is not documented in this repo.
- Converted with `darknet2pytorch` (`Darknet` module) and exported with torch 2.13
  (`torch.onnx.export`, opset 18, static 1×3×416×416). The exported float32 convolution weights
  and biases equal the Darknet weights with batch norm folded in, bit for bit.
- fp16 step: every Conv weight tensor is stored as float16 followed by a `Cast` to float32 node,
  which ONNX Runtime folds into a float32 constant when the session is created, so inference math
  stays float32. Conv biases and all other tensors stay float32.
- Cleanup: `producer_name`, `producer_version`, `domain`, every `doc_string` and every
  `metadata_props` entry (model, graph, nodes, initializers, value infos) are cleared; input and
  output names, shapes, node names and the opset are unchanged.

## Regenerate

1. Take the weights and cfg from the commit above and check the SHA-256.
2. Export float32 ONNX as described under Provenance, with the weights embedded in the file.
3. Load it with the `onnx` Python package, apply the fp16 step and the cleanup (clear the fields
   recursively through the protobuf descriptors), run `onnx.checker.check_model` and save as a
   single file.
4. Byte-search the result: it must contain none of `/Users/`, `/private/`, `/tmp`, `/home/` or
   `site-packages`.
5. Compare against the float32 export with onnxruntime-web and the `editor/yolo.ts` decoder on real
   wall photos: detection counts and boxes must match, with confidence differences below 0.02.

This README is not part of the deployed site.
