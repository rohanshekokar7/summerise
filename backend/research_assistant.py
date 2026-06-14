"""
AI Research Assistant – OpenRouter edition
Supports both CLI (stdout) and API (on_event callback) usage.
"""

import os
import shutil
import time
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime

from openai import OpenAI, RateLimitError
from pathlib import Path
from dotenv import load_dotenv
from ddgs import DDGS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_community.document_loaders import WebBaseLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# Load .env from backend/ directory (where the file actually lives)
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")  # fallback: project root

# Authenticate HuggingFace so embeddings download without rate-limit warnings
_hf_token = os.getenv("HF_TOKEN")
if _hf_token:
    os.environ["HF_TOKEN"] = _hf_token
    try:
        from huggingface_hub import login as hf_login
        hf_login(token=_hf_token, add_to_git_credential=False)
    except Exception:
        pass

MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
EMBED_MODEL = "all-MiniLM-L6-v2"

EventCallback = Optional[Callable[[dict], None]]


@dataclass
class SearchResult:
    url: str
    title: str
    snippet: str


@dataclass
class ResearchContext:
    query: str
    search_results: List[SearchResult] = field(default_factory=list)
    documents: List[Document] = field(default_factory=list)
    summary: str = ""
    report: str = ""


class ResearchAssistant:
    def __init__(self, persist_dir: str = str(Path(__file__).parent / "research_db")):
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "OPENROUTER_API_KEY is not set.\n"
                "Create a .env file with OPENROUTER_API_KEY=your_key_here\n"
                "Get your key at: https://openrouter.ai/keys"
            )

        self.client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
        self.persist_dir = persist_dir
        self._on_event: EventCallback = None

        print("Initialising local HuggingFace embeddings...")
        self.embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=200,
        )

        self.vector_store: Optional[Chroma] = None
        self.conversation_history: List[Dict] = []
        self.current_research: Optional[ResearchContext] = None

    # ------------------------------------------------------------------
    # Event emitter — routes to callback or stdout
    # ------------------------------------------------------------------

    def _emit(self, event: dict) -> None:
        if self._on_event:
            self._on_event(event)
            return
        t = event.get("type")
        if t == "text":
            print(event.get("content", ""), end="", flush=True)
        elif t == "newline":
            print()
        elif t == "status":
            print(event.get("message", ""))
        elif t == "section":
            print(f"\n--- {event.get('name', '').upper()} ---")
        elif t == "search_result":
            print(f"  • {event.get('title', '')[:70]}")
            print(f"    {event.get('url', '')}")

    # ------------------------------------------------------------------
    # Core LLM caller
    # ------------------------------------------------------------------

    def _call_llm(
        self,
        user_message: str,
        system: str = "",
        history: Optional[List[Dict]] = None,
        stream: bool = True,
        max_tokens: int = 8000,
        retries: int = 4,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        for msg in (history or []):
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})

        for attempt in range(retries):
            try:
                if stream:
                    result = ""
                    response = self.client.chat.completions.create(
                        model=MODEL,
                        messages=messages,
                        max_tokens=max_tokens,
                        temperature=0.7,
                        stream=True,
                    )
                    for chunk in response:
                        text = chunk.choices[0].delta.content or ""
                        if text:
                            self._emit({"type": "text", "content": text})
                            result += text
                    self._emit({"type": "newline"})
                    return result

                response = self.client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.7,
                    stream=False,
                )
                return response.choices[0].message.content or ""

            except RateLimitError:
                wait = 10 * (2 ** attempt)
                self._emit({"type": "status", "message": f"Rate limited, retrying in {wait}s..."})
                time.sleep(wait)

        raise RuntimeError("Rate limit exceeded after multiple retries. Please wait a moment and try again.")

    # ------------------------------------------------------------------
    # Step 1 – Web Search
    # ------------------------------------------------------------------

    def search_web(self, query: str, num_results: int = 8) -> List[SearchResult]:
        self._emit({"type": "status", "message": f"Searching: {query}"})
        results: List[SearchResult] = []

        backends = ["lite", "html", "api"]
        raw = []
        for backend in backends:
            try:
                with DDGS() as ddgs:
                    raw = list(ddgs.text(query, max_results=num_results, backend=backend))
                if raw:
                    break
            except Exception as exc:
                self._emit({"type": "status", "message": f"Search backend '{backend}' failed: {exc}"})

        for r in raw:
            url = r.get("href", "")
            if url:
                sr = SearchResult(
                    url=url,
                    title=r.get("title", ""),
                    snippet=r.get("body", ""),
                )
                results.append(sr)
                self._emit({
                    "type": "search_result",
                    "title": sr.title,
                    "url": sr.url,
                    "snippet": sr.snippet,
                })

        return results

    # ------------------------------------------------------------------
    # Step 2 – Load Article Content
    # ------------------------------------------------------------------

    def load_articles(
        self, search_results: List[SearchResult], max_articles: int = 5
    ) -> List[Document]:
        self._emit({"type": "status", "message": f"Loading articles (up to {max_articles})..."})
        documents: List[Document] = []

        for result in search_results[:max_articles]:
            if not result.url:
                continue
            try:
                self._emit({"type": "status", "message": f"Loading: {result.url[:80]}"})
                loader = WebBaseLoader(result.url)
                loader.requests_kwargs = {
                    "timeout": 12,
                    "headers": {"User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)"},
                }
                docs = loader.load()
                for doc in docs:
                    doc.metadata.update({"title": result.title, "url": result.url})
                documents.extend(docs)
                self._emit({"type": "status", "message": f"{len(docs)} page(s) loaded"})
            except Exception as exc:
                self._emit({"type": "status", "message": f"Could not load page ({exc}); using snippet"})
                documents.append(Document(
                    page_content=result.snippet,
                    metadata={"title": result.title, "url": result.url, "source": "snippet"},
                ))

        return documents

    # ------------------------------------------------------------------
    # Step 3 – Summarise
    # ------------------------------------------------------------------

    def summarize_content(self, documents: List[Document], research_query: str) -> str:
        self._emit({"type": "status", "message": f"Summarising {len(documents)} document(s)..."})
        self._emit({"type": "section", "name": "Summary"})

        combined = ""
        for doc in documents[:10]:
            combined += (
                f"\n\n--- Source: {doc.metadata.get('title', 'Unknown')} "
                f"({doc.metadata.get('url', '')}) ---\n"
            )
            combined += doc.page_content[:3000]

        prompt = (
            f'Research query: "{research_query}"\n\n'
            "Collected content from multiple web sources:\n"
            f"{combined[:18000]}\n\n"
            "Write a comprehensive summary that:\n"
            "1. Identifies key themes and findings\n"
            "2. Highlights the most important information\n"
            "3. Notes conflicting viewpoints if any\n"
            "4. Identifies gaps in the collected information\n\n"
            "Use clear sections and bullet points."
        )

        return self._call_llm(
            prompt,
            system="You are an expert research analyst. Synthesise information clearly and accurately.",
            stream=True,
            max_tokens=8000,
        )

    # ------------------------------------------------------------------
    # Step 4 – Vector DB Storage
    # ------------------------------------------------------------------

    def store_in_vector_db(self, documents: List[Document]) -> None:
        self._emit({"type": "status", "message": "Indexing into vector database..."})
        splits = self.text_splitter.split_documents(documents)

        if os.path.exists(self.persist_dir):
            shutil.rmtree(self.persist_dir)

        self.vector_store = Chroma.from_documents(
            documents=splits,
            embedding=self.embeddings,
            persist_directory=self.persist_dir,
        )
        self._emit({"type": "stored", "chunks": len(splits)})
        self._emit({"type": "status", "message": f"{len(splits)} chunks stored in ChromaDB"})

    # ------------------------------------------------------------------
    # Step 5 – RAG Follow-up Q&A
    # ------------------------------------------------------------------

    def _retrieve_context(self, question: str, k: int = 5) -> str:
        if not self.vector_store:
            return ""
        docs = self.vector_store.similarity_search(question, k=k)
        context = ""
        for i, doc in enumerate(docs, 1):
            context += (
                f"\n[Excerpt {i} – {doc.metadata.get('title', 'Unknown')}]\n"
                f"{doc.page_content}\n"
            )
        return context

    def answer_followup(self, question: str, on_event: EventCallback = None) -> str:
        prev = self._on_event
        self._on_event = on_event or prev

        try:
            self._emit({"type": "status", "message": "Retrieving context..."})
            context = self._retrieve_context(question)
            topic = self.current_research.query if self.current_research else "the topic"

            user_message = (
                f"My follow-up question about \"{topic}\":\n{question}\n\n"
                + (
                    f"Relevant excerpts from my research:\n{context}"
                    if context
                    else "No specific excerpts matched."
                )
            )

            self._emit({"type": "section", "name": "Answer"})
            answer = self._call_llm(
                user_message,
                system=(
                    f"You are a research assistant. The user researched \"{topic}\". "
                    "Use provided excerpts and conversation history. Cite source titles."
                ),
                history=self.conversation_history,
                stream=True,
                max_tokens=4000,
            )

            self.conversation_history.append({"role": "user", "content": question})
            self.conversation_history.append({"role": "assistant", "content": answer})
            if len(self.conversation_history) > 40:
                self.conversation_history = self.conversation_history[-40:]

            return answer
        finally:
            self._on_event = prev

    # ------------------------------------------------------------------
    # Step 6 – Report Generation
    # ------------------------------------------------------------------

    def generate_report(self, ctx: ResearchContext) -> str:
        self._emit({"type": "status", "message": "Generating report..."})
        self._emit({"type": "section", "name": "Report"})

        sources_md = ""
        for i, r in enumerate(ctx.search_results, 1):
            sources_md += f"{i}. **{r.title}**  \n   {r.url}\n\n"

        prompt = (
            f'Write a comprehensive research report on: **"{ctx.query}"**\n\n'
            f"Research summary:\n{ctx.summary}\n\n"
            f"Sources consulted:\n{sources_md}\n\n"
            "Structure the report with these sections:\n"
            "1. Executive Summary\n2. Introduction & Background\n"
            "3. Key Findings\n4. Detailed Analysis\n"
            "5. Current Trends & Developments\n6. Implications & Applications\n"
            "7. Limitations & Future Research Directions\n"
            "8. Conclusion\n9. References\n\n"
            "Use markdown formatting. Be thorough and insightful."
        )

        return self._call_llm(
            prompt,
            system=(
                "You are a senior research analyst producing professional research reports. "
                "Be comprehensive, evidence-based, and clearly structured."
            ),
            stream=True,
            max_tokens=16000,
        )

    # ------------------------------------------------------------------
    # Main pipeline
    # ------------------------------------------------------------------

    def research(self, query: str, max_articles: int = 5, on_event: EventCallback = None) -> str:
        self._on_event = on_event
        try:
            self._emit({"type": "status", "message": f"Starting research: {query}"})

            ctx = ResearchContext(query=query)
            self.current_research = ctx

            ctx.search_results = self.search_web(query)
            if not ctx.search_results:
                self._emit({"type": "error", "message": "No search results found."})
                return ""

            ctx.documents = self.load_articles(ctx.search_results, max_articles=max_articles)
            if not ctx.documents:
                self._emit({"type": "error", "message": "Could not load any article content."})
                return ""

            ctx.summary = self.summarize_content(ctx.documents, query)
            self.store_in_vector_db(ctx.documents)
            ctx.report = self.generate_report(ctx)

            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_path = str(Path(__file__).parent / f"report_{ts}.md")
            with open(report_path, "w", encoding="utf-8") as fh:
                fh.write(f"# Research Report: {query}\n\n")
                fh.write(f"_Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_\n\n")
                fh.write(ctx.report)

            self._emit({"type": "report_saved", "path": report_path})

            self.conversation_history = [
                {
                    "role": "user",
                    "content": (
                        f"I just finished researching: {query}\n\n"
                        f"Summary:\n{ctx.summary[:3000]}...\n\nI may ask follow-up questions."
                    ),
                },
                {
                    "role": "assistant",
                    "content": (
                        f"Understood. I have a full picture of the research on '{query}'. "
                        "Ask me anything."
                    ),
                },
            ]

            return ctx.report
        finally:
            self._on_event = None
