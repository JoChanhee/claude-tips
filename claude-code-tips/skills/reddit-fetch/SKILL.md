---
name: reddit-fetch
description: Fetch content from Reddit using Gemini CLI or curl JSON API fallback. Use when accessing Reddit URLs, researching topics on Reddit, or when Reddit returns 403/blocked errors.
---

# Reddit Fetch

## Method 1: Gemini CLI (Try First)

Use Gemini CLI via tmux. It can browse, summarize, and answer complex questions about Reddit content.

Pick a unique session name (e.g., `gemini_abc123`) and use it consistently throughout.

### Setup

```bash
tmux new-session -d -s <session_name> -x 200 -y 50
tmux send-keys -t <session_name> 'gemini -m gemini-3-pro-preview' Enter
sleep 3  # wait for Gemini CLI to load
```

### Send query and capture output

```bash
tmux send-keys -t <session_name> 'Your Reddit query here' Enter
sleep 30  # wait for response (adjust as needed, up to 90s for complex searches)
tmux capture-pane -t <session_name> -p -S -500  # capture output
```

If the captured output shows an API error (e.g., quota exceeded, model unavailable), kill the session and retry without the `-m` flag (just `gemini` with no model argument). This falls back to the default model.

### How to tell if Enter was sent

Look for YOUR QUERY TEXT specifically. Is it inside or outside the bordered box?

**Enter NOT sent** - your query is INSIDE the box:
```
╭─────────────────────────────────────╮
│ > Your actual query text here       │
╰─────────────────────────────────────╯
```

**Enter WAS sent** - your query is OUTSIDE the box, followed by activity:
```
> Your actual query text here

⠋ Our hamsters are working... (processing)

╭────────────────────────────────────────────╮
│ >   Type your message or @path/to/file     │
╰────────────────────────────────────────────╯
```

Note: The empty prompt `Type your message or @path/to/file` always appears in the box - that's normal. What matters is whether YOUR query text is inside or outside the box.

If your query is inside the box, run `tmux send-keys -t <session_name> Enter` to submit.

### Cleanup when done

```bash
tmux kill-session -t <session_name>
```

### If Gemini fails completely

If retrying without `-m` also fails, fall back to Method 2 below.

---

## Method 2: curl with Reddit JSON API (Fallback)

Reddit's public JSON API works by appending `.json` to any Reddit URL. Use this when Gemini is unavailable (quota exhausted, API errors, etc.).

### Listing hot/new/top posts

```bash
curl -s -H "User-Agent: Mozilla/5.0 (compatible; bot)" \
  "https://www.reddit.com/r/SUBREDDIT/hot.json?limit=15"
```

Replace `hot` with `new`, `top`, or `rising` as needed. For `top`, add `&t=day` (or `week`, `month`, `year`, `all`).

### Fetching a specific post + comments

```bash
curl -s -H "User-Agent: Mozilla/5.0 (compatible; bot)" \
  "https://www.reddit.com/r/SUBREDDIT/comments/POST_ID.json?limit=20"
```

The response is a JSON array: `[0]` is the post, `[1]` is the comment tree.

### Searching within a subreddit

```bash
curl -s -H "User-Agent: Mozilla/5.0 (compatible; bot)" \
  "https://www.reddit.com/r/SUBREDDIT/search.json?q=QUERY&restrict_sr=on&sort=new&limit=15"
```

### Parsing the JSON

Use python3 inline to extract what you need:

```bash
curl -s -H "User-Agent: Mozilla/5.0 (compatible; bot)" \
  "https://www.reddit.com/r/SUBREDDIT/hot.json?limit=15" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
for i, post in enumerate(data['data']['children'], 1):
    p = post['data']
    flair = p.get('link_flair_text', '') or ''
    print(f'{i}. [{flair}] {p[\"title\"]}')
    print(f'   {p[\"score\"]} pts | {p[\"num_comments\"]} comments | u/{p[\"author\"]}')
    print()
"
```

### If curl returns empty or blocked

If the JSON API returns empty responses or HTTP 429, you may be rate-limited. Wait a moment and retry, or try with a different User-Agent string.
