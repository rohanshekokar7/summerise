#!/usr/bin/env python3
"""
AI Research Assistant – Interactive CLI (run from project root)

Usage:
  python main.py

Commands inside the CLI:
  /research <topic>   Start a new research pipeline
  /report             Re-display the last generated report
  /sources            List source URLs from the last research session
  /clear              Wipe conversation memory (keeps vector DB)
  /help               Show this command list
  /quit               Exit
  <anything else>     Follow-up question answered via RAG
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from research_assistant import ResearchAssistant


BANNER = """
AI Research Assistant
Powered by Google Gemini · LangChain · ChromaDB
"""

HELP = """
Commands:
  /research <topic>   Search web, read articles, summarise, store & report
  /report             Re-display the current research report
  /sources            List URLs used in the current research session
  /clear              Clear conversation memory (vector DB is kept)
  /help               Show this help text
  /quit               Exit

Anything else is treated as a follow-up question (RAG over your research).
"""


def main() -> None:
    print(BANNER)

    try:
        assistant = ResearchAssistant()
    except EnvironmentError as exc:
        print(f"[Error] {exc}")
        sys.exit(1)

    print(HELP)

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        lower = user_input.lower()

        # ── Exit ──────────────────────────────────────────────────────────────
        if lower in {"/quit", "/exit", "quit", "exit"}:
            print("Goodbye!")
            break

        # ── Help ──────────────────────────────────────────────────────────────
        elif lower == "/help":
            print(HELP)

        # ── New research session ──────────────────────────────────────────────
        elif lower.startswith("/research "):
            query = user_input[len("/research "):].strip()
            if not query:
                print("  Provide a topic: /research <topic>")
                continue
            try:
                assistant.research(query)
                print("\n[Research complete. Ask follow-up questions or /report to view the report.]\n")
            except Exception as exc:
                print(f"[Error during research] {exc}")

        # ── Re-display report ─────────────────────────────────────────────────
        elif lower == "/report":
            if assistant.current_research and assistant.current_research.report:
                print("\n" + "=" * 62)
                print(assistant.current_research.report)
                print("=" * 62 + "\n")
            else:
                print("  No report yet. Run /research <topic> first.")

        # ── List sources ──────────────────────────────────────────────────────
        elif lower == "/sources":
            if assistant.current_research and assistant.current_research.search_results:
                print("\nSources used:")
                for i, r in enumerate(assistant.current_research.search_results, 1):
                    print(f"  {i}. {r.title}")
                    print(f"     {r.url}")
                print()
            else:
                print("  No sources yet. Run /research <topic> first.")

        # ── Clear memory ──────────────────────────────────────────────────────
        elif lower == "/clear":
            assistant.conversation_history = []
            print("  Conversation memory cleared.\n")

        # ── Follow-up question (RAG) ──────────────────────────────────────────
        else:
            if not assistant.current_research:
                print("  No research context. Start with /research <topic>.\n")
                continue
            try:
                assistant.answer_followup(user_input)
                print()
            except Exception as exc:
                print(f"[Error] {exc}")


if __name__ == "__main__":
    main()
