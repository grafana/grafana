#!/usr/bin/env bash

# abort if we get any error
set -e

_tag=$1
_branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "${_tag}" == "" ]; then
    echo "Missing version param. ex './scripts/tag_release.sh v5.1.1'"
    exit 1
fi

if [ "${_branch}" == "master" ]; then
    echo "you cannot tag releases from the master branch"
    echo "please checkout the release branch"
    echo "ex 'git checkout v5.1.x'"
    exit 1
fi

# always make sure to pull latest changes from origin
echo "pulling latest changes from ${_branch}"
git pull origin "${_branch}"

# create signed tag for latest commit
git tag -s "${_tag}" -m "release ${_tag}"

# verify the signed tag
git tag -v "${_tag}"

echo "Make sure the tag is signed as expected"
echo "press [y] to push the tags"

read -n 1 confirm

if [ "${confirm}" == "y" ]; then
    git push origin "${_branch}" --tags
else
    git tag -d "${_tag}"
    echo "Abort! "
fi
