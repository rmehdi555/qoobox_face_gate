# Image Processing Stack

FaceGate processes faces on **CPU only**. No NVIDIA GPU or CUDA is required.

## Pipeline

1. The browser captures a webcam JPEG (`getUserMedia` + canvas).
2. OpenCV decodes the frame.
3. InsightFace finds every face and builds an embedding.
4. NumPy compares that embedding with stored vectors.
5. FER+ (ONNX Runtime) estimates expression; landmarks are the fallback.

## Libraries

| Tool | Role |
| --- | --- |
| **OpenCV** (`opencv-python-headless`) | Decode JPEG/PNG/WEBP, crop faces, convert to grayscale, resize for the emotion model. |
| **NumPy** | Hold embeddings and bounding boxes; compute cosine similarity. |
| **InsightFace** (`buffalo_s`) | Detect faces, read 5-point landmarks, and produce 512-d identity embeddings. |
| **ONNX Runtime** | Run InsightFace and the emotion model on CPU (`CPUExecutionProvider`). |
| **ONNX** | Model format used by InsightFace and FER+. |
| **FER+** (`emotion-ferplus-8.onnx`) | Classify expression: happy, sad, angry, surprised, fearful, disgusted, contempt, neutral. |
| **Pillow** | Validate and handle uploaded image files in the admin panel. |

InsightFace also pulls **SciPy**, **scikit-image**, and **Cython** as install dependencies. They are not called directly by FaceGate code.

## What each step does

- **Detection** — InsightFace locates every face and returns a box (left to right).
- **Recognition** — The face embedding is matched against registered people. If similarity is above `FACE_RECOGNITION_THRESHOLD`, that numbered face is identified.
- **Expression** — FER+ labels the crop (e.g. smiling, angry, sad). If the ONNX file is missing, mouth/eye landmark ratios are used instead.

## Frontend capture

The live page uses the browser **MediaDevices API** to stream the camera and a **canvas** to send JPEG frames to `POST /api/recognition/recognize`. Boxes and labels are drawn on an overlay canvas.
