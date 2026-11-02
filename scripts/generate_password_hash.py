"""
Run this locally (Termux is fine) to generate a new admin password hash,
in the exact format your worker.py's custom_check_password expects:
  <salt>$<sha256(salt + password)>

Usage:
    python scripts/generate_password_hash.py
"""
import getpass
import hashlib
import os

password = getpass.getpass("New admin password: ")
confirm = getpass.getpass("Type it again to confirm: ")

if password != confirm:
    print("Passwords didn't match — try again.")
else:
    salt = os.urandom(16).hex()
    pwd_hash = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    stored = f"{salt}${pwd_hash}"
    print("\nYour new password hash (copy the whole line below):\n")
    print(stored)
    print("\nUpdate it in the Cloudflare dashboard:")
    print("  your Worker -> Settings -> Variables and Secrets -> ADMIN_PASSWORD_HASH -> Edit")
