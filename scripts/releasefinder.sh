#!/bin/bash

# This script finds which Grafana releases include a specific commit.
# It checks both release branches and tags to determine:
# 1. Which previous releases include the commit
# 2. Which upcoming releases will include the commit
# 3. The first release that included the commit
#
# Usage: ./scripts/releasefinder.sh <commit-hash>
# The commit hash can be either:
# - Full hash (e.g., 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t)
# - Short hash (e.g., 1a2b3c4d)
#
# Example: ./scripts/releasefinder.sh a1b2c3d4e5f6
#
# Note: This script requires a full repository clone with all branches and tags.
# It will not work correctly with shallow clones (--depth) or single-branch clones.
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

echo "Finding releases containing commit: $COMMIT_HASH"
echo "============================================="
echo

# Get all commit details in one call for better performance
commit_info=$(git log -1 --format="%an <%ae>%n%ad%n%B" --date=iso "$COMMIT_HASH")
author=$(echo "$commit_info" | sed -n '1p')
date=$(echo "$commit_info" | sed -n '2p')
commit_message=$(echo "$commit_info" | sed -n '3,$p')

echo "Commit details:"
echo "  Author: $author"
echo "  Date: $date"

# Extract PR number and title
PR_NUMBER=$(echo "$commit_message" | grep -o '#[0-9]\+' | head -n1 | tr -d '#')
if [ -n "$PR_NUMBER" ]; then
    PR_TITLE=$(echo "$commit_message" | head -n1)
    echo "  PR: #$PR_NUMBER - $PR_TITLE"
    echo "  Link: https://github.com/grafana/grafana/pull/$PR_NUMBER"
fi
echo

# Find release branches and tags containing the commit
release_branches=$(git branch -r --contains "$COMMIT_HASH" 2>/dev/null | grep -E 'origin/release-[0-9]+\.[0-9]+\.[0-9]+(\+security-[0-9]{2})?$' | sed 's/.*origin\///')
release_tags=$(git tag --contains "$COMMIT_HASH" 2>/dev/null | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+(\+security-[0-9]{2})?$' | sort -V)

# Get all existing tags for upcoming release filtering
all_tags=$(git tag 2>/dev/null | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+(\+security-[0-9]{2})?$')

# Display previous releases
if [ -n "$release_tags" ]; then
    echo "This commit has been included in these PREVIOUS on-prem releases:"
    first_release=$(echo "$release_tags" | head -1)
    while read -r tag; do
        if [ "$tag" = "$first_release" ]; then
            echo "  - $tag (first release)"
        else
            echo "  - $tag"
        fi
    done <<< "$release_tags"
    echo
    echo "Note: This code may have been backported to previous release branches. Please check the original PR for backport information."
    echo
fi

# Display upcoming releases
if [ -n "$release_branches" ]; then
    echo "This commit will be included in these UPCOMING on-prem releases:"
    while read -r branch; do
        tag_version="v${branch#release-}"
        # Only show branches that don't have a corresponding tag yet
        if ! echo "$all_tags" | grep -q "^$tag_version$"; then
            echo "  - $tag_version"
        fi
    done <<< "$release_branches" | sort -V
else
    echo "This commit is not yet included in any release branches."
    echo "The corresponding release branch has likely not been created yet."
fi
echo
