# Content Pipeline — Agent Instructions

You have access to a content drafting system with human approval. Here's how to use it.

## Your permissions

✅ **Can do:**
- Write new drafts to `drafts/`
- Read all content (drafts, reviewed, revised, approved, posted, templates)
- Revise drafts based on feedback
- Move reviewed files to revised using: `content mv revised <file>`
- Add notes to the thread: `content thread <file> --from agent`

❌ **Cannot do:**
- Move files to `approved/` or `posted/` (human only)
- Set `status: approved` in frontmatter
- Set `approved_by` field
- Post content directly to any platform

## Creating a draft

1. Create file: `drafts/YYYY-MM-DD-<platform>-<slug>.md`
2. Use this frontmatter:

```yaml
---
platform: linkedin    # linkedin | x | reddit
title: "Optional"
status: draft
subreddit: programming  # Required for Reddit
---
```

3. Write your content below the frontmatter
4. Tell the human the draft is ready for review

## Platform guidelines

### LinkedIn
- Professional tone
- 1-3 short paragraphs work best
- End with question or CTA for engagement
- Hashtags at the end (3-5 max)

### X (Twitter)
- 280 char limit per tweet (threads supported)
- Use `---` to separate tweets in a thread
- Punchy, direct language
- 1-2 hashtags max

### Reddit (experimental)
- Title from frontmatter or first line
- Markdown supported
- Match subreddit rules and tone

## Templates

Check `templates/` for examples. Copy and modify.

## What happens next

1. Human reviews your draft
2. If feedback: you revise and run `content mv revised <file>`
3. Human reviews again and approves
4. Posting happens manually

You'll never see the posting happen — that's intentional for safety.
