from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64

app = Flask(__name__)
CORS(app)

print("Loading YOLO model...")
model = YOLO("yolov8n.pt")
print("YOLO loaded successfully!")


def decode_data_url(image_data: str):
    if not image_data:
        return None
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    image_bytes = base64.b64decode(image_data)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


@app.route("/detect", methods=["POST"])
def detect():
    try:
        data = request.get_json(force=True) or {}
        image = decode_data_url(data.get("image"))

        if image is None:
            return jsonify({"success": False, "error": "Invalid image received"}), 400

        img_h, img_w = image.shape[:2]
        results = model(image, verbose=False)
        detections = []

        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])

                w = max(1, x2 - x1)
                h = max(1, y2 - y1)

                detections.append({
                    "label": model.names[cls],
                    "confidence": round(conf * 100, 2),
                    "x": round(x1),
                    "y": round(y1),
                    "width": round(w),
                    "height": round(h),
                    "area": {
                        "x": round((x1 / img_w) * 100, 2),
                        "y": round((y1 / img_h) * 100, 2),
                        "width": round((w / img_w) * 100, 2),
                        "height": round((h / img_h) * 100, 2)
                    }
                })

        detections.sort(key=lambda d: d["confidence"], reverse=True)

        return jsonify({
            "success": True,
            "imageWidth": img_w,
            "imageHeight": img_h,
            "detections": detections
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
