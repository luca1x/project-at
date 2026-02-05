import os
import subprocess
from datetime import datetime

# --- CONFIGURATION ---
MOTHER_REPO = "/Users/lucatl/production"

# The list of child repos you want to check
CHILD_REPOS = [
    "/Users/lucatl/production-tagger",
    "/Users/lucatl/production-front-end",
    "/Users/lucatl/profile-api",
    "/Users/lucatl/infrastructure",
    "/Users/lucatl/profile-db",
    "/Users/lucatl/advertiser-connect",
    "/Users/lucatl/shared",
    "/Users/lucatl/inference",
    "/Users/lucatl/monitoring-utils",
    "/Users/lucatl/audience-export",
    "/Users/lucatl/items",
    "/Users/lucatl/python-lib",
    "/Users/lucatl/aggregation",
    "/Users/lucatl/utils",
    "/Users/lucatl/measurement-matching",
    "/Users/lucatl/segment-api",
    "/Users/lucatl/experience"
]

def get_repo_start_date(child_path, mother_path):
    if not os.path.exists(child_path):
        return f"ERROR: Path not found"

    try:
        # 1. We need to find the common ancestor.
        # Since these are likely separate folders now, git merge-base won't work 
        # unless they share object databases or are remotes of each other.
        # However, if they were literally copied/forked and are now distinct git repos
        # without a remote link, 'git merge-base' will fail because they don't know each other.
        
        # ASSUMPTION: 'child' is a clean fork that still shares commit hashes with 'mother'.
        # If they are completely disconnected (no shared .git history), this is impossible via git.
        # But assuming they share history:
        
        # We need to add the mother as a temporary remote to the child to compare them
        # (This is non-destructive)
        
        # Check if remote exists
        subprocess.run(
            ["git", "-C", child_path, "remote", "remove", "temp_mother_checker"], 
            stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL
        )
        
        subprocess.run(
            ["git", "-C", child_path, "remote", "add", "temp_mother_checker", mother_path],
            check=True, stderr=subprocess.DEVNULL
        )
        
        subprocess.run(
            ["git", "-C", child_path, "fetch", "temp_mother_checker"],
            check=True, stderr=subprocess.DEVNULL
        )

        # 2. Find the merge base (the split point)
        # We compare HEAD of child vs HEAD of mother
        cmd_merge_base = [
            "git", "-C", child_path, "merge-base", "HEAD", "temp_mother_checker/master" 
            # Note: You might need to change 'master' to 'main' or the specific branch name
        ]
        
        try:
            split_hash = subprocess.check_output(cmd_merge_base, stderr=subprocess.STDOUT).decode().strip()
        except:
            # Try 'main' if 'master' failed
            cmd_merge_base[-1] = "temp_mother_checker/main"
            split_hash = subprocess.check_output(cmd_merge_base).decode().strip()

        # 3. Get the date of that commit
        cmd_date = [
            "git", "-C", child_path, "show", "-s", "--format=%ai", split_hash
        ]
        date_str = subprocess.check_output(cmd_date).decode().strip()
        
        # Clean up
        subprocess.run(
            ["git", "-C", child_path, "remote", "remove", "temp_mother_checker"],
            stderr=subprocess.DEVNULL
        )
        
        # Return just YYYY-MM-DD
        return date_str.split()[0]

    except Exception as e:
        return None # Return None if no common history found (likely a fresh repo, not a fork)

def main():
    print("Calculated Configuration:\n")
    print("REPO_CONFIG = {")
    
    # Always set mother to None (start from beginning)
    print(f'    "{MOTHER_REPO}": None,')

    for repo in CHILD_REPOS:
        date = get_repo_start_date(repo, MOTHER_REPO)
        
        if date:
            print(f'    "{repo}": "{date}",')
        else:
            # If no common history, it implies it's a standalone repo -> start from beginning
            print(f'    "{repo}": None,  # No common history with production found')

    print("}")

if __name__ == "__main__":
    main()