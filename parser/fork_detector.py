import os
import subprocess
import json
import sys

# --- CONFIGURATION ---
MOTHER_REPO = "/Users/lucatl/production"
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
    "/Users/lucatl/utils",
    "/Users/lucatl/measurement-matching",
    "/Users/lucatl/segment-api",
    "/Users/lucatl/experience"
]

# --- PATH SETUP ---
# Get the absolute path of the script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Go up one level (..), then into 'config'
CONFIG_FILE = os.path.join(SCRIPT_DIR, "..", "config", "repo_config.json")
CONFIG_FILE = os.path.normpath(CONFIG_FILE)
def get_default_branch(repo_path):
    """Tries to guess the main branch name (main, master, production, etc.)"""
    try:
        # Get the branch HEAD points to
        cmd = ["git", "-C", repo_path, "rev-parse", "--abbrev-ref", "HEAD"]
        branch = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()
        return branch
    except:
        return "master"

def get_first_commit_date(repo_path):
    """Fallback: Get the date of the very first commit in this repo."""
    try:
        # 'git rev-list --max-parents=0 HEAD' finds the root commit(s)
        cmd = ["git", "-C", repo_path, "rev-list", "--max-parents=0", "HEAD"]
        root_hash = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip().split('\n')[0]
        
        cmd_date = ["git", "-C", repo_path, "show", "-s", "--format=%ai", root_hash]
        date_str = subprocess.check_output(cmd_date, stderr=subprocess.DEVNULL).decode().strip().split()[0]
        return date_str
    except:
        return None

def get_repo_start_date(child_path, mother_path):
    if not os.path.exists(child_path):
        return None

    mother_branch = get_default_branch(mother_path)
    # Child branch doesn't matter as much, we compare HEAD
    
    try:
        # 1. Setup Remote
        subprocess.run(["git", "-C", child_path, "remote", "remove", "temp_mother"], stderr=subprocess.DEVNULL)
        subprocess.run(["git", "-C", child_path, "remote", "add", "temp_mother", mother_path], check=True, stderr=subprocess.DEVNULL)
        subprocess.run(["git", "-C", child_path, "fetch", "temp_mother"], check=True, stderr=subprocess.DEVNULL)

        # 2. Try to find split point against Mother's detected branch
        target_branch = f"temp_mother/{mother_branch}"
        cmd = ["git", "-C", child_path, "merge-base", "HEAD", target_branch]
        
        split_hash = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()

        # 3. Get Date
        cmd_date = ["git", "-C", child_path, "show", "-s", "--format=%ai", split_hash]
        date_str = subprocess.check_output(cmd_date).decode().strip().split()[0]
        
        # Cleanup
        subprocess.run(["git", "-C", child_path, "remote", "remove", "temp_mother"], stderr=subprocess.DEVNULL)
        return date_str

    except subprocess.CalledProcessError:
        # Cleanup even if failed
        subprocess.run(["git", "-C", child_path, "remote", "remove", "temp_mother"], stderr=subprocess.DEVNULL)
        
        # FALLBACK: Return first commit date instead of None
        # This fixes cases where the repo is standalone but the script thought it was a fork
        print(f"      (Merge-base failed, using First Commit Date)", end=" ")
        return get_first_commit_date(child_path)

    except Exception as e:
        print(f"      (Error: {e})", end=" ")
        return None

def main():
    print(f"🕵️  Analysing repos (Mother Branch: {get_default_branch(MOTHER_REPO)})...")
    
    config = {}
    config[MOTHER_REPO] = None

    for repo in CHILD_REPOS:
        repo_name = os.path.basename(repo)
        print(f"   - {repo_name}...", end=" ", flush=True)
        
        date = get_repo_start_date(repo, MOTHER_REPO)
        config[repo] = date
        
        if date:
            print(f"✅ Starts {date}")
        else:
            print(f"❌ Full History")

    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)

    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"\n✅ Config saved to {CONFIG_FILE}")
    print("👉 If any dates look wrong (e.g. too early), edit the JSON file manually!")

if __name__ == "__main__":
    main()