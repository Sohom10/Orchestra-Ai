# 🎻 Orchestra AI — Swarm Intelligence Research Platform

Orchestra AI is a state-of-the-art, multi-agent cooperative research platform that automates deep data context scraping, narrative synthesis, adversarial validation, and period-accurate stock media visualization. 

Powered by **LangGraph**, **Groq**, and **Google Gemini**, the application deploys an autonomous swarm to produce publication-grade research papers. It features a retro-futuristic dark neon interface equipped with comprehensive PDF/Word export tools.

---

## 🚀 Visual Interface Audits & Screenshots

*Here is a preview of the premium, sepia-toned glassmorphism user interface. You can save your screenshots in a folder named `screenshots` in the root of this repository and they will display beautifully!*

| **Landing Desk & Controller Board** | **Multi-Agent Neural Matrix Terminal** |
| :---: | :---: |
| ![Landing Page](./screenshots/landing_desk.png) | ![Neural Matrix](./screenshots/neural_terminal.png) |
| *Modern control console where users configure research depth and personas.* | *Retro-themed terminal displaying live coordinate streams between active agents.* |

| **Sanitized Publication Report** |
| :---: |
| ![Research Report](./screenshots/research_report.png) |
| *Beautifully typeset academic output containing zero modern visual anachronisms.* |

---

## 🌟 Premium Architecture & Capabilities

### 1. Multi-Depth Swarm Engine (FAST / DEEP / PRO)
Orchestra AI dynamically scales its agent coordination based on the requested research complexity:
* **FAST Depth (Standard Persona):** Instantly synthesizes literature reviews and general topic briefs.
* **DEEP Depth (Visionary Persona):** Deploys internal vector scrapers and NOAA field models over multiple cycles.
* **PRO Depth (Skeptic Persona):** Runs adversarial verification cycles. The **Critic Agent** inspects drafts, checks logical assumptions, and forces rewrites until the briefing is robust.

### 2. Triple-API Image Fallback Cascade
To guarantee beautiful, relevant visual aids, the **Visualizer Agent** queries three media APIs sequentially:
1. **Wikimedia Commons API:** Checked first to retrieve highly factual, scientific, and public-domain figures.
2. **Pexels API & Unsplash API:** Leveraged as professional backups to fetch high-contrast, atmospheric stock illustrations.
3. **Dynamic Seed Fallback:** Protects the UI from broken icons by generating styled abstract placeholders when APIs rate-limit.

### 3. Geopolitical & Temporal Sanitization (Anti-Anachronism)
To avoid jarring visual errors in historical research, the visual prompt engine sanitizes queries dynamically:
* Intercepts modern leakages and translates them:
  - *European Union meeting* $ightarrow$ **Roman senate assembly**
  - *Checkpoint* $ightarrow$ **Fortress outpost**
  - *Computer/Office* $ightarrow$ **Parchment scrolls/Ancient study**
  - *Fluorescent lights* $ightarrow$ **Oil lamps**
* Prepends historical constraints to lock visual stock engines into ancient themes.

### 4. Double-Layered Rate Limiting & Throttling
Engineered for industrial-grade protection:
* **Client-Facing Sliding Window:** Caps `/research` & WebSockets (5 req/min), `/stt` Whisper transcription (5 req/min), and `/upload` embedding generation (5 req/min) to prevent compute cost abuse. Returns clean `429 Too Many Requests` responses with `Retry-After` headers.
* **Internal Third-Party API Protections:** Restricts Groq to 30 RPM and Gemini to 15 RPM. Incorporates strict `asyncio.Semaphore` and stagger gaps for DuckDuckGo Search (concurrency 1, 1.5s delay) and visual media queries (concurrency 2, 1.0s delay) to avoid provider IP blocks.

---

## 📂 Repository Directory Tree

```
Orchestra-Ai-GitHub/
├── backend/                  # FastAPI & LangGraph backend server
│   ├── agents.py             # LangGraph state swarm & image translation rules
│   ├── database.py           # Supabase vector storage & limit ceiling (15 ceiling)
│   ├── rate_limiter.py       # High-performance async sliding window tracking
│   ├── main.py               # WS streaming controllers & rate-limiting middleware
│   ├── requirements.txt      # Python backend packages
│   └── static/               # Local cache & image metadata storage
│
├── frontend/                 # Next.js & React Flow client application
│   ├── src/
│   │   ├── app/              # Next.js pages and routing
│   │   └── components/       # Custom React Flow graph, terminal, and viewer
│   ├── package.json          # Node dependency manifest
│   ├── tailwind.config.ts    # Styled sepia & glassmorphism configurations
│   └── tsconfig.json         # Strict TypeScript settings
│
├── .gitignore                # Global ignore rules (ignores node_modules, .env, .venv)
└── README.md                 # Primary system manual
```

---

## 🚀 Setup & Local Execution

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- Supabase Account (for remote persistence)

### 2. Backend Installation & Boot
1. Navigate to the backend folder:
   ```bash
   cd orchestra-ai/backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the secure environment variables template and configure your keys:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and fill in your keys (Groq, Gemini, Pexels, Unsplash, Supabase).*
5. Launch the FastAPI server:
   ```bash
   python main.py
   ```

### 3. Frontend Installation & Boot
1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Copy the secure environment variables template:
   ```bash
   cp .env.example .env.local
   ```
4. Start the Next.js client dev server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**.

---

## 📄 License
Distributed under the MIT License. Created by Sohom Pal.
