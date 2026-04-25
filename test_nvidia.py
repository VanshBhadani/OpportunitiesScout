from openai import OpenAI
from backend.config import get_settings

s = get_settings()
print(f"Key: {s.nvidia_api_key[:12]}...")
print(f"URL: {s.nvidia_base_url}")
print(f"Model: {s.nvidia_model}")

client = OpenAI(api_key=s.nvidia_api_key, base_url=s.nvidia_base_url)
resp = client.chat.completions.create(
    model=s.nvidia_model,
    messages=[{"role": "user", "content": "Reply with only the word: WORKING"}],
    temperature=0.1,
    max_tokens=20,
)
print("NVIDIA response:", resp.choices[0].message.content)
print("SUCCESS — NVIDIA NIM is working!")
