@echo off
cd /d "%~dp0"
set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
call gradlew assembleDebug
