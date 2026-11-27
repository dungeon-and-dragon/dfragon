# Bundled Korean OCR

- Model: official PaddlePaddle `korean_PP-OCRv5_mobile_rec_onnx`, revision `5c6f574b8e2230adf4287b33e736d71b9fabd28e`, Apache-2.0.
- `korean-rec.onnx` is the unmodified `inference.onnx` from that revision (about 13.4 MB).
- `korean-dict.txt` contains the official Korean model's `PostProcess.character_dict` in its original order, one entry per line. The decoder adds a space and the CTC blank.
- `provenance.json` records source URLs and checksums. Model bytes are checked into the repository so builds do not fetch a model.
- [`prepare-ocr-assets.mjs`](../../scripts/prepare-ocr-assets.mjs) checks these files against `provenance.json`, then copies the model and dictionary selected in [`ocr-model.config.mjs`](../../ocr-model.config.mjs) (the fine-tuned model by default) with ONNX Runtime Web's installed WASM runtime to `public/ocr`. Licenses and notices are distributed in the same directory.
- The app resizes each crop to height 48, normalizes BGR to `[-1, 1]` and fills a fixed `[1, 3, 48, 320]` tensor. Preprocessing is in [`src/features/capture-search/lib/ocr/`](../../src/features/capture-search/lib/ocr/).

The model includes modern Hangul syllables, but inclusion does not guarantee correct recognition of every font or nickname.
