# Iteration 2: Ctrl Key Modifier for Menu Popup

## Overview
Add an optional setting that requires users to hold the Ctrl key while selecting text to trigger the menu popup. This gives users more control and reduces accidental menu triggers.

## Goals
- Provide users with optional control over when the selection menu appears
- Reduce accidental menu popups during normal text selection
- Maintain backward compatibility (disabled by default means current behavior)

## User Requirements
This iteration addresses:
- [ ] Optional Ctrl key requirement for menu popup (reduce accidental triggers) - from `docs/USER_REQUIREMENTS.md`

## Features

### 1. Ctrl Key Detection During Selection
**Description**: Track whether Ctrl key is held down during the entire text selection gesture (from mousedown to mouseup).

**Technical approach**:
- Modify `textMonitor.ts` to track Ctrl key state
- Check Ctrl state in both mousedown and mouseup events
- Only trigger menu callback when both conditions met: text selected AND (setting disabled OR Ctrl held)

### 2. Settings Storage
**Description**: Store the `requireCtrlForMenu` preference in settings.

**Technical approach**:
- Add `requireCtrlForMenu?: boolean` to settings interface
- Default to `false` (current behavior - no Ctrl required)
- Persist across app restarts via `SettingsStorage`

### 3. Settings UI Toggle
**Description**: Add a toggle switch in SettingsPanel for users to enable/disable this feature.

**Technical approach**:
- Add checkbox/toggle in SettingsPanel.tsx under "General Settings" section
- Label: "Require Ctrl key to show menu" with description
- Save immediately on toggle

## Technical Decisions

### Why Ctrl key?
- **Most intuitive**: Windows users expect Ctrl as the primary action modifier
- **No conflicts**: Ctrl+Space is global and won't interfere with text selection
- **Better than Alt**: Alt triggers application menus in many apps
- **Better than Shift**: Shift extends selections in text editors

### Why default to disabled?
- Backward compatibility: existing users expect current behavior
- Discoverability: new users will see the menu work immediately and learn they can enable Ctrl requirement later

## Implementation Plan

1. **Update SettingsStorage** - Add `requireCtrlForMenu` field
2. **Modify textMonitor.ts** - Track Ctrl key state during selection
3. **Update main.ts** - Pass settings to textMonitor callback
4. **Update SettingsPanel.tsx** - Add UI toggle
5. **Test** - Verify behavior with setting on/off

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Ctrl key detection unreliable | Use uIOhook's built-in `ctrlKey` property which is reliable |
| Users don't discover the setting | Add tooltip/description in settings panel |
| Breaks existing user workflows | Default to disabled (current behavior) |

## Success Metrics
- Setting can be toggled on/off
- When enabled, menu only appears with Ctrl held during selection
- When disabled, menu appears on any selection (current behavior)
- Setting persists across app restarts

## Out of Scope
- Supporting other modifier keys (Alt, Shift) - can be added later if requested
- Per-app modifier key settings - too complex for now
- Customizable modifier key combinations (e.g., Ctrl+Shift)
