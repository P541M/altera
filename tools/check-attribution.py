"""Flags AI tool attribution in commit messages and pull request text:
co-author trailers for AI tools, "Generated with ..." footers, tool links and
similar watermarks ("Commits and pull requests" in AGENTS.md). Human
co-authors and a plain sentence saying an assistant helped are fine.

Usage:
  git log origin/main..HEAD --format=%B | python tools/check-attribution.py
  python tools/check-attribution.py < pr-description.txt
Exits 1 and lists the offending lines if it finds any.
"""
import re
import sys

# Tools as they name themselves in trailers: by email or exact tool name, so
# a human co-author who happens to be called Claude or Devin isn't flagged.
TOOL = re.compile(
    r"@anthropic\.com|\bclaude (code|opus|sonnet|haiku|fable|\d)"
    r"|\bcopilot\b|@openai\.com|\bchatgpt\b|\bcodex\b|\bgpt-?\d"
    r"|cursor\.(com|sh)|cursoragent|\bcursor agent\b"
    r"|\bgemini\b|\bbard\b|\baider\b|devin-ai|\bcodeium\b|\bwindsurf\b"
    r"|\btabnine\b|codewhisperer|\bamazon q\b|google-labs-jules|sweep-ai"
    r"|\[bot\]",
    re.I,
)
TRAILER = re.compile(r"^\s*[\w-]+-by:", re.I)  # Co-authored-by, Assisted-by, Generated-by, ...
FOOTER = re.compile(
    r"^\W*(generated|created|written|made|built|coded|authored) (with|by|using) \[?"
    r"(claude|chatgpt|copilot|codex|cursor|gemini|aider|devin|windsurf|codeium|an? ai\b|ai\b)",
    re.I,
)
LINK = re.compile(r"claude\.(com|ai)/(claude-)?code|cursor\.com/agents|chatgpt\.com/codex", re.I)
ROBOT = re.compile(r"^\s*\U0001F916")  # a line opening with the robot emoji


def problems(text):
    for number, line in enumerate(text.splitlines(), 1):
        if TRAILER.match(line) and TOOL.search(line):
            yield number, "AI co-author or credit trailer", line
        elif FOOTER.match(line):
            yield number, '"Generated with ..." footer', line
        elif LINK.search(line):
            yield number, "AI tool link", line
        elif ROBOT.match(line):
            yield number, "robot-emoji watermark", line


def main():
    text = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    found = list(problems(text))
    for number, kind, line in found:
        print(f"line {number}: {kind}: {line.strip()}")
    if found:
        print(
            "\nAI attribution isn't allowed in this repository's commits or pull requests"
            " (AGENTS.md, \"Commits and pull requests\"). Remove these lines; you can still"
            " say in your own words in the description that an assistant helped."
        )
        sys.exit(1)
    print("No AI attribution found.")


if __name__ == "__main__":
    main()
