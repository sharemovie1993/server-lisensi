#!/usr/bin/env python3
import sys
import re
import subprocess

if len(sys.argv) < 3:
    print("Usage: remove-wg-peer.py <ip_address> <public_key>")
    sys.exit(1)

target_ip = sys.argv[1].strip()
target_pubkey = sys.argv[2].strip()

conf_path = '/etc/wireguard/wg0.conf'

try:
    with open(conf_path, 'r') as f:
        content = f.read()
except Exception as e:
    print(f"Error reading file: {e}")
    sys.exit(1)

# Regex to capture [Peer] blocks including their preceding comments
pattern = re.compile(r'((?:#[^\n]*\n)*\s*\[Peer\][\s\S]*?)(?=(?:#[^\n]*\n)*\s*\[Peer\]|$)')

matches = list(pattern.finditer(content))

if matches:
    header = content[:matches[0].start()]
else:
    header = content

new_content = header.rstrip() + "\n"
removed_count = 0

for m in matches:
    block = m.group(1)
    
    # Check if block contains target_ip or target_pubkey
    has_ip = f"AllowedIPs = {target_ip}/32" in block or f"AllowedIPs = {target_ip} " in block or f"AllowedIPs = {target_ip}/" in block
    has_pubkey = f"PublicKey = {target_pubkey}" in block
    
    if has_ip or has_pubkey:
        print(f"Removing conflict peer block:\n{block.strip()}\n")
        removed_count += 1
    else:
        new_content += "\n" + block.strip() + "\n"

if removed_count > 0:
    try:
        with open(conf_path, 'w') as f:
            f.write(new_content)
        print(f"Successfully removed {removed_count} peer(s) from {conf_path}")
        
        # Sync the running WireGuard config
        subprocess.run("wg syncconf wg0 <(wg-quick strip wg0)", shell=True, check=True, executable='/bin/bash')
        print("WireGuard configuration synced successfully.")
    except Exception as e:
        print(f"Error writing or syncing config: {e}")
        sys.exit(1)
else:
    print("No matching peers found to remove.")
