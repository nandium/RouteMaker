# Browser hold detector

`yolov4_1_3_416_416_static.onnx` is the static 416×416 ONNX export used by the
web route editor. It is loaded lazily in `model-worker.ts`; ONNX Runtime Web
uses its portable single-threaded WASM backend. This avoids cross-origin
isolation requirements while keeping inference comfortably interactive. The
adjacent `.onnx.data` file is the model's external weight data and must be
deployed beside the ONNX file.

Provenance: this checked-in static export is the deployment artifact (opset 18,
one class, anchors/masks documented in `yolo.ts`). SHA-256 hashes:

- ONNX: `4bef8cad2c133c23ff082562d9603e58905eef29782b655479efc309ae6bff89`
- external data: `d8fe5c0f556ba24ce5c334d104277b410abef5b2b613b2f09e1ee7081cd81ec4`

Keep these files at the stable `/model/` URL so browsers and a static-assets
deploy can cache them independently of the editor bundle.
