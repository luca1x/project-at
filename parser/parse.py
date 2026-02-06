import os
import subprocess
import json
import re
from datetime import datetime
from collections import defaultdict

# --- CONFIGURATION ---
# Case-insensitive regex for the author
AUTHOR_REGEX = "tschofen|atschofen" 

# --- PATH SETUP ---
# 1. Get the absolute path of the folder containing this script (e.g. /.../project/parser)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Pointing to <project>/config/repo_config.json
CONFIG_FILE = os.path.join(SCRIPT_DIR, "..", "config", "repo_config.json")

# 2. Construct the path to the output file relative to the script
#    We go up one level ("..") to the project root, then into "data"
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "..", "data", "streamgraph_data.json")

# 3. Clean up the path (resolves the "..") so it looks nice
OUTPUT_FILE = os.path.normpath(OUTPUT_FILE)
OUTPUT_FILE = os.path.normpath(OUTPUT_FILE)

def load_config():
    """Parses the JSON config file into a python dictionary."""
    if not os.path.exists(CONFIG_FILE):
        print(f"❌ Error: Config file not found at: {CONFIG_FILE}")
        print("   Run 'make dates' first to generate it.")
        sys.exit(1)
        
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            print(f"✅ Loaded config for {len(config)} repositories from {os.path.basename(CONFIG_FILE)}")
            return config
    except json.JSONDecodeError as e:
        print(f"❌ Error decoding JSON: {e}")
        sys.exit(1)

def get_contributions_per_month(repo_path, author_pattern, start_date=None):
    
    if not os.path.exists(repo_path):
        print(f"Warning: Path not found: {repo_path}")
        return {}

    repo_name = os.path.basename(os.path.normpath(repo_path))
    print(f"Processing {repo_name}...", end=" ")

    # We fetch the raw commit data including:
    # %ai = Date
    # %an = Author Name
    # %ae = Author Email
    # %cn = Committer Name (often different from author in PRs)
    # %ce = Committer Email
    # %b  = Body (messages, co-authored-by, signed-off-by, etc.)
    # %x00 = Null byte separator
    cmd = [
        "git", "-C", repo_path, "log", "HEAD", 
        "--format=%ai|%an %ae %cn %ce %b%x00", 
        "--no-decorate"
    ]

    if start_date:
        cmd.append(f"--since={start_date}")

    monthly_counts = defaultdict(int)
    pattern = re.compile(author_pattern, re.IGNORECASE)

    try:
        # Run git command
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT,
            text=True,
            errors='ignore'
        )
        
        # Read entire output
        raw_output, _ = process.communicate()
        
        # Split by null byte to isolate each commit
        commits = raw_output.split('\0')

        for commit in commits:
            if not commit.strip(): continue
            
            # Split Date from the Content
            # content_part will contain Author, Committer, Emails, AND Body
            parts = commit.split("|", 1)
            if len(parts) < 2: continue
            
            date_part = parts[0]
            content_part = parts[1]

            # THE GREEDY CHECK:
            # We search the ENTIRE string (headers + body).
            # If his name appears anywhere, it counts.
            if pattern.search(content_part):
                date_str = date_part.split()[0][:7] # Extract YYYY-MM
                monthly_counts[date_str] += 1

    except Exception as e:
        print(f"Error: {e}")
        return {}
            
    return monthly_counts

def main():
    repo_config = load_config()

    all_data = {}
    all_months = set()
    repo_names = []

    print(f"Scanning {len(repo_config)} repositories for '{AUTHOR_REGEX}'...")

    # Iterate through the dictionary items (path, date)
    for path, start_date in repo_config.items():
        repo_name = os.path.basename(os.path.normpath(path))
        repo_names.append(repo_name)
        
        counts = get_contributions_per_month(path, AUTHOR_REGEX, start_date)
        
        total_found = sum(counts.values())
        print(f"  -> Found {total_found} commits.")
        
        all_data[repo_name] = counts
        all_months.update(counts.keys())

    if not all_months:
        print("\nERROR: No commits found matching that author.")
        return
        
    sorted_months = sorted(list(all_months))
    
    # Build Wide Format Data
    d3_data = []
    for month in sorted_months:
        entry = {"date": month}
        for repo in repo_names:
            entry[repo] = all_data[repo].get(month, 0)
        d3_data.append(entry)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(d3_data, f, indent=2)

    print(f"\nSuccess! Data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
