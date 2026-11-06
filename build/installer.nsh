; Keep electron-builder's tested uninstallOldVersion flow. This page only explains
; the upgrade; it never deletes folders or launches an uninstaller itself.
!ifndef BUILD_UNINSTALLER
!include "nsDialogs.nsh"
Var CheckpointUpgradeDialog
Var CheckpointOldVersion
Var CheckpointOldLocation
Var CheckpointUpgradeCheckbox

!macro customPageAfterChangeDir
  Page custom CheckpointUpgradePage

Function CheckpointUpgradePage
  ReadRegStr $CheckpointOldVersion SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ReadRegStr $CheckpointOldLocation SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ; An all-users update also removes an existing current-user installation.
  ${If} $CheckpointOldVersion == ""
  ${AndIf} $installMode == "all"
    ReadRegStr $CheckpointOldVersion HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ReadRegStr $CheckpointOldLocation HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${EndIf}
  ${If} $CheckpointOldVersion == ""
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Checkpoint Studio aktualisieren" "Die vorhandene Installation wird ersetzt."
  nsDialogs::Create 1018
  Pop $CheckpointUpgradeDialog
  ${If} $CheckpointUpgradeDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 24u "Vorhandene Version: $CheckpointOldVersion"
  Pop $0
  ${NSD_CreateLabel} 0 25u 100% 28u "Installiert unter: $CheckpointOldLocation"
  Pop $0
  ${NSD_CreateCheckbox} 0 60u 100% 24u "Bisherige Programmversion automatisch entfernen"
  Pop $CheckpointUpgradeCheckbox
  ${NSD_Check} $CheckpointUpgradeCheckbox
  EnableWindow $CheckpointUpgradeCheckbox 0
  ${NSD_CreateLabel} 0 92u 100% 40u "Die alte App wird beim Installieren entfernt und durch Version ${VERSION} ersetzt. Es wird keine zweite App angelegt. Einstellungen und Projektordner ausserhalb des Programmordners bleiben erhalten."
  Pop $0
  nsDialogs::Show
FunctionEnd
!macroend
!endif
