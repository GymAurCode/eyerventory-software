"""
Runtime hook: ensures the PyInstaller _MEIPASS temp directory is on sys.path
so that 'backend' is importable as a package when running from the .exe
"""
import os
import sys

# _MEIPASS is where PyInstaller extracts bundled files at runtime
meipass = getattr(sys, "_MEIPASS", None)
if meipass and meipass not in sys.path:
    sys.path.insert(0, meipass)
