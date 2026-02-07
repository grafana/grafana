// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
)

// SignatureVerification represents GPG signature verification.
type SignatureVerification struct {
	Verified  *bool   `json:"verified,omitempty"`
	Reason    *string `json:"reason,omitempty"`
	Signature *string `json:"signature,omitempty"`
	Payload   *string `json:"payload,omitempty"`
}

// MessageSigner is used by GitService.CreateCommit to sign a commit.
//
// To create a MessageSigner that signs a commit with a [golang.org/x/crypto/openpgp.Entity],
// or [github.com/ProtonMail/go-crypto/openpgp.Entity], use:
//
//	commit.Signer = github.MessageSignerFunc(func(w io.Writer, r io.Reader) error {
//		return openpgp.ArmoredDetachSign(w, openpgpEntity, r, nil)
//	})
type MessageSigner interface {
	Sign(w io.Writer, r io.Reader) error
}

// MessageSignerFunc is a single function implementation of MessageSigner.
type MessageSignerFunc func(w io.Writer, r io.Reader) error

func (f MessageSignerFunc) Sign(w io.Writer, r io.Reader) error {
	return f(w, r)
}

// Commit represents a GitHub commit.
type Commit struct {
	SHA          *string                `json:"sha,omitempty"`
	Author       *CommitAuthor          `json:"author,omitempty"`
	Committer    *CommitAuthor          `json:"committer,omitempty"`
	Message      *string                `json:"message,omitempty"`
	Tree         *Tree                  `json:"tree,omitempty"`
	Parents      []*Commit              `json:"parents,omitempty"`
	HTMLURL      *string                `json:"html_url,omitempty"`
	URL          *string                `json:"url,omitempty"`
	Verification *SignatureVerification `json:"verification,omitempty"`
	NodeID       *string                `json:"node_id,omitempty"`

	// CommentCount is the number of GitHub comments on the commit. This
	// is only populated for requests that fetch GitHub data like
	// Pulls.ListCommits, Repositories.ListCommits, etc.
	CommentCount *int `json:"comment_count,omitempty"`
}

func (c Commit) String() string {
	return Stringify(c)
}

// CommitAuthor represents the author or committer of a commit. The commit
// author may not correspond to a GitHub User.
type CommitAuthor struct {
	Date  *Timestamp `json:"date,omitempty"`
	Name  *string    `json:"name,omitempty"`
	Email *string    `json:"email,omitempty"`

	// The following fields are only populated by Webhook events.
	Login *string `json:"username,omitempty"` // Renamed for go-github consistency.
}

func (c CommitAuthor) String() string {
	return Stringify(c)
}

// GetCommit fetches the Commit object for a given SHA.
//
// GitHub API docs: https://docs.github.com/rest/git/commits#get-a-commit-object
//
//meta:operation GET /repos/{owner}/{repo}/git/commits/{commit_sha}
func (s *GitService) GetCommit(ctx context.Context, owner string, repo string, sha string) (*Commit, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/git/commits/%v", owner, repo, sha)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	c := new(Commit)
	resp, err := s.client.Do(ctx, req, c)
	if err != nil {
		return nil, resp, err
	}

	return c, resp, nil
}

// createCommit represents the body of a CreateCommit request.
type createCommit struct {
	Author    *CommitAuthor `json:"author,omitempty"`
	Committer *CommitAuthor `json:"committer,omitempty"`
	Message   *string       `json:"message,omitempty"`
	Tree      *string       `json:"tree,omitempty"`
	Parents   []string      `json:"parents,omitempty"`
	Signature *string       `json:"signature,omitempty"`
}

type CreateCommitOptions struct {
	// CreateCommit will sign the commit with this signer. See MessageSigner doc for more details.
	// Ignored on commits where Verification.Signature is defined.
	Signer MessageSigner
}

// CreateCommit creates a new commit in a repository.
// commit must not be nil.
//
// The commit.Committer is optional and will be filled with the commit.Author
// data if omitted. If the commit.Author is omitted, it will be filled in with
// the authenticated user’s information and the current date.
//
// GitHub API docs: https://docs.github.com/rest/git/commits#create-a-commit
//
//meta:operation POST /repos/{owner}/{repo}/git/commits
func (s *GitService) CreateCommit(ctx context.Context, owner string, repo string, commit *Commit, opts *CreateCommitOptions) (*Commit, *Response, error) {
	if commit == nil {
		return nil, nil, errors.New("commit must be provided")
	}
	if opts == nil {
		opts = &CreateCommitOptions{}
	}

	u := fmt.Sprintf("repos/%v/%v/git/commits", owner, repo)

	parents := make([]string, len(commit.Parents))
	for i, parent := range commit.Parents {
		parents[i] = *parent.SHA
	}

	body := &createCommit{
		Author:    commit.Author,
		Committer: commit.Committer,
		Message:   commit.Message,
		Parents:   parents,
	}
	if commit.Tree != nil {
		body.Tree = commit.Tree.SHA
	}
	switch {
	case commit.Verification != nil:
		body.Signature = commit.Verification.Signature
	case opts.Signer != nil:
		signature, err := createSignature(opts.Signer, body)
		if err != nil {
			return nil, nil, err
		}
		body.Signature = &signature
	}

	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	c := new(Commit)
	resp, err := s.client.Do(ctx, req, c)
	if err != nil {
		return nil, resp, err
	}

	return c, resp, nil
}

func createSignature(signer MessageSigner, commit *createCommit) (string, error) {
	if signer == nil {
		return "", errors.New("createSignature: invalid parameters")
	}

	message, err := createSignatureMessage(commit)
	if err != nil {
		return "", err
	}

	var writer bytes.Buffer
	err = signer.Sign(&writer, strings.NewReader(message))
	if err != nil {
		return "", err
	}

	return writer.String(), nil
}

func createSignatureMessage(commit *createCommit) (string, error) {
	if commit == nil || commit.Message == nil || *commit.Message == "" || commit.Author == nil {
		return "", errors.New("createSignatureMessage: invalid parameters")
	}

	var message []string

	if commit.Tree != nil {
		message = append(message, fmt.Sprintf("tree %s", *commit.Tree))
	}

	for _, parent := range commit.Parents {
		message = append(message, fmt.Sprintf("parent %s", parent))
	}

	message = append(message, fmt.Sprintf("author %s <%s> %d %s", commit.Author.GetName(), commit.Author.GetEmail(), commit.Author.GetDate().Unix(), commit.Author.GetDate().Format("-0700")))

	committer := commit.Committer
	if committer == nil {
		committer = commit.Author
	}

	// There needs to be a double newline after committer
	message = append(message, fmt.Sprintf("committer %s <%s> %d %s\n", committer.GetName(), committer.GetEmail(), committer.GetDate().Unix(), committer.GetDate().Format("-0700")))
	message = append(message, *commit.Message)

	return strings.Join(message, "\n"), nil
}
