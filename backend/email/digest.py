# ─────────────────────────────────────────────────────────────────
# email/digest.py — HTML email digest builder + Gmail SMTP sender
# Sends top-10 ranked eligible opportunities as a formatted table.
# Subject: "🎯 Your Daily Opportunities — {date}"
# ─────────────────────────────────────────────────────────────────

import smtplib
import logging
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from sqlalchemy.orm import Session

from backend.db.models import Opportunity, Profile
from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Badge colours per platform ────────────────────────────────────
PLATFORM_COLORS = {
    "internshala": "#1a73e8",
    "unstop": "#ff6b2b",
    "devpost": "#003e54",
}


def _platform_badge(platform: str) -> str:
    color = PLATFORM_COLORS.get(platform, "#666")
    return (
        f'<span style="background:{color};color:#fff;padding:2px 8px;'
        f'border-radius:12px;font-size:11px;font-weight:600;">'
        f"{platform.title()}</span>"
    )


def _score_bar(score: float) -> str:
    pct = int(score * 100)
    color = "#22c55e" if pct >= 70 else "#f59e0b" if pct >= 40 else "#ef4444"
    return (
        f'<div style="background:#e5e7eb;border-radius:4px;height:8px;width:80px;display:inline-block;">'
        f'<div style="background:{color};width:{pct}%;height:100%;border-radius:4px;"></div></div>'
        f' <span style="font-size:11px;color:#6b7280;">{pct}%</span>'
    )


def _build_html(opportunities: list[Opportunity], recipient_name: str) -> str:
    today = date.today().strftime("%B %d, %Y")
    rows_html = ""

    for opp in opportunities:
        deadline_str = opp.deadline.strftime("%b %d") if opp.deadline else "—"
        rows_html += f"""
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:12px 8px;">
            <div style="font-weight:600;color:#111827;">{opp.title}</div>
            <div style="font-size:12px;color:#6b7280;">{opp.company or "—"}</div>
          </td>
          <td style="padding:12px 8px;text-align:center;">{_platform_badge(opp.platform)}</td>
          <td style="padding:12px 8px;text-align:center;color:#374151;">{deadline_str}</td>
          <td style="padding:12px 8px;text-align:center;color:#374151;">{opp.stipend or "—"}</td>
          <td style="padding:12px 8px;text-align:center;">{_score_bar(opp.eligibility_score or 0)}</td>
          <td style="padding:12px 8px;text-align:center;">
            <a href="{opp.url}" style="background:#4f46e5;color:#fff;padding:6px 14px;
               border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Apply</a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>OpportunityScout Digest</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f9fafb;">
  <div style="max-width:700px;margin:32px auto;background:#fff;border-radius:16px;
       box-shadow:0 4px 24px rgba(0,0,0,0.07);overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;">🎯 OpportunityScout</h1>
      <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">
        Your personalised digest for {today}
      </p>
    </div>
    <!-- Greeting -->
    <div style="padding:24px 40px 0;">
      <p style="color:#374151;font-size:15px;">Hi {recipient_name},</p>
      <p style="color:#6b7280;font-size:14px;">
        Here are your top {len(opportunities)} matched opportunities ranked by eligibility, deadline urgency,
        and stipend. Good luck! 🚀
      </p>
    </div>
    <!-- Table -->
    <div style="padding:0 40px 32px;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">OPPORTUNITY</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">PLATFORM</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">DEADLINE</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">STIPEND</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">MATCH</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;"></th>
          </tr>
        </thead>
        <tbody>{rows_html}</tbody>
      </table>
    </div>
    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 40px;text-align:center;
         border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        Sent by OpportunityScout · Unsubscribe by removing your email from the Profile page.
      </p>
    </div>
  </div>
</body>
</html>"""


def send_digest(db: Session) -> None:
    """Fetch top-10 eligible opportunities and email the digest to the profile email."""
    profile = db.query(Profile).first()
    if not profile or not profile.email:
        logger.warning("No profile/email configured — skipping digest")
        return

    opps = (
        db.query(Opportunity)
        .filter(Opportunity.is_eligible == True)
        .order_by(Opportunity.rank.asc().nulls_last())
        .limit(10)
        .all()
    )

    if not opps:
        logger.info("No eligible opportunities to send")
        return

    html_body = _build_html(opps, profile.name or "there")
    today_str = date.today().strftime("%Y-%m-%d")
    subject = f"🎯 Your Daily Opportunities — {today_str}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_user
    msg["To"] = profile.email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.sendmail(settings.smtp_user, profile.email, msg.as_string())
        logger.info("Digest sent to %s", profile.email)

        # Mark sent
        for opp in opps:
            opp.is_sent = True
        db.commit()

    except Exception as exc:
        logger.error("Failed to send digest: %s", exc)
        raise
