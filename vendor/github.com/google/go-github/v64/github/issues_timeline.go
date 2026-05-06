// Copyright 2016 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"strings"
)

// Timeline represents an event that occurred around an Issue or Pull Request.
//
// It is similar to an IssueEvent but may contain more information.
// GitHub API docs: https://docs.github.com/developers/webhooks-and-events/events/issue-event-types
type Timeline struct {
	ID        *int64  `json:"id,omitempty"`
	URL       *string `json:"url,omitempty"`
	CommitURL *string `json:"commit_url,omitempty"`

	// The User object that generated the event.
	Actor *User `json:"actor,omitempty"`

	// The person who commented on the issue.
	User *User `json:"user,omitempty"`

	// The person who authored the commit.
	Author *CommitAuthor `json:"author,omitempty"`
	// The person who committed the commit on behalf of the author.
	Committer *CommitAuthor `json:"committer,omitempty"`
	// The SHA of the commit in the pull request.
	SHA *string `json:"sha,omitempty"`
	// The commit message.
	Message *string `json:"message,omitempty"`
	// A list of parent commits.
	Parents []*Commit `json:"parents,omitempty"`

	// Event identifies the actual type of Event that occurred. Possible values
	// are:
	//
	//     assigned
	//       The issue was assigned to the assignee.
	//
	//     closed
	//       The issue was closed by the actor. When the commit_id is present, it
	//       identifies the commit that closed the issue using "closes / fixes #NN"
	//       syntax.
	//
	//     commented
	//       A comment was added to the issue.
	//
	//     committed
	//       A commit was added to the pull request's 'HEAD' branch. Only provided
	//       for pull requests.
	//
	//     cross-referenced
	//       The issue was referenced from another issue. The 'source' attribute
	//       contains the 'id', 'actor', and 'url' of the reference's source.
	//
	//     demilestoned
	//       The issue was removed from a milestone.
	//
	//     head_ref_deleted
	//       The pull request's branch was deleted.
	//
	//     head_ref_restored
	//       The pull request's branch was restored.
	//
	//     labeled
	//       A label was added to the issue.
	//
	//     locked
	//       The issue was locked by the actor.
	//
	//     mentioned
	//       The actor was @mentioned in an issue body.
	//
	//     merged
	//       The issue was merged by the actor. The 'commit_id' attribute is the
	//       SHA1 of the HEAD commit that was merged.
	//
	//     milestoned
	//       The issue was added to a milestone.
	//
	//     referenced
	//       The issue was referenced from a commit message. The 'commit_id'
	//       attribute is the commit SHA1 of where that happened.
	//
	//     renamed
	//       The issue title was changed.
	//
	//     reopened
	//       The issue was reopened by the actor.
	//
	//     reviewed
	//       The pull request was reviewed.
	//
	//     subscribed
	//       The actor subscribed to receive notifications for an issue.
	//
	//     unassigned
	//       The assignee was unassigned from the issue.
	//
	//     unlabeled
	//       A label was removed from the issue.
	//
	//     unlocked
	//       The issue was unlocked by the actor.
	//
	//     unsubscribed
	//       The actor unsubscribed to stop receiving notifications for an issue.
	//
	Event *string `json:"event,omitempty"`

	// The string SHA of a commit that referenced this Issue or Pull Request.
	CommitID *string `json:"commit_id,omitempty"`
	// The timestamp indicating when the event occurred.
	CreatedAt *Timestamp `json:"created_at,omitempty"`
	// The Label object including `name` and `color` attributes. Only provided for
	// 'labeled' and 'unlabeled' events.
	Label *Label `json:"label,omitempty"`
	// The User object which was assigned to (or unassigned from) this Issue or
	// Pull Request. Only provided for 'assigned' and 'unassigned' events.
	Assignee *User `json:"assignee,omitempty"`
	Assigner *User `json:"assigner,omitempty"`

	// The Milestone object including a 'title' attribute.
	// Only provided for 'milestoned' and 'demilestoned' events.
	Milestone *Milestone `json:"milestone,omitempty"`
	// The 'id', 'actor', and 'url' for the source of a reference from another issue.
	// Only provided for 'cross-referenced' events.
	Source *Source `json:"source,omitempty"`
	// An object containing rename details including 'from' and 'to' attributes.
	// Only provided for 'renamed' events.
	Rename      *Rename      `json:"rename,omitempty"`
	ProjectCard *ProjectCard `json:"project_card,omitempty"`
	// The state of a submitted review. Can be one of: 'commented',
	// 'changes_requested' or 'approved'.
	// Only provided for 'reviewed' events.
	State *string `json:"state,omitempty"`

	// The person requested to review the pull request.
	Reviewer *User `json:"requested_reviewer,omitempty"`
	// RequestedTeam contains the team requested to review the pull request.
	RequestedTeam *Team `json:"requested_team,omitempty"`
	// The person who requested a review.
	Requester *User `json:"review_requester,omitempty"`

	// The review summary text.
	Body        *string    `json:"body,omitempty"`
	SubmittedAt *Timestamp `json:"submitted_at,omitempty"`

	PerformedViaGithubApp *App `json:"performed_via_github_app,omitempty"`
}

// Source represents a reference's source.
type Source struct {
	ID    *int64  `json:"id,omitempty"`
	URL   *string `json:"url,omitempty"`
	Actor *User   `json:"actor,omitempty"`
	Type  *string `json:"type,omitempty"`
	Issue *Issue  `json:"issue,omitempty"`
}

// ListIssueTimeline lists events for the specified issue.
//
// GitHub API docs: https://docs.github.com/rest/issues/timeline#list-timeline-events-for-an-issue
//
//meta:operation GET /repos/{owner}/{repo}/issues/{issue_number}/timeline
func (s *IssuesService) ListIssueTimeline(ctx context.Context, owner, repo string, number int, opts *ListOptions) ([]*Timeline, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/%v/timeline", owner, repo, number)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	acceptHeaders := []string{mediaTypeTimelinePreview, mediaTypeProjectCardDetailsPreview}
	req.Header.Set("Accept", strings.Join(acceptHeaders, ", "))

	var events []*Timeline
	resp, err := s.client.Do(ctx, req, &events)
	if err != nil {
		return nil, resp, err
	}

	return events, resp, nil
}
