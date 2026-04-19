import sys, json, logging
sys.stdout.reconfigure(encoding='utf-8')
# Only show our logs, not httpx noise
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")

from backend.agent.eligibility import batch_check_eligibility

profile = {
    "skills": ["Python", "ML", "AI", "React"],
    "preferred_roles": ["Software Engineer", "ML Engineer"],
    "cgpa": 8.5,
    "resume_text": "Student at GCET Hyderabad, expert in Python ML and web development.",
}

opps = [
    {"title": "ML Research Intern", "company": "Google", "requirements": "Python, TensorFlow", "tags": ["ML", "Python"], "description": ""},
    {"title": "Finance Analyst", "company": "HSBC", "requirements": "CFA, Excel, finance", "tags": ["Finance"], "description": ""},
    {"title": "Full Stack Developer", "company": "Startup", "requirements": "React, Node.js", "tags": ["Web", "React"], "description": ""},
    {"title": "Data Science Intern", "company": "Flipkart", "requirements": "Python, pandas, SQL", "tags": ["Data", "Python"], "description": ""},
    {"title": "Marketing Intern", "company": "PepsiCo", "requirements": "Marketing, social media", "tags": ["Marketing"], "description": ""},
]

print(f"Sending {len(opps)} opportunities to GLM in ONE batch call...\n")
results = batch_check_eligibility(profile, opps)

print("\n=== RESULTS ===")
for i, (opp, res) in enumerate(zip(opps, results)):
    mark = "YES" if res["eligible"] else "NO "
    print(f"[{mark}] {opp['title']:30s} | Score: {res['score']:.2f} | {res['reason']}")
