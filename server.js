const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || 'http://127.0.0.1:5001/detect';

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    base64Data: match[2]
  };
}

function safeJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (__) {
      return null;
    }
  }
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeProblemArea(area) {
  if (!area || typeof area !== 'object') return null;
  return {
    x: clampNumber(area.x, 0, 100, 35),
    y: clampNumber(area.y, 0, 100, 25),
    width: clampNumber(area.width, 10, 70, 35),
    height: clampNumber(area.height, 10, 70, 35)
  };
}

async function detectWithYolo(imageData) {
  try {
    const response = await fetch(YOLO_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !Array.isArray(data.detections)) return null;

    const usefulLabels = new Set([
      'sink', 'toilet', 'chair', 'bench', 'tv', 'laptop', 'keyboard', 'mouse',
      'bottle', 'cup', 'book', 'clock', 'cell phone', 'refrigerator', 'oven',
      'microwave', 'person', 'traffic light', 'fire hydrant'
    ]);

    const detections = data.detections
      .filter(d => Number(d.confidence || 0) >= 20)
      .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));

    const best = detections.find(d => usefulLabels.has(String(d.label || '').toLowerCase())) || detections[0];
    if (!best || !best.area) return null;

    return {
      label: best.label || 'object',
      confidence: Number(best.confidence || 0),
      problemArea: normalizeProblemArea(best.area),
      detections: detections.slice(0, 5)
    };
  } catch (_) {
    return null;
  }
}

app.post('/api/verify-image', async (req, res) => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
      return res.status(500).json({
        ok: false,
        error: 'Gemini API key is missing. Add GEMINI_API_KEY in your .env file.'
      });
    }

    const { imageData, title, description, category, location } = req.body || {};
    const parsed = parseDataUrl(imageData);

    if (!parsed) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid image data received.'
      });
    }

    const prompt = `You are an AI assistant for a college campus maintenance complaint system called CampusCare.
Analyze the uploaded complaint image and decide whether it is relevant to a campus maintenance issue.

Complaint details selected by student:
Title: ${title || 'Not provided'}
Description: ${description || 'Not provided'}
Selected Category: ${category || 'Not provided'}
Location: ${location || 'Not provided'}

Return ONLY valid JSON in this exact format:
{
  "valid": true or false,
  "detectedCategory": "Electrical" or "Plumbing" or "Sanitation" or "Security" or "Infrastructure" or "Furniture" or "General" or "Unrelated",
  "confidence": number from 0 to 100,
  "detectedObject": "short object name such as tap, fan, switch, light, chair, leak, dustbin, classroom",
  "reason": "short admin-friendly reason",
  "problemArea": {
    "x": number from 0 to 100,
    "y": number from 0 to 100,
    "width": number from 10 to 70,
    "height": number from 10 to 70
  }
}

The problemArea is only an approximate suggestion in percentage coordinates relative to the image.
Mark valid as false if the image is a selfie, random person photo, food, screenshot, unrelated object, or does not show a campus maintenance/problem context.
If the image is blurry but still seems related, use valid true with lower confidence.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const [geminiResponse, yoloResult] = await Promise.all([
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: parsed.mimeType,
                    data: parsed.base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: 'application/json'
          }
        })
      }),
      detectWithYolo(imageData)
    ]);

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      const message = geminiData?.error?.message || 'Gemini API request failed.';
      return res.status(500).json({ ok: false, error: message });
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const result = safeJsonFromText(text);

    if (!result) {
      return res.status(500).json({
        ok: false,
        error: 'AI response could not be read. Try again.'
      });
    }

    const geminiArea = normalizeProblemArea(result.problemArea);
    const finalArea = yoloResult?.problemArea || geminiArea;
    const detectedObject = yoloResult?.label || result.detectedObject || '';

    res.json({
      ok: true,
      result: {
        valid: !!result.valid,
        detectedCategory: result.detectedCategory || 'General',
        confidence: clampNumber(result.confidence, 0, 100, 0),
        reason: result.reason || 'AI verification completed.',
        detectedObject,
        problemArea: finalArea,
        yoloDetection: yoloResult ? {
          label: yoloResult.label,
          confidence: yoloResult.confidence,
          detections: yoloResult.detections
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Server error during AI verification.'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CampusCare running at http://localhost:${PORT}`);
  console.log(`YOLO service expected at ${YOLO_SERVICE_URL}`);
});
