import os
import subprocess
import json
import re
from datetime import datetime
from collections import defaultdict

# --- CONFIGURATION ---
# 1. Add the full paths to the local repositories here
REPO_PATHS = [
    "/Users/lucatl/production-tagger",
    "/Users/lucatl/production-frontend",
    "/Users/lucatl/production",
    "/Users/lucatl/profile-api",
    "/Users/lucatl/infrastructure",
    "/Users/lucatl/profile-db",
    "/Users/lucatl/connect",
    "/Users/lucatl/shared",
    "/Users/lucatl/inference",
    "/Users/lucatl/monitoring-utils",
    "/Users/lucatl/audience-export",
    "/Users/lucatl/items",
    "/Users/lucatl/python-lib",
    "/Users/lucatl/aggregation",
    "/Users/lucatl/utils",
    "/Users/lucatl/audience-export"
]

# 2. Author matching (Regex is supported)
# Matches "andreas" OR "tschofen" (case insensitive)
AUTHOR_REGEX = "andreas|tschofen"

# 3. Output file name
OUTPUT_FILE = "../data/streamgraph_data.json"

def get_commits_per_month(repo_path, author_pattern):
    if not os.path.exists(repo_path):
        print(f"Warning: Path not found: {repo_path}")
        return {}

    repo_name = os.path.basename(os.path.normpath(repo_path))
    print(f"Processing {repo_name}...")

    cmd = [
        "git", "-C", repo_path, "log",
        "--format=%ai|%an %ae", 
        "--all"
    ]

    monthly_counts = defaultdict(int)
    pattern = re.compile(author_pattern, re.IGNORECASE)

    # USE POPEN instead of check_output for streaming
    process = subprocess.Popen(
        cmd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT,
        text=True,       # Handles decoding automatically
        errors='ignore'  # Ignores weird characters
    )

    # Iterate line by line as they come in
    for line in process.stdout:
        try:
            parts = line.split("|", 1)
            if len(parts) < 2: continue
                
            date_part = parts[0]
            author_info = parts[1]

            if pattern.search(author_info):
                date_str = date_part.split()[0]
                year_month = date_str[:7]
                monthly_counts[year_month] += 1
        except Exception:
            continue
            
    return monthly_counts

def main():
    all_data = {}
    all_months = set()
    repo_names = []

    # 1. Collect data
    for path in REPO_PATHS:
        repo_name = os.path.basename(os.path.normpath(path))
        repo_names.append(repo_name)
        
        counts = get_commits_per_month(path, AUTHOR_REGEX)
        all_data[repo_name] = counts
        all_months.update(counts.keys())

    # 2. Sort months to ensure timeline is correct
    if not all_months:
        print("No commits found matching that author!")
        return
        
    sorted_months = sorted(list(all_months))
    
    # 3. Build the "Wide" JSON structure for D3
    # Format: [ { "date": "2012-01", "repoA": 5, "repoB": 0 }, ... ]
    d3_data = []
    
    for month in sorted_months:
        entry = {"date": month}
        for repo in repo_names:
            # If no commits that month, default to 0 (Crucial for Streamgraphs)
            entry[repo] = all_data[repo].get(month, 0)
        d3_data.append(entry)

    # 4. Save to JSON
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(d3_data, f, indent=2)

    print(f"\nSuccess! Data saved to {OUTPUT_FILE}")
    print(f"Found history from {sorted_months[0]} to {sorted_months[-1]}")

if __name__ == "__main__":
    main()