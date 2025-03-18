#!/bin/bash

# This script finds which Grafana releases include a specific commit.
# It checks both release branches and tags to determine:
# 1. Which release branches contain the commit
# 2. If the commit is directly tagged with a release version
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

# Arrays to store results
declare -a release_branches=()
declare -a direct_tags=()
declare -a included_tags=()

# Get all version tags that contain the commit
for tag in $(git tag); do
    # Skip non-version tags
    if ! [[ $tag =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        continue
    fi
    
    # Check if the commit is in this tag
    if git merge-base --is-ancestor "$COMMIT_HASH" "$tag" 2>/dev/null; then
        # Check if there's a matching release branch in origin
        release_branch="release-${tag#v}"
        if git show-ref --verify --quiet "refs/remotes/origin/$release_branch" 2>/dev/null; then
            release_branches+=("${tag#v}")
        fi
        
        # Check if this is a direct tag on the commit
        tag_commit=$(git rev-parse "$tag")
        if [ "$tag_commit" = "$COMMIT_HASH" ]; then
            direct_tags+=("${tag#v}")
        else
            included_tags+=("${tag#v}")
        fi
    fi
done

# Print release branches
echo "Included in release branches:"
if [ ${#release_branches[@]} -eq 0 ]; then
    echo "  None"
else
    printf "  - %s\n" "${release_branches[@]}" | sort -V
fi
echo

# Print direct tags
echo "Directly tagged with:"
if [ ${#direct_tags[@]} -eq 0 ]; then
    echo "  None"
else
    printf "  - %s\n" "${direct_tags[@]}" | sort -V
fi
echo

# Print included tags
echo "Included in these release tags:"
if [ ${#included_tags[@]} -eq 0 ]; then
    echo "  None"
else
    printf "  - %s\n" "${included_tags[@]}" | sort -V
fi
echo

# Find first release
if [ ${#release_branches[@]} -gt 0 ]; then
    first_release=$(printf "%s\n" "${release_branches[@]}" | sort -V | head -n1)
    echo "First included in release: $first_release"
else
    echo "Not included in any releases"
fi 
