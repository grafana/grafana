package main

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strconv"

	"github.com/google/go-github/v31/github"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/urfave/cli/v2"
	"golang.org/x/oauth2"
)

const org = "grafana"
const repo = "grafana"
const label = "cherry-pick needed"

var reCherry = regexp.MustCompile("cherry picked from commit ([0-9a-f]+)")

func action(c *cli.Context) error {
	if c.Bool("verbose") {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	}
	if c.NArg() != 3 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.NewExitError(err.Error(), 1)
		}
		return cli.NewExitError("", 1)
	}

	milestoneTitle := c.Args().Get(0)
	prNumber, err := strconv.Atoi(c.Args().Get(1))
	if err != nil {
		return cli.NewExitError("The PR number must be an integer", 1)
	}

	token := c.Args().Get(2)

	log.Info().Msgf("Verifying cherry-pick PR %d for milestone %q...", prNumber, milestoneTitle)

	ctx := context.Background()
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(ctx, ts)
	client := github.NewClient(tc)

	ms, err := getMilestone(ctx, milestoneTitle, client, 0)
	if err != nil {
		return err
	}
	if ms == nil {
		return cli.NewExitError(fmt.Sprintf("Couldn't find any milestone with title %q", milestoneTitle), 1)
	}

	prCommits := map[string]*github.PullRequest{}
	if err := getPRCommits(ctx, client, *ms.Number, prCommits, 0); err != nil {
		return err
	}
	log.Debug().Msgf("Found %d PR(s)", len(prCommits))

	return verifyCherryPick(ctx, client, prNumber, prCommits)
}

// getCPCommits gets the commits included in a cherry-pick PR.
func getCPCommits(ctx context.Context, client *github.Client, pr *github.PullRequest, page int) ([]*github.RepositoryCommit, error) {
	log.Debug().Msgf("Getting commits included in cherry-pick PR")
	commits, resp, err := client.PullRequests.ListCommits(ctx, org, repo, *pr.Number, &github.ListOptions{
		Page: page,
	})
	if err != nil {
		return nil, err
	}
	if err := github.CheckResponse(resp.Response); err != nil {
		return nil, err
	}

	if resp.NextPage != 0 {
		cs, err := getCPCommits(ctx, client, pr, resp.NextPage)
		if err != nil {
			return nil, err
		}

		commits = append(commits, cs...)
	}

	log.Debug().Msgf("Got %d commit(s) for cherry-pick PR", len(commits))
	return commits, nil
}

// verifyCherryPick performs the actual verification of the cherry-pick PR.
func verifyCherryPick(ctx context.Context, client *github.Client, prNumber int, prCommits map[string]*github.PullRequest) error {
	log.Debug().Msgf("Getting the cherry-pick PR (%d)", prNumber)
	cherryPickPR, resp, err := client.PullRequests.Get(ctx, org, repo, prNumber)
	if err != nil {
		return err
	}
	if err := github.CheckResponse(resp.Response); err != nil {
		return err
	}

	commits, err := getCPCommits(ctx, client, cherryPickPR, 0)
	if err != nil {
		return err
	}

	log.Debug().Msgf("Correlating the cherry-pick PR's commits")
	commitsLackingSource := []*github.RepositoryCommit{}
	uncorrelatedCommits := []*github.RepositoryCommit{}
	for _, commit := range commits {
		ms := reCherry.FindStringSubmatch(*commit.Commit.Message)
		if len(ms) == 0 {
			commitsLackingSource = append(commitsLackingSource, commit)
			continue
		}

		sourceSHA := ms[1]

		// Find cherry-picked commit among PRs
		var corrPR *github.PullRequest
		for prSHA, pr := range prCommits {
			if prSHA[0:len(sourceSHA)] == sourceSHA {
				corrPR = pr
				delete(prCommits, prSHA)
				break
			}
		}

		if corrPR == nil {
			uncorrelatedCommits = append(uncorrelatedCommits, commit)
			continue
		}

		log.Debug().Msgf("Found corresponding PR #%d (%q)", *corrPR.Number, *corrPR.Title)
	}

	for _, commit := range commitsLackingSource {
		log.Warn().Msgf("Couldn't determine cherry-picked commit from message of %q", *commit.SHA)
	}
	for _, commit := range uncorrelatedCommits {
		log.Warn().Msgf("Couldn't correlate following commit from the cherry-pick PR to a flagged PR: %q", *commit.SHA)
	}
	if len(prCommits) > 0 {
		prsStr := ""
		for _, pr := range prCommits {
			descr := fmt.Sprintf("\n  * %s (#%d)", *pr.Title, *pr.Number)
			if prsStr != "" {
				prsStr = fmt.Sprintf("%s%s", prsStr, descr)
			} else {
				prsStr = descr
			}
		}
		log.Error().Msgf("Some PRs were not cherry-picked:%s", prsStr)
		os.Exit(1)
	}

	return nil
}

// getPRCommits gets a map of closed merge commits to PRs for the milestone and flagged for cherry-picking.
func getPRCommits(ctx context.Context, client *github.Client, msNumber int, prCommits map[string]*github.PullRequest, page int) error {
	prsSvc := client.PullRequests
	issuesSvc := client.Issues
	const state = "closed"
	log.Debug().Msgf("Listing issues with milestone number %d, state %q and label %q - page %d", msNumber, state, label, page)
	issues, resp, err := issuesSvc.ListByRepo(ctx, org, repo, &github.IssueListByRepoOptions{
		Milestone: strconv.Itoa(msNumber),
		State:     state,
		Labels: []string{
			label,
		},
		ListOptions: github.ListOptions{
			Page: page,
		},
	})
	if err != nil {
		return err
	}
	if err := github.CheckResponse(resp.Response); err != nil {
		return err
	}

	for _, issue := range issues {
		if !issue.IsPullRequest() {
			continue
		}

		pr, resp, err := prsSvc.Get(ctx, org, repo, *issue.Number)
		if err != nil {
			return err
		}
		if err := github.CheckResponse(resp.Response); err != nil {
			return err
		}

		log.Debug().Msgf("Got PR #%d (%s) - merge commit %s", *pr.Number, *pr.Title, *pr.MergeCommitSHA)
		if *pr.MergeCommitSHA == "" {
			return fmt.Errorf("got PR %d without merge commit SHA", *pr.Number)
		}

		prCommits[*pr.MergeCommitSHA] = pr
	}
	if resp.NextPage != 0 {
		err := getPRCommits(ctx, client, msNumber, prCommits, resp.NextPage)
		if err != nil {
			return err
		}
	}

	return nil
}

// getMilestone tries to get the milestone
func getMilestone(ctx context.Context, title string, client *github.Client, page int) (*github.Milestone, error) {
	issuesSvc := client.Issues
	log.Debug().Msgf("Listing milestones, page %d", page)
	milestones, resp, err := issuesSvc.ListMilestones(ctx, "grafana", "grafana", &github.MilestoneListOptions{
		State: "all",
		ListOptions: github.ListOptions{
			Page: page,
		},
	})
	if err != nil {
		return nil, err
	}
	if err := github.CheckResponse(resp.Response); err != nil {
		return nil, err
	}

	log.Debug().Msgf("Found %d milestone(s) for page %d", len(milestones), page)
	re := regexp.MustCompile(fmt.Sprintf("^(Milestone )?%s$", regexp.QuoteMeta(title)))
	for _, ms := range milestones {
		if ms.Title == nil {
			continue
		}

		if re.MatchString(*ms.Title) {
			log.Debug().Msgf("Milestone %q is a match", *ms.Title)
			return ms, nil
		}
	}

	if resp.NextPage != 0 {
		return getMilestone(ctx, title, client, resp.NextPage)
	}

	return nil, nil
}

func main() {
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	output := zerolog.ConsoleWriter{
		Out:        os.Stderr,
		PartsOrder: []string{"message"},
		FormatMessage: func(msg interface{}) string {
			return fmt.Sprintf("* %s", msg)
		},
	}
	log.Logger = log.Output(output)

	app := &cli.App{
		Name:      "verify-cherrypicks",
		Usage:     "Tool to verify a Grafana cherry-picks PR",
		ArgsUsage: "<milestone-title> <pr-id> <github-token>",
		Version:   "0.1.0",
		Action:    action,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:    "verbose",
				Aliases: []string{"V"},
			},
		},
	}
	if err := app.Run(os.Args); err != nil {
		log.Fatal().Err(err).Msg("An unexpected error occurred")
	}

	log.Info().Msgf("The cherry-pick PR was successfully verified!")
}
