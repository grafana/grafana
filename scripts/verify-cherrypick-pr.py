#!/usr/bin/env python3
"""Script to verify a cherry-pick PR for a certain version

The verification is done by comparing commits included in the PR against
merged PRs targeting corresponding milestone and with "cherry-pick needed" label.
"""
from github import Github
from github.Milestone import Milestone
from github.Label import Label
import sys
import re


def _get_milestone(repo, title):
    for milestone in repo.get_milestones(state='all'):
        if milestone.title == title:
            return milestone

    raise Exception('Milestone not found')

def _get_label(repo):
    for label in repo.get_labels():
        if label.name == 'cherry-pick needed':
            return label

    raise Error('Label not found')


def _main():
    try:
        version, pr_id, token = sys.argv[1:]
    except ValueError:
        sys.stderr.write(
            'Please provide the version, the cherry-pick PR ID and a valid GitHub access token\n'
        )
        sys.exit(1)
    pr_id = int(pr_id)

    g = Github(token)
    repo = g.get_repo('grafana/grafana')

    milestone = _get_milestone(repo, version)
    label = _get_label(repo)

    pr_commits = {}
    for issue in repo.get_issues(state='closed', milestone=milestone, labels=[label]):
        if issue.pull_request is None:
            continue

        pr = repo.get_pull(issue.number)
        print('Got PR #{} ({})'.format(issue.number, issue.title))
        assert pr.merge_commit_sha
        pr_commits[pr.merge_commit_sha] = pr
    print('Found {} PRs'.format(len(pr_commits)))

    re_cherry = re.compile('cherry picked from commit ([0-9a-f]+)')

    cherrypick_pr = repo.get_pull(pr_id)
    num_commits = 0
    commits_lacking_source = []
    uncorrelated_commits = []
    for commit in cherrypick_pr.get_commits():
        num_commits += 1
        # Correlate commit with PR commits
        m = re_cherry.search(commit.commit.message)
        if m is None:
            commits_lacking_source.append(commit)
            continue

        source_sha = m.group(1)

        # Find cherry-picked commit among PRs
        for pr_sha in pr_commits.keys():
            if pr_sha[:len(source_sha)] == source_sha:
                corr_pr = pr_commits.pop(pr_sha)
                break
        else:
            uncorrelated_commits.append(source_sha)
            continue

        print('* Found corresponding PR #{} ({})'.format(corr_pr.number, corr_pr.title))

    print('* Cherrypick PR has {} commits'.format(num_commits))

    for commit in commits_lacking_source:
        sys.stderr.write('* Couldn\'t determine cherry-picked commit from message of {}\n'.format(
            commit.sha
        ))
    for sha in uncorrelated_commits:
        sys.stderr.write(
                '* Couldn\'t correlate following commit from the cherry-pick PR: {}\n'.format(source_sha)
        )
    if pr_commits:
        sys.stderr.write('* Some PRs were not cherry-picked: {}\n'.format([pr.title for pr in pr_commits.values()]))
        sys.exit(1)


try:
    _main()
except KeyboardInterrupt:
    sys.exit(0)
