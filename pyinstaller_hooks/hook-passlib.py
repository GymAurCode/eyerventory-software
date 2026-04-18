"""
PyInstaller hook for passlib to include all dynamically loaded handlers.
"""

from PyInstaller.utils.hooks import collect_submodules

# Collect all passlib handler submodules
hiddenimports = collect_submodules('passlib.handlers')

# Also include the registry
hiddenimports += ['passlib.registry']

# Include bcrypt if available
try:
    import bcrypt
    hiddenimports += ['bcrypt']
except ImportError:
    pass