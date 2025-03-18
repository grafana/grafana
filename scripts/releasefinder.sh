#!/bin/bash

# Check if a commit hash was provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <commit-hash>"
    echo "Example: $0 a1b2c3d4e5f6"
    exit 1
fi

COMMIT_HASH=$1

# Validate that the commit exists
if ! git cat-file -t "$COMMIT_HASH" >/dev/null 2>&1; then
    echo "Error: Commit $COMMIT_HASH not found in repository"
    exit 1
fi

echo "Fetching latest remote information..."
git fetch --all --tags --prune

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
        if git rev-parse "$tag" == "$COMMIT_HASH" 2>/dev/null; then
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
