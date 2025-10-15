#!/usr/bin/env python3
"""
Firewalla Time Manager - CLI tool to manage internet access time for kids.
Works by communicating with a local Node.js bridge server that handles
encrypted communication with the Firewalla device.
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

import requests

# Bridge server configuration (can be overridden with environment variables)
BRIDGE_URL = os.getenv("BRIDGE_URL", "http://localhost:3002")


class FirewallaBridge:
    """Client for the Firewalla Node.js bridge server."""

    def __init__(self, bridge_url: str = BRIDGE_URL):
        self.bridge_url = bridge_url

    def check_health(self) -> Dict:
        """Check if bridge server is connected to Firewalla."""
        try:
            response = requests.get(f"{self.bridge_url}/health", timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error connecting to bridge server: {e}", file=sys.stderr)
            sys.exit(1)

    def get_policies(self) -> Dict:
        """Get all policies from Firewalla."""
        try:
            response = requests.get(f"{self.bridge_url}/api/screentime", timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching policies: {e}", file=sys.stderr)
            sys.exit(1)

    def get_all_data(self) -> Dict:
        """Get all data from Firewalla including users."""
        try:
            response = requests.get(f"{self.bridge_url}/api/init", timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data: {e}", file=sys.stderr)
            sys.exit(1)

    def send_message(self, message: str, data: Dict) -> Dict:
        """Send a raw API message to Firewalla."""
        try:
            response = requests.post(f"{self.bridge_url}/api/send", json={"message": message, "data": data}, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error sending message: {e}", file=sys.stderr)
            sys.exit(1)

    def pause_policy(self, policy_id: str, minutes: int) -> Dict:
        """Pause a policy for X minutes (disable with auto-expiration)."""
        try:
            response = requests.post(
                f"{self.bridge_url}/api/policy/{policy_id}/pause", json={"minutes": minutes}, timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error pausing policy: {e}", file=sys.stderr)
            sys.exit(1)


def format_duration(seconds: int) -> str:
    """Convert seconds to human-readable format."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def parse_cron_time(cron_str: str) -> str:
    """Parse cron time string (e.g., '0 22 * * *') to human-readable time."""
    parts = cron_str.split()
    if len(parts) >= 2:
        minute, hour = parts[0], parts[1]
        return f"{hour.zfill(2)}:{minute.zfill(2)}"
    return cron_str


def list_policies(bridge: FirewallaBridge, by_user: bool = False):
    """List all time-based blocking policies."""
    health = bridge.check_health()
    if health.get("status") != "connected":
        print("Bridge not connected to Firewalla", file=sys.stderr)
        sys.exit(1)

    print(f"✓ Connected to Firewalla at {health.get('firewalla_ip')}\n")

    # Get all data including users
    data = bridge.get_all_data()
    policy_rules = data.get("policyRules", [])
    user_tags = data.get("userTags", {})

    # Build a map of tag to user names
    tag_to_users = {}
    for uid, user in user_tags.items():
        affiliated_tag = user.get("affiliatedTag")
        user_name = user.get("name", "Unknown")
        if affiliated_tag:
            tag_key = f"tag:{affiliated_tag}"
            if tag_key not in tag_to_users:
                tag_to_users[tag_key] = []
            tag_to_users[tag_key].append(user_name)

    # Filter to only time-based blocking policies with tags
    time_policies = [
        p
        for p in policy_rules
        if p.get("type") in ["mac", "intranet"] and "duration" in p and "cronTime" in p and p.get("tag")
    ]

    if not time_policies:
        print("No time-based blocking policies found.")
        return

    if by_user:
        # Group policies by user
        user_policies = {}
        for uid, user in user_tags.items():
            user_name = user.get("name", "Unknown")
            affiliated_tag = user.get("affiliatedTag")
            tag_key = f"tag:{affiliated_tag}"

            user_policy_list = [p for p in time_policies if tag_key in p.get("tag", [])]
            if user_policy_list:
                user_policies[user_name] = {"uid": uid, "tag": tag_key, "policies": user_policy_list}

        print(f"Found {len(time_policies)} time-based policies for {len(user_policies)} users:\n")

        for user_name, user_data in user_policies.items():
            print(f"👤 {user_name}")
            print(f"   User ID: {user_data['uid']}")
            print(f"   Tag: {user_data['tag']}\n")

            for policy in user_data["policies"]:
                pid = policy.get("pid")
                policy_type = policy.get("type")
                action = policy.get("action", "unknown")
                duration = int(policy.get("duration", 0))
                cron_time = policy.get("cronTime", "")
                disabled = policy.get("disabled", "0") == "1"
                hit_count = policy.get("hitCount", "0")

                status = "DISABLED" if disabled else "ACTIVE"

                print(f"   Policy ID: {pid} [{status}]")
                print(f"     Type: {policy_type}")
                print(f"     Action: {action}")
                print(f"     Schedule: Blocks at {parse_cron_time(cron_time)} for {format_duration(duration)}")
                print(f"     Times triggered: {hit_count}")
                print()
    else:
        # Show all policies with user info
        print(f"Found {len(time_policies)} time-based internet blocking policies:\n")

        for policy in time_policies:
            pid = policy.get("pid")
            tags = policy.get("tag", [])
            tags_str = ", ".join(tags)
            policy_type = policy.get("type")
            action = policy.get("action", "unknown")
            duration = int(policy.get("duration", 0))
            cron_time = policy.get("cronTime", "")
            disabled = policy.get("disabled", "0") == "1"
            hit_count = policy.get("hitCount", "0")

            status = "DISABLED" if disabled else "ACTIVE"

            # Find users for this policy's tags
            users_for_policy = []
            for tag in tags:
                if tag in tag_to_users:
                    users_for_policy.extend(tag_to_users[tag])

            print(f"Policy ID: {pid} [{status}]")
            if users_for_policy:
                print(f"  Users: {', '.join(users_for_policy)}")
            print(f"  Tags: {tags_str}")
            print(f"  Type: {policy_type}")
            print(f"  Action: {action}")
            print(f"  Schedule: Blocks at {parse_cron_time(cron_time)} for {format_duration(duration)}")
            print(f"  Times triggered: {hit_count}")
            print()


def extend_time(bridge: FirewallaBridge, policy_id: str, additional_minutes: int):
    """
    Extend internet access time by modifying the policy duration.

    This increases the blocking duration, which effectively delays when
    the internet gets blocked again.
    """
    health = bridge.check_health()
    if health.get("status") != "connected":
        print("Bridge not connected to Firewalla", file=sys.stderr)
        sys.exit(1)

    data = bridge.get_policies()
    policy_rules = data.get("policyRules", [])

    # Find the policy
    policy = None
    for p in policy_rules:
        if p.get("pid") == policy_id:
            policy = p
            break

    if not policy:
        print(f"Policy {policy_id} not found", file=sys.stderr)
        sys.exit(1)

    current_duration = int(policy.get("duration", 0))
    additional_seconds = additional_minutes * 60
    new_duration = current_duration + additional_seconds

    print(f"Current duration: {format_duration(current_duration)}")
    print(f"Adding: {additional_minutes} minutes")
    print(f"New duration: {format_duration(new_duration)}")

    # Update the policy via raw API
    policy["duration"] = str(new_duration)

    try:
        result = bridge.send_message("setPolicy", policy)
        print(f"\n✓ Successfully extended time for policy {policy_id}")

        # Log the extension
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "policy_id": policy_id,
            "tags": policy.get("tag", []),
            "extension_minutes": additional_minutes,
            "old_duration": format_duration(current_duration),
            "new_duration": format_duration(new_duration),
        }

        with open("time_extensions.log", "a") as f:
            f.write(json.dumps(log_entry) + "\n")

        print(f"Extension logged to time_extensions.log")

    except Exception as e:
        print(f"Error updating policy: {e}", file=sys.stderr)
        sys.exit(1)


def disable_policy(bridge: FirewallaBridge, policy_id: str, minutes: int):
    """
    Temporarily disable a blocking policy for X minutes.
    This immediately grants internet access.
    """
    health = bridge.check_health()
    if health.get("status") != "connected":
        print("Bridge not connected to Firewalla", file=sys.stderr)
        sys.exit(1)

    data = bridge.get_policies()
    policy_rules = data.get("policyRules", [])

    # Find the policy
    policy = None
    for p in policy_rules:
        if p.get("pid") == policy_id:
            policy = p
            break

    if not policy:
        print(f"Policy {policy_id} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Disabling policy {policy_id} for {minutes} minutes...")

    # Set disabled flag
    policy["disabled"] = "1"

    try:
        result = bridge.send_message("setPolicy", policy)
        print(f"\n✓ Successfully disabled policy {policy_id}")
        print(f"⏰ Remember to re-enable it after {minutes} minutes!")

        # Log the grant
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "policy_id": policy_id,
            "tags": policy.get("tag", []),
            "action": "disabled",
            "duration_minutes": minutes,
        }

        with open("time_extensions.log", "a") as f:
            f.write(json.dumps(log_entry) + "\n")

        print(f"\nGrant logged to time_extensions.log")
        print(f"\nTo re-enable, run: {sys.argv[0]} enable {policy_id}")

    except Exception as e:
        print(f"Error disabling policy: {e}", file=sys.stderr)
        sys.exit(1)


def enable_policy(bridge: FirewallaBridge, policy_id: str):
    """Re-enable a disabled blocking policy."""
    health = bridge.check_health()
    if health.get("status") != "connected":
        print("Bridge not connected to Firewalla", file=sys.stderr)
        sys.exit(1)

    data = bridge.get_policies()
    policy_rules = data.get("policyRules", [])

    # Find the policy
    policy = None
    for p in policy_rules:
        if p.get("pid") == policy_id:
            policy = p
            break

    if not policy:
        print(f"Policy {policy_id} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Enabling policy {policy_id}...")

    # Clear disabled flag
    policy["disabled"] = "0"

    try:
        result = bridge.send_message("setPolicy", policy)
        print(f"\n✓ Successfully enabled policy {policy_id}")

    except Exception as e:
        print(f"Error enabling policy: {e}", file=sys.stderr)
        sys.exit(1)


def pause_policy(bridge: FirewallaBridge, policy_id: str, minutes: int):
    """
    Pause a blocking policy for X minutes.
    This temporarily disables the policy with automatic re-enabling.
    """
    health = bridge.check_health()
    if health.get("status") != "connected":
        print("Bridge not connected to Firewalla", file=sys.stderr)
        sys.exit(1)

    data = bridge.get_policies()
    policy_rules = data.get("policyRules", [])

    # Find the policy
    policy = None
    for p in policy_rules:
        if p.get("pid") == policy_id:
            policy = p
            break

    if not policy:
        print(f"Policy {policy_id} not found", file=sys.stderr)
        sys.exit(1)

    tags = ", ".join(policy.get("tag", []))
    print(f"Pausing policy {policy_id} ({tags}) for {minutes} minutes...")

    try:
        result = bridge.pause_policy(policy_id, minutes)

        if result.get("success"):
            expires_at = result.get("expiresAt", "")
            print(f"\n✓ Successfully paused policy {policy_id}")
            print(f"⏰ Policy will automatically re-enable at {expires_at}")
            print(f"🌐 Internet access granted for {minutes} minutes")

            # Log the pause
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "policy_id": policy_id,
                "tags": policy.get("tag", []),
                "action": "paused",
                "duration_minutes": minutes,
                "expires_at": expires_at,
            }

            with open("time_extensions.log", "a") as f:
                f.write(json.dumps(log_entry) + "\n")

            print(f"\nPause logged to time_extensions.log")
        else:
            print(f"Failed to pause policy: {result}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"Error pausing policy: {e}", file=sys.stderr)
        sys.exit(1)


def show_log():
    """Show the time extension log."""
    try:
        with open("time_extensions.log", "r") as f:
            print("Time Extension Log:\n")
            for line in f:
                entry = json.loads(line.strip())
                timestamp = entry.get("timestamp", "unknown")
                policy_id = entry.get("policy_id", "unknown")
                tags = ", ".join(entry.get("tags", []))

                action = entry.get("action")
                if action == "paused":
                    duration = entry.get("duration_minutes", "unknown")
                    expires_at = entry.get("expires_at", "unknown")
                    print(
                        f"{timestamp} - Paused policy {policy_id} ({tags}) for {duration} minutes (expires: {expires_at})"
                    )
                elif action == "disabled":
                    duration = entry.get("duration_minutes", "unknown")
                    print(f"{timestamp} - Disabled policy {policy_id} ({tags}) for {duration} minutes")
                else:
                    extension = entry.get("extension_minutes", "unknown")
                    old_dur = entry.get("old_duration", "unknown")
                    new_dur = entry.get("new_duration", "unknown")
                    print(
                        f"{timestamp} - Extended policy {policy_id} ({tags}) by {extension} min: {old_dur} → {new_dur}"
                    )
    except FileNotFoundError:
        print("No log file found. No extensions have been granted yet.")


def main():
    if len(sys.argv) < 2:
        print("Firewalla Time Manager")
        print("\nUsage:")
        print(f"  {sys.argv[0]} list [--by-user]             - List all time-based policies")
        print(f"  {sys.argv[0]} pause <policy_id> <minutes>  - Pause policy (auto re-enables)")
        print(f"  {sys.argv[0]} grant <policy_id> <minutes>  - Temporarily disable policy (manual re-enable)")
        print(f"  {sys.argv[0]} enable <policy_id>           - Re-enable a disabled policy")
        print(f"  {sys.argv[0]} extend <policy_id> <minutes> - Extend blocking duration")
        print(f"  {sys.argv[0]} log                          - Show extension log")
        sys.exit(1)

    command = sys.argv[1]
    bridge = FirewallaBridge()

    if command == "list":
        by_user = "--by-user" in sys.argv
        list_policies(bridge, by_user=by_user)

    elif command == "pause":
        if len(sys.argv) < 4:
            print("Usage: pause <policy_id> <minutes>", file=sys.stderr)
            sys.exit(1)
        policy_id = sys.argv[2]
        minutes = int(sys.argv[3])
        pause_policy(bridge, policy_id, minutes)

    elif command == "extend":
        if len(sys.argv) < 4:
            print("Usage: extend <policy_id> <minutes>", file=sys.stderr)
            sys.exit(1)
        policy_id = sys.argv[2]
        minutes = int(sys.argv[3])
        extend_time(bridge, policy_id, minutes)

    elif command == "grant":
        if len(sys.argv) < 4:
            print("Usage: grant <policy_id> <minutes>", file=sys.stderr)
            sys.exit(1)
        policy_id = sys.argv[2]
        minutes = int(sys.argv[3])
        disable_policy(bridge, policy_id, minutes)

    elif command == "enable":
        if len(sys.argv) < 3:
            print("Usage: enable <policy_id>", file=sys.stderr)
            sys.exit(1)
        policy_id = sys.argv[2]
        enable_policy(bridge, policy_id)

    elif command == "log":
        show_log()

    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
