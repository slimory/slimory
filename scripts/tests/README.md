# 测试脚本说明 / Test Scripts Documentation

本目录包含项目的测试脚本，用于验证各个功能模块的正确性。

This directory contains test scripts for validating the functionality of various modules.

## 目录结构 / Directory Structure

```
scripts/tests/
├── README.md                    # 本文件 / This file
├── testWebSearch.ts              # WebSearch 工具测试脚本 / WebSearch tool test script
├── testOperationGenerator.ts    # OperationGenerator 测试脚本 / OperationGenerator test script
└── ...                          # 其他测试脚本 / Other test scripts
```

## 测试脚本 / Test Scripts

### testWebSearch.ts

测试 `WebSearchTool` 的功能，包括：

- 搜索查询执行
- 结果提取和验证
- 错误处理

Tests the functionality of `WebSearchTool`, including:

- Search query execution
- Result extraction and validation
- Error handling

#### 使用方法 / Usage

```bash
# 方法 1: 使用 npm 脚本
npm run test:websearch

# 方法 2: 直接运行（需要先编译）
tsc -p tsconfig.main.json
electron scripts/tests/testWebSearch.js
```

#### 测试内容 / Test Content

脚本会测试以下查询：

- TypeScript
- Electron framework
- 人工智能

The script tests the following queries:

- TypeScript
- Electron framework
- 人工智能

#### 输出说明 / Output

测试脚本会输出：

- ✓ 绿色：测试通过 / Green: Test passed
- ✗ 红色：测试失败 / Red: Test failed
- ℹ 蓝色：信息提示 / Blue: Information
- ⚠ 黄色：警告信息 / Yellow: Warning

## 添加新测试 / Adding New Tests

1. 在 `scripts/tests/` 目录下创建新的测试文件
2. 遵循命名规范：`test<ModuleName>.ts`
3. 在 `package.json` 中添加对应的测试命令
4. 更新本 README 文件

5. Create a new test file in `scripts/tests/` directory
6. Follow naming convention: `test<ModuleName>.ts`
7. Add corresponding test command in `package.json`
8. Update this README file

## 注意事项 / Notes

- 测试脚本需要 Electron 环境才能运行
- 某些测试可能需要网络连接
- 测试之间会有延迟以避免冲突

- Test scripts require Electron environment to run
- Some tests may require network connection
- There are delays between tests to avoid conflicts
