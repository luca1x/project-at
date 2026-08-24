import json
import os
import subprocess
import re
import sys
from collections import Counter
from datetime import datetime

import squash

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Assumes repo_config.json is in the parent directory
CONFIG_FILE = os.path.join(SCRIPT_DIR, "..", "config", "repo_config.json") 

# Filter config (Regex to match Author Name or Email)
AUTHOR_REGEX = r"brugnoni"

def load_config():
    """Parses the JSON config file into a python dictionary."""
    if not os.path.exists(CONFIG_FILE):
        print(f"❌ Error: Config file not found at: {CONFIG_FILE}")
        sys.exit(1)
        
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            print(f"✅ Loaded config for {len(config)} repositories from {os.path.basename(CONFIG_FILE)}")
            return {path: normalize_repo_options(value) for path, value in config.items()}
    except json.JSONDecodeError as e:
        print(f"❌ Error decoding JSON: {e}")
        sys.exit(1)

def normalize_repo_options(value):
    """Accepts either a bare start date or the full options dict (see parse.py)."""
    if isinstance(value, dict):
        return {
            "start_date": value.get("start_date"),
            "squash_merges": value.get("squash_merges", True),
        }
    return {"start_date": value, "squash_merges": True}

def collapse_to_work_units(repo_path, commits):
    """Collapses a non-squashing repo's commits down to one entry per PR.

    'shared' keeps every branch commit, so leaving it raw would inflate the
    commit total and skew every distribution below towards that one repo. We
    keep the newest matching commit of each merged branch as its representative
    (the stand-in for the squash commit) and fold the branch's line counts into
    it, so line totals stay untouched while the counts become comparable.
    """
    unit_of = {}
    for index, unit in enumerate(squash.get_work_units(repo_path)):
        for commit_hash in unit["hashes"]:
            unit_of[commit_hash] = index

    collapsed = {}
    loose = []
    for commit in commits:
        index = unit_of.get(commit['hash'])
        if index is None:
            # Not reachable from HEAD (e.g. sits on an unmerged branch)
            loose.append(commit)
            continue

        representative = collapsed.get(index)
        if representative is None:
            # git log walks newest first, so the first one we see is the newest
            collapsed[index] = dict(commit)
        else:
            representative['added'] += commit['added']
            representative['deleted'] += commit['deleted']

    return list(collapsed.values()) + loose

def get_commits_from_repo(repo_path, start_date):
    """
    Runs git log to get commit hash, date, message, author, and numstat.
    Filters commits based on AUTHOR_REGEX.
    """
    cwd = os.getcwd()
    try:
        # Resolve absolute path just in case
        abs_repo_path = os.path.abspath(repo_path)
        if not os.path.exists(abs_repo_path):
            print(f"  [!] Repo not found: {abs_repo_path}")
            return []
            
        os.chdir(abs_repo_path)
        
        # Git command
        cmd = [
            'git', 'log',
            f'--since={start_date}',
            # Full hash (%H), so it can be matched against squash.py's work units
            '--pretty=format:COMMIT_MARKER|%H|%aD|%an|%ae|%s',
            '--numstat'
        ]
        
        # Run git command
        result = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8', errors='ignore')
        
        parsed_commits = []
        current_commit = None
        
        # Pre-compile regex for performance
        auth_pattern = re.compile(AUTHOR_REGEX, re.IGNORECASE)

        for line in result.split('\n'):
            line = line.strip()
            if not line: continue

            if line.startswith('COMMIT_MARKER|'):
                # New commit line found
                parts = line.split('|', 5)
                if len(parts) < 6: continue
                
                _, h, date_str, author_name, author_email, msg = parts
                
                # --- AUTHOR CHECK ---
                if not (auth_pattern.search(author_name) or auth_pattern.search(author_email)):
                    current_commit = None
                    continue

                # Parse Day of Week
                try:
                    day_abbr = date_str.split(',')[0] # "Fri"
                    day_full = datetime.strptime(day_abbr, '%a').strftime('%A') 
                except:
                    day_full = "Unknown"

                current_commit = {
                    'hash': h,
                    'day': day_full,
                    'message': msg,
                    'added': 0,
                    'deleted': 0
                }
                parsed_commits.append(current_commit)
            
            elif current_commit:
                parts = line.split()
                if len(parts) >= 3:
                    add, rem = parts[0], parts[1]
                    if add != '-': current_commit['added'] += int(add)
                    if rem != '-': current_commit['deleted'] += int(rem)

        return parsed_commits

    except Exception as e:
        print(f"  [!] Error parsing repo {repo_path}: {e}")
        return []
    finally:
        os.chdir(cwd)

def analyze_data(all_commits):
    total_commits = len(all_commits)
    total_lines_added = sum(c['added'] for c in all_commits)
    total_lines_deleted = sum(c['deleted'] for c in all_commits)

    # 1. Most Productive Day
    day_counts = Counter(c['day'] for c in all_commits if c['day'] != 'Unknown')
    most_productive_day = day_counts.most_common(1)[0] if day_counts else ("Unknown", 0)

    # 2. Most Used Commit Message
    cleaned_messages = []
    for c in all_commits:
        msg = c['message']
        # Remove Jira prefixes (PROJ-123 / [PROJ-123]) and Conventional Commits (feat:)
        msg = re.sub(r'^\[[A-Za-z]+-\d+\][:\s-]*', '', msg) # Remove [PROJ-123]
        msg = re.sub(r'^[A-Za-z]+-\d+[:\s-]*', '', msg)     # Remove PROJ-123
        msg = re.sub(r'^[a-z]+(\([a-z0-9-]+\))?[:\s-]*', '', msg) # Remove feat:
        
        cleaned_msg = msg.strip().lower()
        if cleaned_msg: 
            cleaned_messages.append(cleaned_msg)
            
    most_used_msg = Counter(cleaned_messages).most_common(1)[0] if cleaned_messages else ("none", 0)

    # 3. Commit Types / Teams (Prefix Extraction)
    team_counts = Counter()
    for c in all_commits:
        msg = c['message']
        prefix = "Unknown"
        
        # 3a. Bracketed Jira-style: "[aud-3772] msg" or "[AUD-3772]"
        # Changed [A-Z] to [A-Za-z] to support lowercase
        bracket_match = re.match(r'^\[([A-Za-z]+)-\d+\]', msg)
        if bracket_match:
            prefix = bracket_match.group(1).upper() # Normalize to AUD
        else:
            # 3b. Standard Jira-style: "aud-3772: msg"
            # Changed [A-Z] to [A-Za-z]
            jira_match = re.match(r'^([A-Za-z]+)-\d+', msg)
            if jira_match:
                prefix = jira_match.group(1).upper() # Normalize to AUD
            else:
                # 3c. Simple prefix: "feat: msg"
                simple_match = re.match(r'^([A-Za-z]+):', msg)
                if simple_match:
                    prefix = simple_match.group(1).upper() # Normalize to FEAT
        
        team_counts[prefix] += 1
        
    top_teams = dict(team_counts.most_common(15))

    return {
        "total_commits": total_commits,
        "lines_added": total_lines_added,
        "lines_deleted": total_lines_deleted,
        "most_productive_day": most_productive_day[0],
        "most_used_message": most_used_msg[0],
        "teams": top_teams
    }

def main():
    print("--- 🚀 STARTING TRIVIA EXTRACTION ---")
    print(f"🔎 Filtering for authors matching: '{AUTHOR_REGEX}'")
    
    repos = load_config()
    all_commits = []

    # Iterate over the config {path: options}
    for repo_path, options in repos.items():
        name = os.path.basename(repo_path)

        start_date = options["start_date"] or '2012-01-01'

        print(f"Processing {name}...")
        repo_commits = get_commits_from_repo(repo_path, start_date)

        if not options["squash_merges"] and repo_commits:
            raw = len(repo_commits)
            repo_commits = collapse_to_work_units(repo_path, repo_commits)
            print(f"  -> Collapsed {raw} commits into {len(repo_commits)} work units.")
        else:
            print(f"  -> Found {len(repo_commits)} matching commits.")

        all_commits.extend(repo_commits)

    if not all_commits:
        print("\n⚠️ No commits found. Check paths, dates, or AUTHOR_REGEX.")
        sys.exit(0)

    print("\n--- 📊 ANALYZING DATA ---")
    stats = analyze_data(all_commits)

    print("\n--- ✅ RESULTS ---")
    print(json.dumps(stats, indent=4))
    
    print("\n--- COPY/PASTE BLOCK FOR D3.TS ---")
    
    def format_num(n):
        if n >= 1000000: return f"{n/1000000:.1f}M+"
        if n >= 1000: return f"{n/1000:.0f}K"
        return str(n)

    print(f"""
const STATS = [
    {{ label: "Total Commits", value: "{stats['total_commits']:,}" }},
    {{ label: "Coffees", value: "≈ {int(stats['total_commits'] * 0.6):,}" }},
    {{ label: "Lines Added", value: "{format_num(stats['lines_added'])}", color: "#daf6e6" }}, 
    {{ label: "Lines Deleted", value: "{format_num(stats['lines_deleted'])}", color: "#ffdcd8" }}
];

const TRIVIA = [
    {{ question: "Most Productive Day", answer: "{stats['most_productive_day']}" }},
    {{ question: "Most Used Commit Msg", answer: "'{stats['most_used_message']}'" }},
    {{ question: "Most \\"Productive\\" Year", answer: "2020" }}, 
    {{ question: "Cereal Bowls Consumed", answer: "≈ 2,400" }},
    {{ question: "Mentored / Inspired", answer: "18 Devs" }},
];

// Top 6 Teams/Prefixes
const TEAM_DATA = [""")
    
    colors = ["#00f2c3", "#00d2ff", "#bdc3c7", "#8e44ad", "#ff4757", "#ffa502", "#E63946", "#A8DADC"]
    sorted_teams = sorted(stats['teams'].items(), key=lambda x: x[1], reverse=True)
    
    for i, (team, count) in enumerate(sorted_teams[:6]):
        color = colors[i % len(colors)]
        print(f'    {{ id: "{team}", value: {count}, color: "{color}" }},')
        
    print("];")

if __name__ == "__main__":
    main()