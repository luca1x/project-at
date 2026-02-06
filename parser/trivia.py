import json
import os
import subprocess
import re
import sys
from collections import Counter
from datetime import datetime

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Assumes repo_config.json is in the parent directory (or use ../config/repo_config.json)
CONFIG_FILE = os.path.join(SCRIPT_DIR, "..", "config", "repo_config.json") 

def load_config():
    """Parses the JSON config file into a python dictionary."""
    if not os.path.exists(CONFIG_FILE):
        print(f"❌ Error: Config file not found at: {CONFIG_FILE}")
        sys.exit(1)
        
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            print(f"✅ Loaded config for {len(config)} repositories from {os.path.basename(CONFIG_FILE)}")
            return config
    except json.JSONDecodeError as e:
        print(f"❌ Error decoding JSON: {e}")
        sys.exit(1)

def get_commits_from_repo(repo_path, start_date):
    """
    Runs git log to get commit hash, date, message, and numstat (lines added/deleted).
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
            '--pretty=format:COMMIT_MARKER|%h|%aD|%s',
            '--numstat'
        ]
        
        # Run git command
        result = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8', errors='ignore')
        
        parsed_commits = []
        current_commit = None

        for line in result.split('\n'):
            line = line.strip()
            if not line: continue

            if line.startswith('COMMIT_MARKER|'):
                # New commit starts
                parts = line.split('|', 3)
                if len(parts) < 4: continue
                
                _, h, date_str, msg = parts
                
                # Parse Day of Week
                try:
                    day_abbr = date_str.split(',')[0] # "Fri"
                    day_full = datetime.strptime(day_abbr, '%a').strftime('%A') 
                except:
                    day_full = "Unknown"

                current_commit = {
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
        # Remove Jira prefixes (PROJ-123) and Conventional Commits (feat:)
        msg = re.sub(r'^[A-Za-z]+-\d+[:\s-]*', '', msg)
        msg = re.sub(r'^[a-z]+(\([a-z0-9-]+\))?[:\s-]*', '', msg)
        cleaned_msg = msg.strip().lower()
        if cleaned_msg: 
            cleaned_messages.append(cleaned_msg)
            
    most_used_msg = Counter(cleaned_messages).most_common(1)[0] if cleaned_messages else ("none", 0)

    # 3. Commit Types / Teams (Prefix Extraction)
    team_counts = Counter()
    for c in all_commits:
        msg = c['message']
        prefix = "Unknown"
        
        # Jira-style (UPPER-123)
        jira_match = re.match(r'^([A-Z]+)-\d+', msg)
        if jira_match:
            prefix = jira_match.group(1)
        else:
            # Simple prefix (feat:)
            simple_match = re.match(r'^([A-Za-z]+):', msg)
            if simple_match:
                prefix = simple_match.group(1)
        
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
    repos = load_config()
    all_commits = []

    # --- UPDATED LOOP FOR FLAT DICTIONARY ---
    # Structure: { "/path/to/repo": "YYYY-MM-DD", ... }
    for repo_path, start_date in repos.items():
        name = os.path.basename(repo_path) # Extract folder name (e.g. 'production')
        
        # Handle null dates (default to early date)
        if not start_date:
            start_date = '2012-01-01'
        
        print(f"Processing {name}...")
        repo_commits = get_commits_from_repo(repo_path, start_date)
        print(f"  -> Found {len(repo_commits)} commits.")
        all_commits.extend(repo_commits)

    if not all_commits:
        print("\n⚠️ No commits found in any repositories. Check paths and start dates.")
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
    {{ question: "Longest Streak", answer: "42 Days" }},
    {{ question: "Least Productive Year", answer: "2018" }},
    {{ question: "Cereal Bowls Consumed", answer: "≈ 2,400" }},
    {{ question: "Mentored / Inspired", answer: "14 Devs" }},
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