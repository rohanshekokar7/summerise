# AI Research Assistant

A full-stack AI-powered research tool that searches the web, reads articles, summarizes findings, and generates structured research reports — all in real time.

---

## Features

- **Web Search** — Searches the web using DuckDuckGo across multiple backends
- **Article Reader** — Scrapes and reads full article content from source URLs
- **AI Summarization** — Summarizes gathered content using a large language model via OpenRouter
- **Vector Storage** — Indexes content into ChromaDB for semantic search
- **RAG Follow-up Q&A** — Ask follow-up questions answered from your research data
- **Report Generation** — Produces a full structured markdown research report
- **Streaming UI** — Real-time progress via Server-Sent Events (SSE)
- **ChatGPT-style Interface** — Clean dark UI with collapsible sidebar, source panel, and inline report viewer
- **Export** — Download the generated report as a `.md` file

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, Uvicorn |
| LLM | OpenRouter API (free models supported) |
| Embeddings | HuggingFace `all-MiniLM-L6-v2` (local) |
| Vector DB | ChromaDB |
| Web Search | DDGS (DuckDuckGo) |
| Frontend | React, Vite |
| Streaming | Server-Sent Events (SSE) |

---

## Project Structure

```
project/
├── backend/
│   ├── api.py                  # FastAPI server with SSE endpoints
│   ├── research_assistant.py   # Core research pipeline
│   ├── main.py                 # CLI version
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Your API keys (never committed)
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Root component + SSE logic
│   │   ├── App.css             # Global styles
│   │   └── components/
│   │       ├── Sidebar.jsx     # Left sidebar with history
│   │       ├── ChatWindow.jsx  # Main content area
│   │       ├── Message.jsx     # Message bubbles
│   │       ├── ReportViewer.jsx# Inline report display
│   │       └── SourcePanel.jsx # Right sources panel
│   ├── index.html
│   └── package.json
├── .env.example                # Template for environment variables
└── README.md
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **OpenRouter API key** — free at [openrouter.ai/keys](https://openrouter.ai/keys)
- **HuggingFace token** *(optional)* — free at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/rohanshekokar7/summerise.git
cd summerise
```

### 2. Set up the backend

```bash
# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Mac/Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
cd backend
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
# From the project root
cp .env.example backend/.env
```

Open `backend/.env` and fill in your keys:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
HF_TOKEN=your_huggingface_token_here   # optional
```

### 4. Set up the frontend

```bash
cd frontend
npm install
```

---

## Running the Project

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Backend

```bash
cd /path/to/project
source .venv/bin/activate
cd backend
uvicorn api:app --reload
```

Backend runs at: `http://localhost:8000`

### Terminal 2 — Frontend

```bash
cd /path/to/project/frontend
npm run dev
```

Frontend runs at: `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

## How to Use

1. **Type a research topic** in the search box (e.g. `AI Agents in 2025`)
2. **Press Enter** — the assistant will:
   - Search the web for relevant sources
   - Read and scrape article content
   - Summarize findings using AI
   - Index content into a local vector database
   - Generate a full structured research report
3. **View sources** by clicking "Sources" in the header
4. **Ask follow-up questions** below the report — answers use your research data (RAG)
5. **Export the report** as a `.md` file using the Export button

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/research` | Start a research session (SSE stream) |
| `POST` | `/api/followup` | Ask a follow-up question (SSE stream) |
| `GET`  | `/api/report` | Get the current report as JSON |
| `GET`  | `/api/report/download` | Download report as `.md` file |
| `GET`  | `/api/sources` | Get list of sources used |
| `GET`  | `/api/status` | Check if research is in progress |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | API key from [openrouter.ai](https://openrouter.ai/keys) |
| `HF_TOKEN` | No | HuggingFace token to avoid rate-limit warnings |

---

## Notes

- The first run downloads the `all-MiniLM-L6-v2` embedding model (~80MB). It is cached locally after that.
- The app is designed for single-user local use. Only one research session can run at a time.
- Generated reports are also saved as `.md` files inside the `backend/` folder.
- The `research_db/` folder (ChromaDB data) is auto-generated and gitignored.

---

## License

MIT
