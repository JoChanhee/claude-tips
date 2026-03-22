---
description: 逐步修复C++构建错误、CMake问题和链接器问题。调用cpp-build-resolver代理进行最小化、精准的修复。
---

# C++ 构建与修复

此命令调用 **cpp-build-resolver** 代理，以最小的更改逐步修复 C++ 构建错误。

## 此命令的作用

1. **运行诊断**：执行 `cmake --build`、`clang-tidy`、`cppcheck`
2. **解析错误**：按文件分组并按严重性排序
3. **逐步修复**：一次修复一个错误
4. **验证每个修复**：每次更改后重新运行构建
5. **报告摘要**：显示已修复的内容和剩余的问题

## 何时使用

在以下情况下使用 `/cpp-build`：

* `cmake --build build` 因错误而失败时
* 链接器错误（未定义的引用，多重定义）
* 模板实例化失败
* 包含/依赖项问题
* 拉取更改后导致构建失败时

## 运行的诊断命令

```bash
# CMake configure
cmake -B build -S .

# Build
cmake --build build 2>&1 | head -100

# Static analysis (if available)
clang-tidy src/*.cpp -- -std=c++17
cppcheck --enable=all src/
```

## 示例会话

````text
User: /cpp-build

Agent:
# C++ Build Resolution

## Initial Diagnostics

```bash
$ cmake --build build
src/service/user.cpp:25:15: error: use of undeclared identifier 'UserRepository'
src/handler/api.cpp:42:9: error: no matching function for call to 'process'
src/handler/api.cpp:58:1: error: non-void function does not return a value
````

发现的错误：3

## 修复 1：未声明的标识符

文件：src/service/user.cpp:25
错误：使用了未声明的标识符 'UserRepository'
原因：缺少包含

```cpp
// Added include
#include "repository/user_repository.hpp"
```

```bash
$ cmake --build build
# 2 errors remaining
```

## 修复 2：无匹配函数

文件：src/handler/api.cpp:42
错误：没有匹配的函数用于调用 'process'

```cpp
// Changed
process(params.get("count"));
// To
process(std::stoi(params.get("count")));
```

```bash
$ cmake --build build
# 1 error remaining
```

## 修复 3：缺少返回

文件：src/handler/api.cpp:58
错误：非 void 函数未返回值

```cpp
std::optional<User> getUser(const std::string& id) {
    if (id.empty()) {
        return std::nullopt;
    }
    auto user = findUser(id);
    // Added missing return
    return user;
}
```

```bash
$ cmake --build build
# Build successful!
```

## 最终验证

```bash
$ ctest --test-dir build --output-on-failure
Test project build
    1/5 Test #1: unit_tests ........   Passed    0.02 sec
    2/5 Test #2: integration_tests    Passed    0.15 sec
All tests passed.
```

## 摘要

| 指标 | 数量 |
|--------|-------|
| 已修复的构建错误 | 3 |
| 已修复的链接器错误 | 0 |
| 已修改的文件 | 2 |
| 剩余问题 | 0 |

构建状态：✅ 成功

```

## Common Errors Fixed

| Error | Typical Fix |
|-------|-------------|
| `undeclared identifier` | Add `#include` or fix typo |
| `no matching function` | Fix argument types or add overload |
| `undefined reference` | Link library or add implementation |
| `multiple definition` | Use `inline` or move to .cpp |
| `incomplete type` | Replace forward decl with `#include` |
| `no member named X` | Fix member name or include |
| `cannot convert X to Y` | Add appropriate cast |
| `CMake Error` | Fix CMakeLists.txt configuration |

## Fix Strategy

1. **Compilation errors first** - Code must compile
2. **Linker errors second** - Resolve undefined references
3. **Warnings third** - Fix with `-Wall -Wextra`
4. **One fix at a time** - Verify each change
5. **Minimal changes** - Don't refactor, just fix

## Stop Conditions

The agent will stop and report if:
- Same error persists after 3 attempts
- Fix introduces more errors
- Requires architectural changes
- Missing external dependencies

## Related Commands

- `/cpp-test` - Run tests after build succeeds
- `/cpp-review` - Review code quality
- `/verify` - Full verification loop

## Related

- Agent: `agents/cpp-build-resolver.md`
- Skill: `skills/cpp-coding-standards/`

```
