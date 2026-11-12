@echo off
echo Running EcoWatt Grid Guard Automated Pytest Suite...
cd /d %~dp0\..
py -3.12 -m pytest backend/tests -v
pause

