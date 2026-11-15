@echo off
cd /d "%~dp0\..\.."
py -3 -m tools.json_generator.app
if errorlevel 1 pause
