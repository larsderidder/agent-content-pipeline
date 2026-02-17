# Content Pipeline — Agent Instructions

You have access to a content drafting system with human approval. Here's how to use it.

## Your permissions

✅ **Can do:**
- Write new drafts to `drafts/`
- Read all content (drafts, reviewed, revised, approved, posted, templates)
- Add notes to the thread: `content thread <file> --from agent`
- Run `content list` to see pending content

❌ **Cannot do:**
- Move files between folders (the pipeline handles this automatically)
- Move files to `approved/` or `posted/` (human only)
- Set `status: approved` in frontmatter
- Set `approved_by` field
- Post content directly to any platform

## How the pipeline works

When the human reviews a draft and gives feedback, **pi automatically rewrites it** and moves it to `revised/`. You do not need to revise drafts yourself.

```
drafts/ → reviewed/ → revised/ → approved/ → posted/
  you       human      pi          human       human
  write     reviews    rewrites    approves    posts
```

Your job is to write a good initial draft. The rewrite loop is handled automatically.

## Creating a draft

File naming: `drafts/YYYY-MM-DD-<platform>-<slug>.md`

```yaml
---
platform: linkedin    # linkedin | x | reddit | devto | hashnode
title: "Required for reddit, devto, hashnode"
status: draft
subreddit: programming  # Required for Reddit
tags: [tag1, tag2]      # Optional, used by devto/hashnode
---

Your content here.
```

## Platform guidelines

### LinkedIn
- Professional but human
- 1-3 paragraphs ideal
- End with question or CTA
- 3-5 hashtags at end

### X (Twitter)
- 280 chars per tweet
- Use `---` to separate tweets in a thread
- Punchy, direct
- 1-2 hashtags max

### Reddit (experimental)
- Title required in frontmatter
- Match each subreddit's rules and tone

### dev.to / Hashnode
- Full markdown article
- Title required in frontmatter
- Tags as array of slugs

## Templates

Check `templates/` for examples.

You'll never see posting happen — that's intentional for safety.
