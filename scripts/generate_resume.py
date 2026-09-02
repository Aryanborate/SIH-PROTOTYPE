"""
Generates public/resume.pdf - an honest one-page resume built ONLY from
verified source material (same data as the website). Nothing is invented.

Edit the CONTACT line below with real links, then re-run:
    py -3 scripts/generate_resume.py
"""

from fpdf import FPDF

INK = (15, 23, 42)       # slate-900
MUTED = (100, 116, 139)  # slate-500
ACCENT = (79, 70, 229)   # indigo-600
LINE = (226, 232, 240)   # slate-200

CONTACT = "Pune, Maharashtra, India   ·   Portfolio: aditya-mengar.vercel.app"


class Resume(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=13)
        self.set_margins(16, 13, 16)
        self.set_title("Aditya Mengar - Resume")
        self.set_author("Aditya Mengar")
        self.add_page()

    def section(self, title):
        self.ln(4.2)
        self.set_font("helvetica", "B", 10.5)
        self.set_text_color(*ACCENT)
        self.cell(0, 5, title.upper(), new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*LINE)
        self.set_line_width(0.25)
        y = self.get_y() + 0.9
        self.line(16, y, 194, y)
        self.set_y(y + 2.2)
        self.set_text_color(*INK)

    def para(self, txt, size=9.2, style="", color=INK, h=4.5):
        self.set_font("helvetica", style, size)
        self.set_text_color(*color)
        self.multi_cell(0, h, txt, new_x="LMARGIN", new_y="NEXT")

    def entry(self, title, status, body):
        self.set_font("helvetica", "B", 9.6)
        self.set_text_color(*INK)
        self.cell(self.get_string_width(title) + 2, 4.8, title)
        self.set_font("helvetica", "I", 8.8)
        self.set_text_color(*MUTED)
        self.cell(0, 4.8, status, new_x="LMARGIN", new_y="NEXT")
        self.ln(0.6)
        self.para(body, size=9.0, color=INK)
        self.ln(0.8)

    def bullet(self, text, size=9.0):
        self.set_font("helvetica", "", size)
        self.set_text_color(*INK)
        self.set_x(18)
        self.multi_cell(172, 4.4, "-  " + text, new_x="LMARGIN", new_y="NEXT")


pdf = Resume()

# ── Header ────────────────────────────────────────────────────────────────
pdf.set_font("helvetica", "B", 22)
pdf.set_text_color(*INK)
pdf.cell(0, 9, "ADITYA MENGAR", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("helvetica", "", 10)
pdf.set_text_color(*ACCENT)
pdf.cell(0, 5.5, "Computer Engineering Student   ·   Data   ·   AI", new_x="LMARGIN", new_y="NEXT")
pdf.ln(1.2)
pdf.set_font("helvetica", "", 9)
pdf.set_text_color(*MUTED)
pdf.cell(0, 4.6, CONTACT, new_x="LMARGIN", new_y="NEXT")
pdf.set_draw_color(*ACCENT)
pdf.set_line_width(0.5)
pdf.line(16, pdf.get_y() + 1.6, 194, pdf.get_y() + 1.6)
pdf.set_y(pdf.get_y() + 4.5)

# ── Profile ───────────────────────────────────────────────────────────────
pdf.section("Profile")
pdf.para(
    "Computer Engineering student at AISSMS Institute of Information Technology "
    "(Savitribai Phule Pune University), building a technical foundation across data "
    "science, analytics and AI - learning the statistics properly, writing the SQL, and "
    "turning concepts into small, honest projects."
)

# ── Education ─────────────────────────────────────────────────────────────
pdf.section("Education")
pdf.entry(
    "B.E. Computer Engineering - Ongoing",
    "",
    "AISSMS Institute of Information Technology, Savitribai Phule Pune University.\n"
    "Core coursework across programming, data structures, mathematics and systems, "
    "with a personal focus on data science and AI.",
)

# ── Skills ────────────────────────────────────────────────────────────────
pdf.section("Skills")
skills = [
    ("Data & Analytics", "Data Science · Data Analytics · Statistical Modeling · Linear Regression · Predictive Analytics"),
    ("Programming / Technical", "SQL · C"),
    ("AI", "AI Literacy (developing)"),
]
for label, items in skills:
    pdf.set_font("helvetica", "B", 9.2)
    pdf.set_text_color(*INK)
    pdf.set_x(18)
    pdf.cell(44, 4.4, label)
    pdf.set_font("helvetica", "", 9.2)
    pdf.multi_cell(0, 4.4, items, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(0.6)

# ── Projects ──────────────────────────────────────────────────────────────
pdf.section("Projects")
pdf.entry(
    "AI + IoT Agricultural Monitoring",
    "Concept · in exploration",
    "Exploring how AI and IoT-style monitoring could detect crop threats earlier, so "
    "protection becomes targeted instead of routine. Currently at the problem-definition "
    "and research stage: sensing/data architecture and proof-of-concept scoping.\n"
    "Contribution: problem definition · AI/IoT monitoring research · early solution thinking.",
)
pdf.entry(
    "Live 3D Portfolio Website",
    "Live",
    "Designed and built a single-page, data-driven portfolio from scratch: React, "
    "TypeScript, Three.js (React Three Fiber), Tailwind CSS, Framer Motion. Real-time "
    "WebGL scenes, lazy-loaded 3D bundles, device-aware quality tiers, reduced-motion "
    "and WebGL fallbacks. Content lives in typed data files.",
)

# ── Learning & Programs ───────────────────────────────────────────────────
pdf.section("Learning & Programs")
pdf.bullet("Google Cloud Study Jam - hands-on cloud fundamentals (participation).")
pdf.bullet("IBM SkillsBuild - structured artificial intelligence learning track.")
pdf.bullet("Pregrad - technical learning programs across data and emerging technology.")
pdf.bullet(
    "Study areas: Natural Language Processing, Computer Vision, Cybersecurity, "
    "Digital Productivity."
)
pdf.bullet("Ongoing self-directed work in statistical modeling and analytics practice.")

# ── How I work ────────────────────────────────────────────────────────────
pdf.section("How I Work")
pdf.bullet("Honest numbers beat impressive ones - nothing is claimed without measurement.")
pdf.bullet("Understand before automating - every model used is one I can explain in plain language.")
pdf.bullet("Ship, then refine - version one exists so version two has something to improve.")

pdf.ln(3)
pdf.para(
    "References and credential scans available on request.",
    size=8.2,
    style="I",
    color=MUTED,
)

pdf.output("public/resume.pdf")
print(f"resume.pdf generated - pages: {len(pdf.pages)}")
