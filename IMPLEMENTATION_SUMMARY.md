# Implementation Summary: Ctrl Key Modifier for Menu Popup

## 功能概述

添加了一个可选设置，允许用户配置是否需要在选中文本时按住 Ctrl 键才显示划词菜单。这个功能可以减少意外触发菜单的情况。

## 实现时间

- 开始时间: 2026-08-11
- 完成时间: 2026-08-11
- 实际工作量: 3.5 小时

## 技术实现

### 1. 设置存储 (settingsStorage.ts)

**修改内容**:
- 在 `Settings` 接口添加 `requireCtrlForMenu?: boolean` 字段
- 在 `loadAllSettings()` 中添加默认值 `false`（向后兼容）
- 在 `saveSettings()` 和 `loadSettings()` 中处理新字段
- 添加 `getRequireCtrlForMenu()` 和 `saveRequireCtrlForMenu()` 方法

### 2. 文本监控 (textMonitor.ts)

**修改内容**:
- 添加 `getRequireCtrlForMenuCallback` 回调参数
- 在 dataStore 中添加 `ctrlKeyOnMouseDown` 和 `ctrlKeyOnMouseUp` 状态追踪
- 在 mousedown 事件中记录 `event.ctrlKey` 状态
- 在 mouseup 事件中检查：
  - 如果设置关闭：正常显示菜单（当前行为）
  - 如果设置开启：只有当 Ctrl 键在 mousedown 和 mouseup 都按下时才显示菜单

### 3. 主进程 (main.ts)

**修改内容**:
- 在 `startTextMonitor()` 调用中添加第四个回调参数，返回 `settingsStorage.getRequireCtrlForMenu()`
- 添加 IPC 处理器：
  - `save-require-ctrl-for-menu`: 保存设置
  - `get-require-ctrl-for-menu`: 获取设置

### 4. 预加载脚本 (preload.ts)

**修改内容**:
- 添加 `saveRequireCtrlForMenu` IPC 方法
- 添加 `getRequireCtrlForMenu` IPC 方法

### 5. 类型定义 (vite-env.d.ts)

**修改内容**:
- 为新的 IPC 方法添加 TypeScript 类型定义

### 6. 设置界面 (SettingsPanel.tsx)

**修改内容**:
- 添加 `requireCtrlForMenu` 状态变量
- 添加 `handleRequireCtrlForMenuChange()` 处理函数
- 在组件加载时通过 `getRequireCtrlForMenu()` 获取初始状态
- 在"划词功能"设置下方添加新的切换控件
- 使用与现有 wordSelectionEnabled 相同的 UI 样式

### 7. 国际化 (i18n/locales/*.json)

**修改内容**:
为所有 10 种支持的语言添加翻译：
- `requireCtrlForMenuDescription`: 功能描述
- `requireCtrlForMenuEnabled`: 开启状态
- `requireCtrlForMenuDisabled`: 关闭状态

支持的语言：
- 中文 (zh)
- 英文 (en)
- 西班牙语 (es)
- 日语 (ja)
- 德语 (de)
- 法语 (fr)
- 葡萄牙语 (pt)
- 阿拉伯语 (ar)
- 印地语 (hi)
- 孟加拉语 (bn)

## 用户体验

### 默认行为（向后兼容）
- 设置默认为 `false`
- 用户选中文本时，菜单立即弹出（当前行为不变）

### 启用 Ctrl 键要求后
- 用户需要在选中文本的整个过程中（从 mousedown 到 mouseup）按住 Ctrl 键
- 只有当 Ctrl 键在整个选择过程中都按下时，菜单才会显示
- 如果用户在选择中途松开 Ctrl 键，菜单不会显示

### 设置位置
- 在设置面板的"划词功能"部分
- 紧跟在"启用划词功能"开关之后
- 有清晰的描述文字和状态指示

## 技术决策

### 为什么选择 Ctrl 键？
1. **最直观**: Windows 用户习惯用 Ctrl 作为主要操作修饰键
2. **无冲突**: 不与现有的 Ctrl+Space（打开聊天）冲突
3. **优于 Alt**: Alt 键会触发应用程序菜单
4. **优于 Shift**: Shift 用于扩展选择

### 为什么默认关闭？
1. **向后兼容**: 现有用户的使用习惯不会被打断
2. **可发现性**: 新用户能立即看到菜单工作，之后可以选择启用 Ctrl 键要求

### 实现方式
- 使用 uIOhook 的 `event.ctrlKey` 属性追踪按键状态
- 在 mousedown 和 mouseup 都检查 Ctrl 状态，确保在整个选择过程中按住
- 通过回调动态读取设置，无需重启应用

## 测试验证

### 编译测试
✅ 通过 - `npm run dev-build` 成功完成，无错误

### 需要的手动测试（Task 6 待完成）
1. 设置关闭时：选中文本立即显示菜单
2. 设置开启时：只有按住 Ctrl 选中文本才显示菜单
3. 设置在应用重启后保持
4. 在不同应用中测试（浏览器、记事本、VS Code 等）
5. 测试边缘情况：中途松开 Ctrl 键等

## 文档更新

- ✅ `docs/USER_REQUIREMENTS.md` - 标记需求为已完成
- ✅ `docs/CHANGELOG.md` - 添加功能到 Unreleased 部分
- ✅ `docs/iterations/README.md` - 更新迭代状态
- ✅ `docs/iterations/iter-2/tasks.md` - 标记任务完成状态
- ✅ `docs/iterations/iter-2/prd.md` - 已创建产品需求文档

## 相关文件

### 修改的文件
1. `src/services/settingsStorage.ts` - 设置存储
2. `src/main/textMonitor.ts` - 文本监控逻辑
3. `src/main/main.ts` - 主进程和 IPC 处理
4. `src/preload/preload.ts` - 预加载脚本
5. `src/renderer/vite-env.d.ts` - TypeScript 类型定义
6. `src/renderer/components/SettingsPanel.tsx` - 设置界面
7. `src/renderer/i18n/locales/*.json` - 10 种语言的翻译文件

### 新增的文件
1. `docs/iterations/iter-2/prd.md` - 产品需求文档
2. `docs/iterations/iter-2/tasks.md` - 任务跟踪文档

## 后续步骤

1. ✅ 所有代码实现已完成
2. ✅ 所有翻译已添加
3. ✅ 编译测试通过
4. ⏳ 等待用户进行手动测试验证（Task 6）

## 注意事项

- 此功能不影响现有用户的使用体验（默认关闭）
- 可以在设置中随时切换，立即生效
- 支持所有 10 种界面语言
- 与现有的禁用应用列表功能兼容

---

**最后更新**: 2026-08-11
