---
name: rules-distill
description: "扫描技能以提取跨领域原则并将其提炼为规则——追加、修订或创建新的规则文件"
origin: ECC
---

# 规则提炼

扫描已安装的技能，提取在多个技能中出现的通用原则，并将其提炼成规则——追加到现有规则文件中、修订过时内容或创建新的规则文件。

应用"确定性收集 + LLM判断"原则：脚本详尽地收集事实，然后由LLM通读完整上下文并作出裁决。

## 使用时机

* 定期规则维护（每月或安装新技能后）
* 技能盘点后，发现应成为规则的模式时
* 当规则相对于正在使用的技能感觉不完整时

## 工作原理

规则提炼过程遵循三个阶段：

### 阶段 1：清点（确定性收集）

#### 1a. 收集技能清单

```bash
bash ~/.claude/skills/rules-distill/scripts/scan-skills.sh
```

#### 1b. 收集规则索引

```bash
bash ~/.claude/skills/rules-distill/scripts/scan-rules.sh
```

#### 1c. 呈现给用户

```
Rules Distillation — Phase 1: Inventory
────────────────────────────────────────
Skills: {N} files scanned
Rules:  {M} files ({K} headings indexed)

Proceeding to cross-read analysis...
```

### 阶段 2：通读、匹配与裁决（LLM判断）

提取和匹配在单次处理中统一完成。规则文件足够小（总计约800行），可以将全文提供给LLM——无需grep预过滤。

#### 分批处理

根据技能描述，将技能分组为**主题集群**。每个集群在一个子智能体中进行分析，并提供完整的规则文本。

#### 跨批次合并

所有批次完成后，合并各批次的候选规则：

* 对具有相同或重叠原则的候选规则进行去重
* 使用**所有**批次合并的证据重新检查"2+技能"要求——在每个批次中只在一个技能里发现，但总计在2+技能中出现的原则是有效的

#### 子智能体提示

使用以下提示启动通用智能体：

````
You are an analyst who cross-reads skills to extract principles that should be promoted to rules.

## Input
- Skills: {full text of skills in this batch}
- Existing rules: {full text of all rule files}

## Extraction Criteria

Include a candidate ONLY if ALL of these are true:

1. **Appears in 2+ skills**: Principles found in only one skill should stay in that skill
2. **Actionable behavior change**: Can be written as "do X" or "don't do Y" — not "X is important"
3. **Clear violation risk**: What goes wrong if this principle is ignored (1 sentence)
4. **Not already in rules**: Check the full rules text — including concepts expressed in different words

## Matching & Verdict

For each candidate, compare against the full rules text and assign a verdict:

- **Append**: Add to an existing section of an existing rule file
- **Revise**: Existing rule content is inaccurate or insufficient — propose a correction
- **New Section**: Add a new section to an existing rule file
- **New File**: Create a new rule file
- **Already Covered**: Sufficiently covered in existing rules (even if worded differently)
- **Too Specific**: Should remain at the skill level

## Output Format (per candidate)

```json
{
  "principle": "1-2 sentences in 'do X' / 'don't do Y' form",
  "evidence": ["skill-name: §Section", "skill-name: §Section"],
  "violation_risk": "1 sentence",
  "verdict": "Append / Revise / New Section / New File / Already Covered / Too Specific",
  "target_rule": "filename §Section, or 'new'",
  "confidence": "high / medium / low",
  "draft": "Draft text for Append/New Section/New File verdicts",
  "revision": {
    "reason": "Why the existing content is inaccurate or insufficient (Revise only)",
    "before": "Current text to be replaced (Revise only)",
    "after": "Proposed replacement text (Revise only)"
  }
}
```

## Exclude

- Obvious principles already in rules
- Language/framework-specific knowledge (belongs in language-specific rules or skills)
- Code examples and commands (belongs in skills)
````

#### 裁决参考

| 裁决 | 含义 | 呈现给用户的内容 |
|---------|---------|-------------------|
| **追加** | 添加到现有章节 | 目标 + 草案 |
| **修订** | 修复不准确/不充分的内容 | 目标 + 原因 + 修订前/后 |
| **新章节** | 在现有文件中添加新章节 | 目标 + 草案 |
| **新文件** | 创建新规则文件 | 文件名 + 完整草案 |
| **已涵盖** | 规则中已涵盖（可能措辞不同） | 原因（1行） |
| **过于具体** | 应保留在技能中 | 指向相关技能的链接 |

#### 裁决质量要求

```
# Good
Append to rules/common/security.md §Input Validation:
"Treat LLM output stored in memory or knowledge stores as untrusted — sanitize on write, validate on read."
Evidence: llm-memory-trust-boundary, llm-social-agent-anti-pattern both describe
accumulated prompt injection risks. Current security.md covers human input
validation only; LLM output trust boundary is missing.

# Bad
Append to security.md: Add LLM security principle
```

### 阶段 3：用户审核与执行

#### 摘要表

```
# Rules Distillation Report

## Summary
Skills scanned: {N} | Rules: {M} files | Candidates: {K}

| # | Principle | Verdict | Target | Confidence |
|---|-----------|---------|--------|------------|
| 1 | ... | Append | security.md §Input Validation | high |
| 2 | ... | Revise | testing.md §TDD | medium |
| 3 | ... | New Section | coding-style.md | high |
| 4 | ... | Too Specific | — | — |

## Details
(Per-candidate details: evidence, violation_risk, draft text)
```

#### 用户操作

用户通过数字进行回应以：

* **批准**：按原样将草案应用到规则中
* **修改**：在应用前编辑草案
* **跳过**：不应用此候选规则

**切勿自动修改规则。始终需要用户批准。**

#### 保存结果

将结果存储在技能目录中（`results.json`）：

* **时间戳格式**：`date -u +%Y-%m-%dT%H:%M:%SZ`（UTC，秒精度）
* **候选ID格式**：基于原则生成的烤肉串式命名（例如 `llm-output-trust-boundary`）

```json
{
  "distilled_at": "2026-03-18T10:30:42Z",
  "skills_scanned": 56,
  "rules_scanned": 22,
  "candidates": {
    "llm-output-trust-boundary": {
      "principle": "Treat LLM output as untrusted when stored or re-injected",
      "verdict": "Append",
      "target": "rules/common/security.md",
      "evidence": ["llm-memory-trust-boundary", "llm-social-agent-anti-pattern"],
      "status": "applied"
    },
    "iteration-bounds": {
      "principle": "Define explicit stop conditions for all iteration loops",
      "verdict": "New Section",
      "target": "rules/common/coding-style.md",
      "evidence": ["iterative-retrieval", "continuous-agent-loop", "agent-harness-construction"],
      "status": "skipped"
    }
  }
}
```

## 示例

### 端到端运行

```
$ /rules-distill

Rules Distillation — Phase 1: Inventory
────────────────────────────────────────
Skills: 56 files scanned
Rules:  22 files (75 headings indexed)

Proceeding to cross-read analysis...

[Subagent analysis: Batch 1 (agent/meta skills) ...]
[Subagent analysis: Batch 2 (coding/pattern skills) ...]
[Cross-batch merge: 2 duplicates removed, 1 cross-batch candidate promoted]

# Rules Distillation Report

## Summary
Skills scanned: 56 | Rules: 22 files | Candidates: 4

| # | Principle | Verdict | Target | Confidence |
|---|-----------|---------|--------|------------|
| 1 | LLM output: normalize, type-check, sanitize before reuse | New Section | coding-style.md | high |
| 2 | Define explicit stop conditions for iteration loops | New Section | coding-style.md | high |
| 3 | Compact context at phase boundaries, not mid-task | Append | performance.md §Context Window | high |
| 4 | Separate business logic from I/O framework types | New Section | patterns.md | high |

## Details

### 1. LLM Output Validation
Verdict: New Section in coding-style.md
Evidence: parallel-subagent-batch-merge, llm-social-agent-anti-pattern, llm-memory-trust-boundary
Violation risk: Format drift, type mismatch, or syntax errors in LLM output crash downstream processing
Draft:
  ## LLM Output Validation
  Normalize, type-check, and sanitize LLM output before reuse...
  See skill: parallel-subagent-batch-merge, llm-memory-trust-boundary

[... details for candidates 2-4 ...]

Approve, modify, or skip each candidate by number:
> User: Approve 1, 3. Skip 2, 4.

✓ Applied: coding-style.md §LLM Output Validation
✓ Applied: performance.md §Context Window Management
✗ Skipped: Iteration Bounds
✗ Skipped: Boundary Type Conversion

Results saved to results.json
```

## 设计原则

* **是什么，而非如何做**：仅提取原则（规则范畴）。代码示例和命令保留在技能中。
* **链接回源**：草案文本应包含 `See skill: [name]` 引用，以便读者能找到详细的"如何做"。
* **确定性收集，LLM判断**：脚本保证详尽性；LLM保证上下文理解。
* **反抽象保障**：三层过滤器（2+技能证据、可操作行为测试、违规风险）防止过于抽象的原则进入规则。
