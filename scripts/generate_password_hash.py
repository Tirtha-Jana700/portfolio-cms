"""
Run this once on your own machine (Termux works fine) to turn your chosen
admin password into a hash. You never store the real password anywhere —
only this hash, as the ADMIN_PASSWORD_HASH secret.

Usage:
    pip install werkzeug --break-system-packages   # if not already installed
    python scripts/generate_password_hash.py
"""
import getpass
from werkzeug.security import generate_password_hash

password = getpass.getpass("Choose your admin password: ")
confirm = getpass.getpass("Type it again to confirm: ")

if password != confirm:
    print("Passwords didn't match — try again.")
else:
    print("\nYour password hash (copy the whole line below):\n")
    print(generate_password_hash(password))
    print("\nSet it with:\n  wrangler secret put ADMIN_PASSWORD_HASH\n"
          "(paste the hash above when it asks for the value)")
