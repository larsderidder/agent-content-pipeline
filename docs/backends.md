# Backend Options

The content board supports multiple backends for managing drafts and approvals.

## Filesystem (default)

Simplest option. Uses the local filesystem.

**Approval flow:**
1. Agent writes to `drafts/`
2. Human moves file to `approved/`
3. Script posts and moves to `posted/`

**Pros:** Simple, works offline, git-friendly
**Cons:** Requires file system access

## Git

Same as filesystem, but approval is via git commits or PRs.

**Approval flow:**
1. Agent commits to `drafts/`
2. Human creates PR or commits to move file to `approved/`
3. CI/CD or manual script posts

**Pros:** Audit trail, works with teams, PR review
**Cons:** Slightly more complex setup

**Setup:**
```bash
# Agent can only commit to drafts/
# Use branch protection or pre-commit hooks to enforce
```

## Obsidian

Use an Obsidian vault as the content source.

**Approval flow:**
1. Agent writes to drafts folder in vault
2. Human moves note to approved folder (or adds `#approved` tag)
3. Script syncs vault and posts

**Pros:** Nice UI, works offline, markdown-native
**Cons:** Requires Obsidian, sync complexity

**Setup:**
```bash
# In .env
OBSIDIAN_VAULT_PATH=~/Documents/Obsidian/ContentVault
```

## Notion

Use a Notion database as the content source.

**Approval flow:**
1. Agent creates draft in Notion (or human creates from agent suggestion)
2. Human changes status to "Approved"
3. Script reads approved items and posts

**Pros:** Nice UI, collaborative, notifications
**Cons:** Requires Notion subscription, API limits

**Setup:**
1. Create a Notion database with columns:
   - Title (title)
   - Platform (select: linkedin, x, medium)
   - Status (select: draft, approved, posted)
   - Content (text)
   - Posted At (date)
   - Posted URL (url)

2. Create integration at https://www.notion.so/my-integrations
3. Share database with integration
4. Configure:
```bash
# In .env
NOTION_API_KEY=secret_...
NOTION_DATABASE_ID=...
```

**EU-friendly alternative:** Consider [AppFlowy](https://appflowy.io/) (open source, self-hosted).

## Local-first alternatives

If you want to avoid cloud services:

- **Obsidian** (local vault, optional sync)
- **Logseq** (local-first, git-friendly)
- **Plain files + git** (maximum control)
- **Vikunja** (self-hosted task manager)
