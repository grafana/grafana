// Copyright 2016 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/http"
)

// ReactionsService provides access to the reactions-related functions in the
// GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/reactions
type ReactionsService service

// Reaction represents a GitHub reaction.
type Reaction struct {
	// ID is the Reaction ID.
	ID     *int64  `json:"id,omitempty"`
	User   *User   `json:"user,omitempty"`
	NodeID *string `json:"node_id,omitempty"`
	// Content is the type of reaction.
	// Possible values are:
	//     "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
	Content *string `json:"content,omitempty"`
}

// Reactions represents a summary of GitHub reactions.
type Reactions struct {
	TotalCount *int    `json:"total_count,omitempty"`
	PlusOne    *int    `json:"+1,omitempty"`
	MinusOne   *int    `json:"-1,omitempty"`
	Laugh      *int    `json:"laugh,omitempty"`
	Confused   *int    `json:"confused,omitempty"`
	Heart      *int    `json:"heart,omitempty"`
	Hooray     *int    `json:"hooray,omitempty"`
	Rocket     *int    `json:"rocket,omitempty"`
	Eyes       *int    `json:"eyes,omitempty"`
	URL        *string `json:"url,omitempty"`
}

func (r Reaction) String() string {
	return Stringify(r)
}

// ListCommentReactionOptions specifies the optional parameters to the
// ReactionsService.ListCommentReactions method.
type ListCommentReactionOptions struct {
	// Content restricts the returned comment reactions to only those with the given type.
	// Omit this parameter to list all reactions to a commit comment.
	// Possible values are: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
	Content string `url:"content,omitempty"`

	ListOptions
}

// ListCommentReactions lists the reactions for a commit comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#list-reactions-for-a-commit-comment
//
//meta:operation GET /repos/{owner}/{repo}/comments/{comment_id}/reactions
func (s *ReactionsService) ListCommentReactions(ctx context.Context, owner, repo string, id int64, opts *ListCommentReactionOptions) ([]*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/comments/%v/reactions", owner, repo, id)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	var m []*Reaction
	resp, err := s.client.Do(ctx, req, &m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// CreateCommentReaction creates a reaction for a commit comment.
// Note that if you have already created a reaction of type content, the
// previously created reaction will be returned with Status: 200 OK.
// The content should have one of the following values: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-a-commit-comment
//
//meta:operation POST /repos/{owner}/{repo}/comments/{comment_id}/reactions
func (s *ReactionsService) CreateCommentReaction(ctx context.Context, owner, repo string, id int64, content string) (*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/comments/%v/reactions", owner, repo, id)

	body := &Reaction{Content: String(content)}
	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	m := &Reaction{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// DeleteCommentReaction deletes the reaction for a commit comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-a-commit-comment-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}
func (s *ReactionsService) DeleteCommentReaction(ctx context.Context, owner, repo string, commentID, reactionID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/comments/%v/reactions/%v", owner, repo, commentID, reactionID)

	return s.deleteReaction(ctx, u)
}

// DeleteCommentReactionByID deletes the reaction for a commit comment by repository ID.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-a-commit-comment-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}
func (s *ReactionsService) DeleteCommentReactionByID(ctx context.Context, repoID, commentID, reactionID int64) (*Response, error) {
	u := fmt.Sprintf("repositories/%v/comments/%v/reactions/%v", repoID, commentID, reactionID)

	return s.deleteReaction(ctx, u)
}

// ListIssueReactions lists the reactions for an issue.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#list-reactions-for-an-issue
//
//meta:operation GET /repos/{owner}/{repo}/issues/{issue_number}/reactions
func (s *ReactionsService) ListIssueReactions(ctx context.Context, owner, repo string, number int, opts *ListOptions) ([]*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/%v/reactions", owner, repo, number)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	var m []*Reaction
	resp, err := s.client.Do(ctx, req, &m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// CreateIssueReaction creates a reaction for an issue.
// Note that if you have already created a reaction of type content, the
// previously created reaction will be returned with Status: 200 OK.
// The content should have one of the following values: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-an-issue
//
//meta:operation POST /repos/{owner}/{repo}/issues/{issue_number}/reactions
func (s *ReactionsService) CreateIssueReaction(ctx context.Context, owner, repo string, number int, content string) (*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/%v/reactions", owner, repo, number)

	body := &Reaction{Content: String(content)}
	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	m := &Reaction{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// DeleteIssueReaction deletes the reaction to an issue.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-an-issue-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}
func (s *ReactionsService) DeleteIssueReaction(ctx context.Context, owner, repo string, issueNumber int, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/issues/%v/reactions/%v", owner, repo, issueNumber, reactionID)

	return s.deleteReaction(ctx, url)
}

// DeleteIssueReactionByID deletes the reaction to an issue by repository ID.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-an-issue-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}
func (s *ReactionsService) DeleteIssueReactionByID(ctx context.Context, repoID, issueNumber int, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("repositories/%v/issues/%v/reactions/%v", repoID, issueNumber, reactionID)

	return s.deleteReaction(ctx, url)
}

// ListIssueCommentReactions lists the reactions for an issue comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#list-reactions-for-an-issue-comment
//
//meta:operation GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions
func (s *ReactionsService) ListIssueCommentReactions(ctx context.Context, owner, repo string, id int64, opts *ListOptions) ([]*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/comments/%v/reactions", owner, repo, id)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	var m []*Reaction
	resp, err := s.client.Do(ctx, req, &m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// CreateIssueCommentReaction creates a reaction for an issue comment.
// Note that if you have already created a reaction of type content, the
// previously created reaction will be returned with Status: 200 OK.
// The content should have one of the following values: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-an-issue-comment
//
//meta:operation POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions
func (s *ReactionsService) CreateIssueCommentReaction(ctx context.Context, owner, repo string, id int64, content string) (*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/comments/%v/reactions", owner, repo, id)

	body := &Reaction{Content: String(content)}
	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	m := &Reaction{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// DeleteIssueCommentReaction deletes the reaction to an issue comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-an-issue-comment-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}
func (s *ReactionsService) DeleteIssueCommentReaction(ctx context.Context, owner, repo string, commentID, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/issues/comments/%v/reactions/%v", owner, repo, commentID, reactionID)

	return s.deleteReaction(ctx, url)
}

// DeleteIssueCommentReactionByID deletes the reaction to an issue comment by repository ID.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-an-issue-comment-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}
func (s *ReactionsService) DeleteIssueCommentReactionByID(ctx context.Context, repoID, commentID, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("repositories/%v/issues/comments/%v/reactions/%v", repoID, commentID, reactionID)

	return s.deleteReaction(ctx, url)
}

// ListPullRequestCommentReactions lists the reactions for a pull request review comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#list-reactions-for-a-pull-request-review-comment
//
//meta:operation GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions
func (s *ReactionsService) ListPullRequestCommentReactions(ctx context.Context, owner, repo string, id int64, opts *ListOptions) ([]*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pulls/comments/%v/reactions", owner, repo, id)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	var m []*Reaction
	resp, err := s.client.Do(ctx, req, &m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// CreatePullRequestCommentReaction creates a reaction for a pull request review comment.
// Note that if you have already created a reaction of type content, the
// previously created reaction will be returned with Status: 200 OK.
// The content should have one of the following values: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-a-pull-request-review-comment
//
//meta:operation POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions
func (s *ReactionsService) CreatePullRequestCommentReaction(ctx context.Context, owner, repo string, id int64, content string) (*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pulls/comments/%v/reactions", owner, repo, id)

	body := &Reaction{Content: String(content)}
	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	m := &Reaction{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// DeletePullRequestCommentReaction deletes the reaction to a pull request review comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-a-pull-request-comment-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}
func (s *ReactionsService) DeletePullRequestCommentReaction(ctx context.Context, owner, repo string, commentID, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/pulls/comments/%v/reactions/%v", owner, repo, commentID, reactionID)

	return s.deleteReaction(ctx, url)
}

// DeletePullRequestCommentReactionByID deletes the reaction to a pull request review comment by repository ID.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-a-pull-request-comment-reaction
//
//meta:operation DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}
func (s *ReactionsService) DeletePullRequestCommentReactionByID(ctx context.Context, repoID, commentID, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("repositories/%v/pulls/comments/%v/reactions/%v", repoID, commentID, reactionID)

	return s.deleteReaction(ctx, url)
}

// ListTeamDiscussionReactions lists the reactions for a team discussion.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#list-reactions-for-a-team-discussion-legacy
//
//meta:operation GET /teams/{team_id}/discussions/{discussion_number}/reactions
func (s *ReactionsService) ListTeamDiscussionReactions(ctx context.Context, teamID int64, discussionNumber int, opts *ListOptions) ([]*Reaction, *Response, error) {
	u := fmt.Sprintf("teams/%v/discussions/%v/reactions", teamID, discussionNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeReactionsPreview)

	var m []*Reaction
	resp, err := s.client.Do(ctx, req, &m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// CreateTeamDiscussionReaction creates a reaction for a team discussion.
// The content should have one of the following values: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-a-team-discussion-legacy
//
//meta:operation POST /teams/{team_id}/discussions/{discussion_number}/reactions
func (s *ReactionsService) CreateTeamDiscussionReaction(ctx context.Context, teamID int64, discussionNumber int, content string) (*Reaction, *Response, error) {
	u := fmt.Sprintf("teams/%v/discussions/%v/reactions", teamID, discussionNumber)

	body := &Reaction{Content: String(content)}
	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeReactionsPreview)

	m := &Reaction{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// DeleteTeamDiscussionReaction deletes the reaction to a team discussion.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-team-discussion-reaction
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions/{reaction_id}
func (s *ReactionsService) DeleteTeamDiscussionReaction(ctx context.Context, org, teamSlug string, discussionNumber int, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/teams/%v/discussions/%v/reactions/%v", org, teamSlug, discussionNumber, reactionID)

	return s.deleteReaction(ctx, url)
}

// DeleteTeamDiscussionReactionByOrgIDAndTeamID deletes the reaction to a team discussion by organization ID and team ID.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-a-team-discussion
//
//meta:operation POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions
func (s *ReactionsService) DeleteTeamDiscussionReactionByOrgIDAndTeamID(ctx context.Context, orgID, teamID, discussionNumber int, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("organizations/%v/team/%v/discussions/%v/reactions/%v", orgID, teamID, discussionNumber, reactionID)

	return s.deleteReaction(ctx, url)
}

// ListTeamDiscussionCommentReactions lists the reactions for a team discussion comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#list-reactions-for-a-team-discussion-comment-legacy
//
//meta:operation GET /teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}/reactions
func (s *ReactionsService) ListTeamDiscussionCommentReactions(ctx context.Context, teamID int64, discussionNumber, commentNumber int, opts *ListOptions) ([]*Reaction, *Response, error) {
	u := fmt.Sprintf("teams/%v/discussions/%v/comments/%v/reactions", teamID, discussionNumber, commentNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeReactionsPreview)

	var m []*Reaction
	resp, err := s.client.Do(ctx, req, &m)
	if err != nil {
		return nil, resp, err
	}
	return m, resp, nil
}

// CreateTeamDiscussionCommentReaction creates a reaction for a team discussion comment.
// The content should have one of the following values: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-a-team-discussion-comment-legacy
//
//meta:operation POST /teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}/reactions
func (s *ReactionsService) CreateTeamDiscussionCommentReaction(ctx context.Context, teamID int64, discussionNumber, commentNumber int, content string) (*Reaction, *Response, error) {
	u := fmt.Sprintf("teams/%v/discussions/%v/comments/%v/reactions", teamID, discussionNumber, commentNumber)

	body := &Reaction{Content: String(content)}
	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeReactionsPreview)

	m := &Reaction{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// DeleteTeamDiscussionCommentReaction deletes the reaction to a team discussion comment.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#delete-team-discussion-comment-reaction
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions/{reaction_id}
func (s *ReactionsService) DeleteTeamDiscussionCommentReaction(ctx context.Context, org, teamSlug string, discussionNumber, commentNumber int, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/teams/%v/discussions/%v/comments/%v/reactions/%v", org, teamSlug, discussionNumber, commentNumber, reactionID)

	return s.deleteReaction(ctx, url)
}

// DeleteTeamDiscussionCommentReactionByOrgIDAndTeamID deletes the reaction to a team discussion comment by organization ID and team ID.
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-a-team-discussion-comment
//
//meta:operation POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions
func (s *ReactionsService) DeleteTeamDiscussionCommentReactionByOrgIDAndTeamID(ctx context.Context, orgID, teamID, discussionNumber, commentNumber int, reactionID int64) (*Response, error) {
	url := fmt.Sprintf("organizations/%v/team/%v/discussions/%v/comments/%v/reactions/%v", orgID, teamID, discussionNumber, commentNumber, reactionID)

	return s.deleteReaction(ctx, url)
}

func (s *ReactionsService) deleteReaction(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeReactionsPreview)

	return s.client.Do(ctx, req, nil)
}

// CreateReleaseReaction creates a reaction to a release.
// Note that a response with a Status: 200 OK means that you already
// added the reaction type to this release.
// The content should have one of the following values: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", or "eyes".
//
// GitHub API docs: https://docs.github.com/rest/reactions/reactions#create-reaction-for-a-release
//
//meta:operation POST /repos/{owner}/{repo}/releases/{release_id}/reactions
func (s *ReactionsService) CreateReleaseReaction(ctx context.Context, owner, repo string, releaseID int64, content string) (*Reaction, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/releases/%v/reactions", owner, repo, releaseID)

	body := &Reaction{Content: String(content)}
	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeReactionsPreview)

	m := &Reaction{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}
