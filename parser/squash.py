import re
import subprocess

# --- WHY THIS MODULE EXISTS ---
# Most of our repos squash-merge, so one PR lands as exactly one commit on the
# mainline. The "shared" repo does NOT squash: every commit of a branch is kept,
# so a single PR can land as 20+ commits. Counting raw commits therefore
# massively over-represents that repo against all the others.
#
# This module rebuilds what the history WOULD have looked like under
# squash-merging: we walk the mainline (first-parent chain) and collapse each
# merge together with the commits it introduced into a single "work unit".
#
# Note we deliberately do NOT just use `git log --first-parent`. On a
# merge-based repo the PR merge commit is authored by whoever clicked the merge
# button, not by whoever wrote the branch, so first-parent alone loses the
# attribution we are filtering on.

# Merges that are release plumbing rather than actual work. These carry commits
# back and forth between master/develop and would otherwise be counted a second
# time, on top of the feature PR that originally introduced them.
DEFAULT_PLUMBING_REGEX = r"master-to-develop|/release/|Merge branch '[^']+' into|from \S+/(develop|master|main)$"

# Same fields parse.py greps for, so the matching semantics stay identical:
# %an = Author Name, %ae = Author Email, %cn/%ce = Committer, %b = Body
_SEP = "%x1e"
_FMT = _SEP.join(["%H", "%P", "%ai", "%an", "%ae", "%cn", "%ce", "%s", "%b"]) + "%x00"


def _load_graph(repo_path):
    """Reads the FULL commit graph (hash, parents, date, identity, message).

    We cannot apply --since here: to collapse a merge we need its ancestors, and
    a date filter would cut the graph out from under us. Date filtering happens
    afterwards, on the resulting work units.
    """
    cmd = ["git", "-C", repo_path, "log", "HEAD", f"--format={_FMT}", "--no-decorate"]
    process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        text=True, errors="ignore"
    )
    raw_output, _ = process.communicate()

    commits = {}
    for record in raw_output.split("\0"):
        if not record.strip():
            continue
        # git separates records with our null byte but also emits a newline
        fields = record.lstrip("\n").split("\x1e")
        if len(fields) < 9:
            continue

        commit_hash, parents, date, an, ae, cn, ce, subject, body = fields
        commits[commit_hash] = {
            "parents": parents.split(),
            "date": date.split()[0] if date.split() else "",
            "subject": subject,
            # The searchable blob: identical field set to parse.py's greedy check
            "blob": f"{an} {ae} {cn} {ce} {body}",
        }
    return commits


def _mainline(commits, head):
    """The first-parent chain, i.e. the commits that actually landed on HEAD."""
    chain = []
    current = head
    while current in commits:
        chain.append(current)
        parents = commits[current]["parents"]
        current = parents[0] if parents else None
    return chain


def get_work_units(repo_path, plumbing_regex=DEFAULT_PLUMBING_REGEX):
    """Collapses a merge-based history into squash-merge-equivalent work units.

    Returns a list of dicts (oldest first), one per unit:
      date     - when the unit landed on the mainline (YYYY-MM-DD)
      blob     - concatenated searchable text of every commit in the unit
      subject  - the mainline commit's subject
      size     - how many commits were collapsed into this unit
      hashes   - every commit hash that this unit swallowed
      plumbing - True if this looks like a release back-merge, not real work
    """
    commits = _load_graph(repo_path)
    if not commits:
        return []

    head = subprocess.run(
        ["git", "-C", repo_path, "rev-parse", "HEAD"],
        capture_output=True, text=True
    ).stdout.strip()

    mainline = _mainline(commits, head)
    plumbing = re.compile(plumbing_regex, re.IGNORECASE)

    # Every mainline commit is already accounted for by the mainline itself.
    claimed = set(mainline)
    units = []

    # Oldest to newest, so a feature PR claims its own commits before any later
    # release merge can drag them back in.
    for commit_hash in reversed(mainline):
        commit = commits[commit_hash]
        blobs = [commit["blob"]]
        hashes = [commit_hash]
        size = 1

        if len(commit["parents"]) > 1:
            # Walk everything reachable from the merged-in parents that no
            # earlier unit has claimed. That set is exactly what this merge
            # introduced to the mainline - i.e. the PR's contents.
            stack = []
            for parent in commit["parents"][1:]:
                if parent not in claimed and parent in commits:
                    claimed.add(parent)
                    stack.append(parent)

            introduced = 0
            while stack:
                current = stack.pop()
                introduced += 1
                blobs.append(commits[current]["blob"])
                hashes.append(current)
                for parent in commits[current]["parents"]:
                    if parent not in claimed and parent in commits:
                        claimed.add(parent)
                        stack.append(parent)

            # A merge that introduced nothing new is pure bookkeeping.
            if introduced == 0:
                continue
            size = introduced

        units.append({
            "date": commit["date"],
            "blob": "\n".join(blobs),
            "subject": commit["subject"],
            "size": size,
            "hashes": hashes,
            "plumbing": bool(plumbing.search(commit["subject"])),
        })

    return units
