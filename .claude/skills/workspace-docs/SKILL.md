---
name: workspace-docs
description: A skill to capture conversation context and generate formatted documentation for the Chanhee Workspace Markdown Reader. Use this whenever the user wants to summarize work, document a development phase, or record research findings. Supported modes: /workspace-docs summary, /workspace-docs develop, /workspace-docs research.
---

# Workspace Docs Skill

This skill automates the process of documenting workspace activities and keeping the Markdown Reader portal up to date.

## Commands

- `/workspace-docs summary`: Creates a high-level summary suitable for team sharing. 팩트 위주의 간결한 요약본.
- `/workspace-docs develop` (Default): Creates a detailed technical documentation with architecture, code snippets, and implementation details. 개발용 상세본.
- `/workspace-docs research`: Captures raw research findings, external links, and detailed analysis. 리서치용 원본 보존 중심.

## Workflow

### 1. Identify Context
- Analyze the recent conversation history, tasks completed, and code changes made.
- Extract key requirements, design decisions, and architectural updates.

### 2. Generate Markdown
- **Style**: Use professional Markdown with Rich Visuals.
- **Visuals**: Incorporate Tables, Flowcharts (Mermaid), Sequence Diagrams (Mermaid), and Code Blocks.
- **Naming**: Use the format `[YYMMDD]_filename.md`. 
- **Storage**: Save the file to the `data/` directory of the project.

### 3. Update `documents.json`
- **Category Selection**: Choose the most relevant category. If none fit, create a new one with a suitable emoji.
- **Insertion**: Insert the new file entry at the top (`index 0`) of the category's `files` array.
- **Badges**: 
    - Apply `NEW` badge to the newly added document.
    - Apply `UPDATED` badge to any documents modified within the last 14 days (excluding the NEW document).
- **Sorting**: 
    - Sort files within each category by the `[YYMMDD]` prefix in the title (descending).
    - Sort categories by the latest date found in their respective file lists (descending).

### 4. Sync with GitHub
- Stage all changes (`data/` files and `documents.json`).
- Commit with a descriptive message like `docs: automated workspace update [YYMMDD]`.
- Push to the remote repository: `https://github.com/JoChanhee/ChanheeWorkspace.git`.
- Notify the user that the changes will be live on GitHub Pages shortly.

## Example Output Structure
### [YYMMDD] Title
1. **Overview**: Brief explanation of the session.
2. **Technical Details**: Architecture maps (Mermaid) and Logic.
3. **Outcome**: Final status and next steps.

---

## Instructions for implementation
When the user issues a command, you MUST:
1. First, search for `documents.json` and the `data/` directory to ensure you are in the correct root.
2. Follow the generation logic above based on the requested mode.
3. Execute the git commands to push.
4. Confirm the URL: https://jochanhee.github.io/ChanheeWorkspace/
