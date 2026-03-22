---
description: 全面的 C++ 代码审查，涵盖内存安全、现代 C++ 惯用法、并发性和安全性。调用 cpp-reviewer 代理。
---

# C++ 代码审查

此命令调用 **cpp-reviewer** 代理进行全面的 C++ 特定代码审查。

## 此命令的作用

1. **识别 C++ 变更**：通过 `git diff` 查找已修改的 `.cpp`、`.hpp`、`.cc`、`.h` 文件
2. **运行静态分析**：执行 `clang-tidy` 和 `cppcheck`
3. **内存安全检查**：检查原始 new/delete、缓冲区溢出、释放后使用
4. **并发审查**：分析线程安全性、互斥锁使用情况、数据竞争
5. **现代 C++ 检查**：验证代码是否遵循 C++17/20 约定和最佳实践
6. **生成报告**：按严重程度对问题进行分类

## 使用时机

在以下情况下使用 `/cpp-review`：

* 编写或修改 C++ 代码后
* 提交 C++ 变更前
* 审查包含 C++ 代码的拉取请求时
* 接手新的 C++ 代码库时
* 检查内存安全问题

## 审查类别

### 严重（必须修复）

* 未使用 RAII 的原始 `new`/`delete`
* 缓冲区溢出和释放后使用
* 无同步的数据竞争
* 通过 `system()` 进行命令注入
* 未初始化的变量读取
* 空指针解引用

### 高（应该修复）

* 五法则违规
* 缺少 `std::lock_guard` / `std::scoped_lock`
* 分离的线程没有正确的生命周期管理
* 使用 C 风格强制转换而非 `static_cast`/`dynamic_cast`
* 缺少 `const` 正确性

### 中（考虑）

* 不必要的拷贝（按值传递而非 `const&`）
* 已知大小的容器上缺少 `reserve()`
* 头文件中的 `using namespace std;`
* 重要返回值上缺少 `[[nodiscard]]`
* 过于复杂的模板元编程

## 运行的自动化检查

```bash
# Static analysis
clang-tidy --checks='*,-llvmlibc-*' src/*.cpp -- -std=c++17

# Additional analysis
cppcheck --enable=all --suppress=missingIncludeSystem src/

# Build with warnings
cmake --build build -- -Wall -Wextra -Wpedantic
```

## 使用示例

````text
User: /cpp-review

Agent:
# C++ Code Review Report

## Files Reviewed
- src/handler/user.cpp (modified)
- src/service/auth.cpp (modified)

## Static Analysis Results
✓ clang-tidy: 2 warnings
✓ cppcheck: No issues

## Issues Found

[CRITICAL] Memory Leak
File: src/service/auth.cpp:45
Issue: Raw `new` without matching `delete`
```cpp
auto* session = new Session(userId);  // Memory leak!
cache[userId] = session;
````

修复：使用 `std::unique_ptr`

```cpp
auto session = std::make_unique<Session>(userId);
cache[userId] = std::move(session);
```

\[高] 缺少常量引用
文件：src/handler/user.cpp:28
问题：大对象按值传递

```cpp
void processUser(User user) {  // Unnecessary copy
```

修复：通过常量引用传递

```cpp
void processUser(const User& user) {
```

## 摘要

* 严重：1
* 高：1
* 中：0

建议：❌ 在严重问题修复前阻止合并

```

## Approval Criteria

| Status | Condition |
|--------|-----------|
| ✅ Approve | No CRITICAL or HIGH issues |
| ⚠️ Warning | Only MEDIUM issues (merge with caution) |
| ❌ Block | CRITICAL or HIGH issues found |

## Integration with Other Commands

- Use `/cpp-test` first to ensure tests pass
- Use `/cpp-build` if build errors occur
- Use `/cpp-review` before committing
- Use `/code-review` for non-C++ specific concerns

## Related

- Agent: `agents/cpp-reviewer.md`
- Skills: `skills/cpp-coding-standards/`, `skills/cpp-testing/`

```
