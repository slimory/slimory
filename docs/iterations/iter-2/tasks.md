# Iteration 2 Tasks

## Task Breakdown

### Task 1: Add requireCtrlForMenu to Settings Storage
**Priority**: P0 (blocking)  
**Effort**: Small (0.5h)  
**Owner**: Agent-Claude  
**Status**: ✅ Completed  
**Started**: 2026-08-11
**Completed**: 2026-08-11

**Description**:
Add `requireCtrlForMenu` boolean field to the settings interface and storage logic.

**Acceptance Criteria**:
- [x] Add `requireCtrlForMenu?: boolean` to settings type/interface
- [x] Default value is `false` (backward compatible)
- [x] Field is saved and loaded correctly via SettingsStorage
- [x] IPC handlers support the new field

**Dependencies**: None

**Related Files**:
- `src/services/settingsStorage.ts`
- `src/main/main.ts` (IPC handlers)

**Implementation Notes**:
- Added `requireCtrlForMenu` to Settings interface
- Updated `loadAllSettings()` to return default value `false`
- Updated `saveSettings()` to handle the new field
- Updated `loadSettings()` to return the field
- Added `getRequireCtrlForMenu()` and `saveRequireCtrlForMenu()` methods

**Completion Time**: 2026-08-11
**Actual Effort**: 0.5h

---

### Task 2: Track Ctrl Key State in Text Monitor
**Priority**: P0 (blocking)  
**Effort**: Medium (1h)  
**Owner**: Agent-Claude  
**Status**: ✅ Completed  
**Started**: 2026-08-11
**Completed**: 2026-08-11

**Description**:
Modify textMonitor.ts to track whether Ctrl key is held during text selection (from mousedown to mouseup).

**Acceptance Criteria**:
- [x] Track Ctrl key state on mousedown event
- [x] Track Ctrl key state on mouseup event
- [x] Only invoke callback if text selected AND (setting disabled OR Ctrl was held)
- [x] Add setting parameter to startTextMonitor function

**Dependencies**: Task 1

**Related Files**:
- `src/main/textMonitor.ts`

**Implementation Notes**:
- Added `getRequireCtrlForMenuCallback` callback parameter
- Added `ctrlKeyOnMouseDown` and `ctrlKeyOnMouseUp` to dataStore
- Track Ctrl state using `event.ctrlKey` from uIOhook
- Check both mousedown and mouseup had Ctrl pressed
- Only show menu if setting disabled OR Ctrl was held during entire selection

**Completion Time**: 2026-08-11
**Actual Effort**: 1h

---

### Task 3: Update Main Process to Pass Setting
**Priority**: P0 (blocking)  
**Effort**: Small (0.5h)  
**Owner**: Agent-Claude  
**Status**: ✅ Completed  
**Started**: 2026-08-11
**Completed**: 2026-08-11

**Description**:
Update main.ts to load the `requireCtrlForMenu` setting and pass it to the text monitor callback.

**Acceptance Criteria**:
- [x] Load `requireCtrlForMenu` from settings on startup
- [x] Pass the setting value to textMonitor via callback or global access
- [x] Update setting when user changes it in UI

**Dependencies**: Task 1, Task 2

**Related Files**:
- `src/main/main.ts`

**Implementation Notes**:
- Added getter callback to `startTextMonitor()` that returns `settingsStorage.getRequireCtrlForMenu()`
- Added IPC handlers: `save-require-ctrl-for-menu` and `get-require-ctrl-for-menu`
- Setting is dynamically read on each text selection event

**Completion Time**: 2026-08-11
**Actual Effort**: 0.5h

---

### Task 4: Add UI Toggle in Settings Panel
**Priority**: P0 (blocking)  
**Effort**: Medium (1h)  
**Owner**: Agent-Claude  
**Status**: ✅ Completed  
**Started**: 2026-08-11
**Completed**: 2026-08-11

**Description**:
Add a checkbox/toggle in SettingsPanel.tsx to enable/disable the Ctrl key requirement.

**Acceptance Criteria**:
- [x] Add toggle UI element in appropriate section
- [x] Label: translated string for "Require Ctrl key to show menu"
- [x] Add tooltip/description explaining the feature
- [x] Save immediately when toggled
- [x] Load initial state from settings

**Dependencies**: Task 1, Task 3

**Related Files**:
- `src/renderer/components/SettingsPanel.tsx`
- `src/renderer/i18n/locales/*.json` (translations)

**Implementation Notes**:
- Placed in "General Settings" section after "Word Selection" toggle
- Follows existing toggle pattern (wordSelectionEnabled)
- Added state variable `requireCtrlForMenu`
- Added handler `handleRequireCtrlForMenuChange()`
- Loads setting on component mount via `getRequireCtrlForMenu()`
- Added IPC type definitions in `preload.ts` and `vite-env.d.ts`

**Completion Time**: 2026-08-11
**Actual Effort**: 1h

---

### Task 5: Add Translations
**Priority**: P1 (important)  
**Effort**: Small (0.5h)  
**Owner**: Agent-Claude  
**Status**: ✅ Completed  
**Started**: 2026-08-11
**Completed**: 2026-08-11

**Description**:
Add translation strings for the new setting in all 10 supported languages.

**Acceptance Criteria**:
- [x] Add key to all locale files (zh, en, es, ja, de, fr, pt, ar, hi, bn)
- [x] Translation for "Require Ctrl key to show menu"
- [x] Translation for description/tooltip

**Dependencies**: Task 4

**Related Files**:
- `src/renderer/i18n/locales/zh.json`
- `src/renderer/i18n/locales/en.json`
- `src/renderer/i18n/locales/es.json`
- `src/renderer/i18n/locales/ja.json`
- `src/renderer/i18n/locales/de.json`
- `src/renderer/i18n/locales/fr.json`
- `src/renderer/i18n/locales/pt.json`
- `src/renderer/i18n/locales/ar.json`
- `src/renderer/i18n/locales/hi.json`
- `src/renderer/i18n/locales/bn.json`

**Implementation Notes**:
Added three translation keys for each language:
- `requireCtrlForMenuDescription`: Description of the feature
- `requireCtrlForMenuEnabled`: Status when enabled
- `requireCtrlForMenuDisabled`: Status when disabled

**Completion Time**: 2026-08-11
**Actual Effort**: 0.5h

---

### Task 6: Testing & Verification
**Priority**: P0 (blocking)  
**Effort**: Small (0.5h)  
**Owner**: Agent-Claude  
**Status**: ⏳ Pending  
**Started**:

**Description**:
Manual testing to verify the feature works correctly in both modes.

**Acceptance Criteria**:
- [ ] With setting disabled: menu appears on text selection (current behavior)
- [ ] With setting enabled: menu only appears when Ctrl held during selection
- [ ] Setting persists after app restart
- [ ] No errors in console
- [ ] Works across different applications

**Dependencies**: All previous tasks

**Related Files**:
- All implementation files

**Implementation Notes**:
- Test in multiple apps (browser, notepad, VS Code)
- Test edge cases: releasing Ctrl before mouseup, etc.
- Verify build completes successfully (✅ Completed - build passed)

**Completion Time**:  
**Actual Effort**:

---

## Summary
- **Total Tasks**: 6
- **Completed**: 5
- **In Progress**: 0
- **Pending**: 1
- **Estimated Total Effort**: 4h
- **Actual Effort**: 3.5h
