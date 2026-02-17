# agent-content-pipeline

Safe content automation for AI agents. Draft → Review → Revise → Approve → Post.

**The pattern**: Your AI drafts content. You review and give feedback. They revise. You approve. You post.

Built for [OpenClaw](https://github.com/openclaw/openclaw) — your agent gets notified automatically when you give feedback.

## Why?

AI agents shouldn't post directly to social media. Too risky. But they're great at drafting.

This kit enforces human-in-the-loop:
- **Agent** → writes drafts, revises based on feedback
- **Human** → reviews, gives feedback, approves, posts

## Install

```bash
npm install -g agent-content-pipeline
```

Includes built-in posters for **LinkedIn**, **X/Twitter**, and **Reddit (experimental)**.

## Quick Start

```bash
# 1. Initialize in your workspace (creates folders + global config)
content init .

# 2. Authenticate (once per platform)
content auth linkedin    # Opens browser for login
content auth x           # Extracts tokens from Firefox (or paste cookies manually if Firefox fails)
content auth reddit      # Creates Reddit API app credentials

# 3. Your agent writes to drafts/

# 4. Review: give feedback OR approve
content review drafts/my-post.md
# → Enter feedback → moves to reviewed/, notifies agent
# → No feedback → asks "Approve?" → moves to approved/

# 5. Agent revises (if feedback given), you review again

# 6. Post when approved
content post approved/my-post.md
```

`content init <dir>` sets up `~/.content-pipeline.json` with your workspace path, so commands work from any directory.

CLI command: `content` (alias: `content-pipeline`).

## Content Folders

```
drafts/        # Agent writes here
reviewed/      # You reviewed, awaiting agent revision
revised/       # Agent revised, ready for another look
approved/      # You approved, ready to post
posted/        # Archive after posting
templates/     # Review and customize these templates
.content-pipeline/threads/  # Feedback thread logs (not posted)
```

## The Workflow

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐     ┌────────┐
│ drafts/ │ ──▶ │ reviewed/│ ──▶ │ revised/│ ──▶ │ approved/│ ──▶ │ posted/│
└─────────┘     └──────────┘     └─────────┘     └──────────┘     └────────┘
   agent          human            agent           human           human
   writes         reviews          revises         approves        posts
                     ▲                │
                     └────────────────┘
                      more feedback
```

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

**Why use it?**
Because you don't want to give the credentials to your social media to your AI agent. You can still automate posting in a boring deterministic process of course.

**Files:**
- `.content-pipeline-key` — your encrypted keypair (add to `.gitignore`!)
- Approved posts get `approval_signature` and `content_hash` in frontmatter

## CLI Reference

```bash
# Setup
content init <dir>        # Initialize content structure + global config
content init <dir> --secure     # Also enable cryptographic approval signatures
content auth <platform>   # Authenticate (linkedin, x, reddit)

# Workflow
content list              # Show all folders with timestamps
content review <file>     # Review: give feedback OR approve (if no feedback)
content mv <dest> <file>  # Move file to drafts/reviewed/revised/approved/posted
content edit <file>       # Open in $EDITOR
content post <file>       # Post (shows preview, asks confirmation)
content post <file> -n    # Dry-run (--dry-run)
content thread <file>     # Add a note to the feedback thread
```

## Platforms

### LinkedIn
- Playwright browser automation
- Session encrypted in `~/.content-pipeline/`

### X (Twitter)
- Uses [bird CLI](https://github.com/steipete/bird)
- Tokens extracted from Firefox, encrypted with password (or stored unencrypted if you choose)
- If Firefox auth fails, you can paste `auth_token` and `ct0` manually

Manual cookie steps:
1) Open x.com and log in
2) Open DevTools → Application/Storage → Cookies → https://x.com
3) Copy `auth_token` and `ct0`

### Reddit (experimental)
- Uses [snoowrap](https://github.com/not-an-aardvark/snoowrap) API wrapper
- Requires a Reddit "script" app (create at reddit.com/prefs/apps)
- Credentials encrypted in `~/.content-pipeline/`
- Frontmatter requires `subreddit:` field

## OpenClaw Integration

If you're using [OpenClaw](https://github.com/openclaw/openclaw), content automatically notifies your agent when you give review feedback.

**How it works:**
1. `content init <dir>` auto-detects OpenClaw and saves its path to `.content-pipeline.json`
2. When you run `content review <file>` and enter feedback
3. The feedback is saved to the draft file
4. Your agent receives a message with the feedback and instructions to revise

**The agent sees:**
```
📝 Review feedback for 2025-01-30-linkedin-post.md:

"Make the intro punchier, less formal"

Read the draft at reviewed/..., apply the feedback, 
then run:

content mv revised "2025-01-30-linkedin-post.md"

Then confirm what you changed (you can also add a note with: content thread "2025-01-30-linkedin-post.md" --from agent).
```

This creates a seamless review loop — you give feedback in terminal, agent responds in chat.

**Manual config** (if auto-detect fails):
```json
{
  "clawdbotPath": "/path/to/clawdbot",
  "clawdbotTarget": "telegram:123456789"
}
```

## For AI Agents

- ✅ Write to `drafts/`
- ✅ Move reviewed files to `revised/`
- ❌ Cannot approve or post

## License

MIT — [Lars de Ridder](https://larsderidder.com)
