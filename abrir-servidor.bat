@echo off
rem ============================================================
rem  Doble clic aqui para probar la app en este PC.
rem  Arranca servidor.ps1 saltandose la politica de ejecucion de
rem  PowerShell (por eso "Ejecutar con PowerShell" no funcionaba)
rem  y deja la ventana abierta si hay algun error.
rem ============================================================
title Rutina 3+1 - servidor local
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
echo.
echo El servidor se ha detenido.
pause
