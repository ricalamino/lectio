# How Lectio compares to alternatives

This comes up immediately on Reddit ("why not just use Obsidian?"). Here's
an honest comparison.

## Quick comparison

| | Lectio | Obsidian | Notion | Logseq | Mem.ai |
|---|---|---|---|---|---|
| Self-hosted | ✅ | ✅ (files) | ❌ | ✅ (files) | ❌ |
| Open source | ✅ | ❌ | ❌ | ✅ | ❌ |
| Mobile capture (PWA) | ✅ | OK | ✅ | Poor | ✅ |
| Auto-organization (AI) | ✅ | Plugin | ❌ | ❌ | ✅ |
| Natural-language search | ✅ | Plugin | ❌ | ❌ | ✅ |
| Connection suggestions | ✅ | Manual | ❌ | Backlinks | ❌ |
| Bring your own model | ✅ | Plugin | ❌ | ❌ | ❌ |
| Local LLM (Ollama) | ✅ | Plugin | ❌ | Plugin | ❌ |
| Plain-text export | ✅ | ✅ | ✅ | ✅ | Paid |
| MCP server | ✅ | ❌ | ❌ | ❌ | ❌ |
| Zero-friction capture | ✅ | Medium | Medium | Medium | ✅ |
| Folder/tag structure | ❌ | ✅ | ✅ | ✅ | ❌ |
| Rich text editor | ❌ | ✅ | ✅ | ✅ | ✅ |
| Multi-user / team | ❌ | ❌ | ✅ | ❌ | Paid |
| Monthly cost | $0 + API | $0–$25 | $0–$16 | $0 | $14.99 |

## The honest take

**Choose Lectio if:**
- You want a capture-first workflow with zero organization overhead
- You want to own your data on your own server
- You want to mix cloud and local LLMs (Anthropic + Ollama)
- You want your second brain accessible from Claude Desktop / Cursor via MCP
- You don't need rich text editing or team collaboration

**Choose Obsidian if:**
- You want a mature, feature-rich knowledge base with a large plugin ecosystem
- You prefer markdown files on disk (no database)
- You want a rich text / WYSIWYG editor

**Choose Notion if:**
- You need team collaboration or database views
- You want a hosted service with no infrastructure to manage

**Choose Logseq if:**
- You prefer an outliner / daily notes workflow
- You want open source + local files + bidirectional links

**Choose Mem.ai if:**
- You want a hosted AI-first note-taking service with no self-hosting
- You're willing to pay $15/month for someone else to manage the AI

## What makes Lectio different

Most PKM tools are **retrieval-first**: you organize, then retrieve.
Lectio is **capture-first**: you capture, then the AI organizes.

The key insight is that the bottleneck in building a second brain isn't
retrieval — it's the friction of capture and organization. Lectio removes
that friction entirely. The trade-off is that Lectio is more of an inbox
than a wiki: it doesn't (yet) support the rich cross-linking and editing
workflows that Obsidian or Logseq provide.

Lectio's MCP server is also unique: no other PKM tool exposes your knowledge
base as an MCP server that can be plugged into Claude Desktop or Cursor.
