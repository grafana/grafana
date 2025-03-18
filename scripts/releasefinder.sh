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

echo "Finding releases for commit $COMMIT_HASH..."
echo

# Get all version tags that contain the commit
echo "Checking version tags..."
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
            echo "Found in release:"
            echo "  Tag:   $tag"
            echo "  Branch: $release_branch"
            echo
        fi
    fi
done

# If no releases were found
if [ $? -ne 0 ]; then
    echo "No releases found containing the specified commit"
fi 
