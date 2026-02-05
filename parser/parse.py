import os
import subprocess
import json
import re
from datetime import datetime
from collections import defaultdict

# --- CONFIGURATION ---
# 1. Add the full paths to the local repositories here
REPO_CONFIG = {
    "/Users/lucatl/production-tagger": None,
    "/Users/lucatl/production-front-end": None,
    "/Users/lucatl/production": None,
    "/Users/lucatl/profile-api": None,
    "/Users/lucatl/infrastructure": None,
    "/Users/lucatl/profile-db": None,
    "/Users/lucatl/advertiser-connect": None,
    "/Users/lucatl/shared": None,
    "/Users/lucatl/inference": None,
    "/Users/lucatl/monitoring-utils": None,
    "/Users/lucatl/audience-export": None,
    "/Users/lucatl/items": None,
    "/Users/lucatl/python-lib": None,
    "/Users/lucatl/aggregation": None,
    "/Users/lucatl/utils": None,
    "/Users/lucatl/audience-export": None,
    "/Users/lucatl/measurement-matching": None,
    "/Users/lucatl/segment-api": None,
    "/Users/lucatl/experience": None
}

# Case-insensitive regex for the author
AUTHOR_REGEX = "andreas|tschofen|atschofen" 
OUTPUT_FILE = "streamgraph_data.json"

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
        "git", "-C", repo_path, "log",
        "--format=%ai|%an %ae %cn %ce %b%x00", 
        "--all"
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
    all_data = {}
    all_months = set()
    repo_names = []

    print(f"Scanning {len(REPO_CONFIG)} repositories for '{AUTHOR_REGEX}'...")

    # Iterate through the dictionary items (path, date)
    for path, start_date in REPO_CONFIG.items():
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

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(d3_data, f, indent=2)

    print(f"\nSuccess! Data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
