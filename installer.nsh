; electron-builder include (package.json build.nsis.include).
; Uninstall, not an update: take Nikki's hooks out of ~/.claude/settings.json while Nikki.exe still exists (M6).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --remove-hooks'
  ${endIf}
!macroend
