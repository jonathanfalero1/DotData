from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app)


HF_API_TOKEN = "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"   # <-- paste your HF token here


AVAILABLE_MODELS = {
    "Llama 3.1 8B (default)":  "meta-llama/Llama-3.1-8B-Instruct:cerebras",
    "Qwen 2.5 7B":             "Qwen/Qwen2.5-7B-Instruct:cerebras",
    "SmolLM3 3B (tiny/fast)":  "HuggingFaceTB/SmolLM3-3B:hf-inference",
    "DeepSeek R1 (reasoning)": "deepseek-ai/DeepSeek-R1:auto",
}

DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct:cerebras"
HF_URL        = "https://router.huggingface.co/v1/chat/completions"



SYSTEM_PROMPT = """You are a helpful immigration assistant.
When the user provides a USCIS form number, respond with exactly three sections, always using these exact labels:

**WHAT IT IS**
Explain what this form is and how the user will use it. Max 3 sentences, make them concise. Don't over-inform.

**HOW TO FILE**
Explain the steps to file this form in plain, simple English. Bullet points, no links.

**KNOW YOUR RIGHTS**
Explain the applicant's rights during this process — work authorization if applicable, what officers can and cannot ask, and any legal protections. Max 3 sentences.

Always start a new line after each sentence.
Always use plain English. No legal jargon. Write as if explaining to someone with no immigration background."""


def hf_headers():
    return {
        "Authorization": f"Bearer {HF_API_TOKEN}",
        "Content-Type":  "application/json",
    }


@app.route("/api/models", methods=["GET"])
def list_models():
    return jsonify({"models": AVAILABLE_MODELS})


@app.route("/api/chat", methods=["POST"])
def chat():
    data   = request.get_json()
    prompt = data.get("prompt", "").strip()
    model  = data.get("model", DEFAULT_MODEL)

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    if not HF_API_TOKEN or HF_API_TOKEN == "hf_YOUR_TOKEN_HERE":
        return jsonify({"error": "Please set your HF_API_TOKEN in server.py"}), 500

    payload = {
        "model":       model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens":  512,
        "temperature": 0.7,
        "stream":      True,
    }

    def generate():
        try:
            with requests.post(
                HF_URL,
                headers=hf_headers(),
                json=payload,
                stream=True,
                timeout=60,
            ) as r:
                if r.status_code == 401:
                    yield f"data: {json.dumps({'token': '❌ Invalid or missing token permission. Go to HF → Settings → Access Tokens and enable Make calls to Inference Providers.', 'done': True})}\n\n"
                    return
                if r.status_code == 503:
                    yield f"data: {json.dumps({'token': '⏳ Model is loading on HF servers — wait ~20 seconds and try again.', 'done': True})}\n\n"
                    return
                if not r.ok:
                    yield f"data: {json.dumps({'token': f'❌ HF API error {r.status_code}: {r.text[:300]}', 'done': True})}\n\n"
                    return

                for raw_line in r.iter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
                    if not line.startswith("data:"):
                        continue
                    body = line[5:].strip()
                    if body == "[DONE]":
                        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
                        break
                    try:
                        chunk = json.loads(body)
                        token = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
                    except Exception:
                        continue

        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'token': '❌ Timed out — try again in a few seconds.', 'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/health", methods=["GET"])
def health():
    token_ok = HF_API_TOKEN != "AIzaSyDN8GgTXX-0bLJgO1WXcEMUPO837cYvu14" and bool(HF_API_TOKEN)
    return jsonify({"status": "ok", "token_configured": token_ok})

GOOGLE_API_KEY = "AIzaSyDN8GgTXX-0bLJgO1WXcEMUPO837cYvu14"  

@app.route("/api/lawyers", methods=["POST"])
def find_lawyers():
    data    = request.get_json()
    zipcode = data.get("zipcode", "").strip()
    if not zipcode:
        return jsonify({"error": "Zipcode is required"}), 400

    try:
        # Step 1: convert zip to lat/lng
        geo_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={zipcode}&key={GOOGLE_API_KEY}"
        geo_res  = requests.get(geo_url, timeout=5).json()
        location = geo_res["results"][0]["geometry"]["location"]
        lat, lng = location["lat"], location["lng"]

        # Step 2: search for immigration lawyers nearby
        places_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius":   10000,  # 10km
            "keyword":  "immigration lawyer",
            "key":      GOOGLE_API_KEY,
        }
        places_res = requests.get(places_url, params=params, timeout=5).json()
        results    = places_res.get("results", [])[:3]  # top 3

        lawyers = []
        for r in results:
            lawyers.append({
                "name":    r.get("name"),
                "address": r.get("vicinity"),
                "rating":  r.get("rating", "N/A"),
                "open":    r.get("opening_hours", {}).get("open_now", None),
            })

        return jsonify({"lawyers": lawyers})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/followup", methods=["POST"])
def followup():
    data   = request.get_json()
    prompt = data.get("prompt", "").strip()
    model  = data.get("model", DEFAULT_MODEL)

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    system = "You are a helpful immigration assistant. They already have general information on their form and other steps they should follow. Answer the user's additional questions concisely and in plain English. Keep answers short and direct — no more than a short paragraph."

    payload = {
        "model":    model,
        "messages": [
            {"role": "system",  "content": system},
            {"role": "user",    "content": prompt},
        ],
        "max_tokens":  512,
        "temperature": 0.7,
        "stream":      True,
    }

    def generate():
        try:
            with requests.post(
                HF_URL,
                headers=hf_headers(),
                json=payload,
                stream=True,
                timeout=60,
            ) as r:
                if not r.ok:
                    yield f"data: {json.dumps({'token': f'❌ Error {r.status_code}', 'done': True})}\n\n"
                    return
                for raw_line in r.iter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
                    if not line.startswith("data:"):
                        continue
                    body = line[5:].strip()
                    if body == "[DONE]":
                        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
                        break
                    try:
                        chunk = json.loads(body)
                        token = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
                    except Exception:
                        continue
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    print("=" * 55)
    print("  Local AI Server  →  http://localhost:8000")
    print("  Backend: Hugging Face Router API")
    if HF_API_TOKEN == "hf_YOUR_TOKEN_HERE":
        print("\n  ⚠️  Set your HF_API_TOKEN before starting!")
    print("=" * 55)
    app.run(host="0.0.0.0", port=8000, debug=False)

