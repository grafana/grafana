#!/bin/bash

# This script finds which Grafana releases include a specific commit.
# It checks both release branches and tags to determine:
# 1. Which release branches contain the commit
# 2. The first release tag that included the commit
# 3. Which release tags include the commit
# 4. The first release that included the commit
#
# Usage: ./scripts/releasefinder.sh <commit-hash>
# The commit hash can be either:
# - Full hash (e.g., 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t)
# - Short hash (e.g., 1a2b3c4d)
#
# Example: ./scripts/releasefinder.sh a1b2c3d4e5f6
#
# If you get a "Permission denied" error, make the script executable with:
#   chmod +x scripts/releasefinder.sh

# Check if script is executable
if [ ! -x "$0" ]; then
    echo "Error: This script is not executable."
    echo "To fix this, run: chmod +x $0"
    echo "Then try running the script again."
    exit 1
fi

# Check if a commit hash was provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <commit-hash>"
    echo "The commit hash can be either:"
    echo "  - Full hash (e.g., 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t)"
    echo "  - Short hash (e.g., 1a2b3c4d)"
    echo "Example: $0 a1b2c3d4e5f6"
    exit 1
fi

COMMIT_HASH=$1

# Validate that the commit exists
if ! git cat-file -t "$COMMIT_HASH" >/dev/null 2>&1; then
    echo "Error: Commit $COMMIT_HASH not found in repository"
    echo "Make sure you've provided a valid commit hash (full or short)"
    exit 1
fi

echo "Fetching latest remote information..."
git fetch --all --tags --prune 2>/dev/null

echo "Finding release branches containing the commit..."
echo "Finding tags associated with the commit..."
echo

echo "Results for commit: $COMMIT_HASH"
echo "============================================="
echo

# Get commit details
echo "Commit details:"
echo "  Author: $(git log -1 --format="%an <%ae>" "$COMMIT_HASH")"
echo "  Date: $(git log -1 --format="%ad" --date=iso "$COMMIT_HASH")"
echo

# Check for backport information
echo "Backport information:"
if git log -1 --pretty=format:"%B" "$COMMIT_HASH" | grep -q "cherry picked from commit"; then
    ORIGINAL_COMMIT=$(git log -1 --pretty=format:"%B" "$COMMIT_HASH" | grep "cherry picked from commit" | sed 's/.*cherry picked from commit \([a-f0-9]*\).*/\1/')
    echo "  This is a backport from commit: $ORIGINAL_COMMIT"
    echo "  Original commit details:"
    echo "    Author: $(git log -1 --format="%an <%ae>" "$ORIGINAL_COMMIT")"
    echo "    Date: $(git log -1 --format="%ad" --date=iso "$ORIGINAL_COMMIT")"
else
    echo "  Not a backport"
fi
echo

# Arrays to store results
declare -a release_branches=()
declare -a direct_tags=()
declare -a included_tags=()

# First check all release branches (including security releases)
for branch in $(git branch -r | grep -E 'origin/release-[0-9]+\.[0-9]+\.[0-9]+(\+security-[0-9]{2})?$' | sed 's/origin\///'); do
    # Check if the commit is in this branch's history
    if git merge-base --is-ancestor "$COMMIT_HASH" "origin/$branch" 2>/dev/null; then
        release_branches+=("$branch")
    fi
done

# Then check all version tags (including security releases)
for tag in $(git tag | sort -V); do
    # Skip non-version tags
    if ! [[ $tag =~ ^v[0-9]+\.[0-9]+\.[0-9]+(\+security-[0-9]{2})?$ ]]; then
        continue
    fi
    
    # Check if the commit is in this tag
    if git merge-base --is-ancestor "$COMMIT_HASH" "$tag" 2>/dev/null; then
        # If this is the first tag containing the commit, it's the initial release tag
        if [ ${#direct_tags[@]} -eq 0 ]; then
            direct_tags+=("$tag")
        else
            included_tags+=("$tag")
        fi
    fi
done

# Print release branches
echo "Included in release branches:"
if [ ${#release_branches[@]} -eq 0 ]; then
    echo "  None"
else
    for branch in "${release_branches[@]}"; do
        # Convert branch name to tag format (e.g., release-11.5.0 -> v11.5.0)
        tag_version="v${branch#release-}"
        # Check if tag exists
        if git tag | grep -q "^$tag_version$"; then
            echo "  - $branch"
        else
            echo "  - $branch (release for this branch upcoming)"
        fi
    done | sort -V
fi
echo

# Print initial release tag
echo "Initial release tag (the first release in which this commit was included):"
if [ ${#direct_tags[@]} -eq 0 ]; then
    echo "  None"
else
    printf "  - %s\n" "${direct_tags[@]}" | sort -V
fi
echo

# Print included tags
echo "Included in these release tags (the subsequent releases that included this commit):"
if [ ${#included_tags[@]} -eq 0 ]; then
    echo "  None"
else
    printf "  - %s\n" "${included_tags[@]}" | sort -V
fi
echo

# Find first release
if [ ${#direct_tags[@]} -gt 0 ]; then
    first_release=$(printf "%s\n" "${direct_tags[@]}" | sort -V | head -n1)
    echo "First included in release: $first_release"
else
    echo "Not included in any releases"
fi 
