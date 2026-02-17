# agent-content-pipeline

Safe content automation for AI agents. Draft → Review → Revise → Approve → Post.

**The pattern**: Your AI drafts content. You review and give feedback. A [pi](https://github.com/mariozechner/pi) agent rewrites it in your voice. You approve. You post.

## Why?

AI agents shouldn't post directly to social media. Too risky. But they're great at drafting.

This kit enforces human-in-the-loop:
- **Agent** → writes drafts, pi rewrites based on your feedback
- **Human** → reviews, gives feedback, approves, posts

## Install

```bash
npm install -g agent-content-pipeline
```

Requires [pi](https://github.com/mariozechner/pi) on your PATH for the rewrite step.

Includes built-in posters for **LinkedIn**, **X/Twitter**, **Reddit (experimental)**, **dev.to**, and **Hashnode**.

## Quick Start

```bash
# 1. Initialize in your workspace (creates folders + global config)
content init .

# 2. Authenticate (once per platform)
content auth linkedin    # Opens browser for login
content auth x           # Extracts tokens from Firefox (or paste manually)
content auth reddit      # Creates Reddit API app credentials
content auth devto       # dev.to API key
content auth hashnode    # Hashnode token + publication ID

# 3. Create a new post request — pi drafts it in your voice
content new

# 4. Review: give feedback OR approve
content review drafts/my-post.md
# → Enter feedback → pi rewrites it → moved to revised/
# → No feedback → asks "Approve?" → moved to approved/

# 5. Review the revised version, repeat until happy

# 6. Post when approved
content post approved/my-post.md
```

`content init <dir>` sets up `~/.content-pipeline.json` with your workspace path, so commands work from any directory.

CLI command: `content` (alias: `content-pipeline`).

## Content Folders

```
drafts/        # Initial drafts land here
reviewed/      # You reviewed, pi is rewriting
revised/       # Rewritten, ready for another look
approved/      # You approved, ready to post
posted/        # Archive after posting
templates/     # Review and customize these
.content-pipeline/threads/  # Feedback thread logs (not posted)
```

## The Workflow

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐     ┌────────┐
│ drafts/ │ ──▶ │ reviewed/│ ──▶ │ revised/│ ──▶ │ approved/│ ──▶ │ posted/│
└─────────┘     └──────────┘     └─────────┘     └──────────┘     └────────┘
  agent/pi        human            pi rewrites      human           human
  drafts          reviews          in your voice    approves        posts
                     ▲                │
                     └────────────────┘
                      more feedback
```

When you give feedback in `content review`, pi spins up with `claude-opus-4-6` and the scribe skill loaded, rewrites the draft in your voice, and drops the result into `revised/`. No manual agent interaction needed.

## Secure Mode (Cryptographic Approval)

For extra assurance that content was human-approved, use `--secure`:

```bash
content init . --secure
```

This creates an Ed25519 signing keypair:
- **Private key** — encrypted with your password, stored in `.content-pipeline-key`
- **Public key** — embedded in the key file for verification

**How it works:**
1. When you approve content, you enter your password
2. The content is signed with your private key
3. When posting, the signature is verified
4. If content was modified after approval, posting is blocked

**Files:**
- `.content-pipeline-key` — your encrypted keypair (add to `.gitignore`!)
- Approved posts get `approval_signature` and `content_hash` in frontmatter

## CLI Reference

```bash
# Setup
content init <dir>              # Initialize content structure + global config
content init <dir> --secure     # Also enable cryptographic approval signatures
content auth <platform>         # Authenticate (linkedin, x, reddit, devto, hashnode)

# Workflow
content new                     # Create a post request, pi drafts it in your voice
content list                    # Show all folders with timestamps
content review <file>           # Review: give feedback (pi rewrites) OR approve
content mv <dest> <file>        # Move file to drafts/reviewed/revised/approved/posted
content edit <file>             # Open in $EDITOR
content post <file>             # Post (shows preview, asks confirmation)
content post <file> -n          # Dry-run (--dry-run)
content thread <file>           # Add a note to the feedback thread
content platforms               # List available platforms
```

## Platforms

### LinkedIn
- Playwright browser automation
- Session stored in `~/.content-pipeline/`

### X (Twitter)
- Uses [bird CLI](https://github.com/steipete/bird)
- Tokens extracted from Firefox, or paste `auth_token` and `ct0` manually:
  1. Open x.com and log in
  2. DevTools → Application → Cookies → https://x.com
  3. Copy `auth_token` and `ct0`

### Reddit (experimental)
- Uses [snoowrap](https://github.com/not-an-aardvark/snoowrap) API wrapper
- Requires a Reddit "script" app (create at reddit.com/prefs/apps)
- Frontmatter requires `subreddit:` field

### dev.to
- Uses [@sinedied/devto-cli](https://github.com/sinedied/devto-cli) via npx
- Get your API key at https://dev.to/settings/extensions
- Frontmatter: `title` required, `tags` optional

### Hashnode
- Direct GraphQL API
- Get your Personal Access Token at https://hashnode.com/settings/developer
- Find your Publication ID at https://hashnode.com/settings/blogs
- Frontmatter: `title` required, `tags` (array of slugs), `canonical_url`, `cover_image` optional

## pi Integration

The rewrite step uses [pi](https://github.com/mariozechner/pi) in headless RPC mode:

- Model: `claude-opus-4-6`
- Skill: `scribe` (loads your voice guidelines before rewriting)
- Triggered automatically on `content review` (when you give feedback) and `content new`

Pi must be installed and on your PATH, and you need a configured Anthropic API key. If pi is not found, the rewrite step is skipped and the draft is left as-is.

The scribe skill is loaded from your pi skill directory (`~/.pi/agent/skills/scribe/`). If you don't have it, the rewrite still runs but without voice-specific guidance.

## For AI Agents

- ✅ Write to `drafts/`
- ✅ Move reviewed files to `revised/`
- ❌ Cannot approve or post

## License

MIT — [Lars de Ridder](https://larsderidder.com)
