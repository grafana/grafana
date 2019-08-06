package assertions

import (
	"fmt"

	"github.com/smartystreets/assertions/internal/go-diff/diffmatchpatch"
)

func composePrettyDiff(expected, actual string) string {
	diff := diffmatchpatch.New()
	diffs := diff.DiffMain(expected, actual, false)
	if prettyDiffIsLikelyToBeHelpful(diffs) {
		return fmt.Sprintf("\nDiff:     '%s'", diff.DiffPrettyText(diffs))
	}
	return ""
}

// prettyDiffIsLikelyToBeHelpful returns true if the diff listing contains
// more 'equal' segments than 'deleted'/'inserted' segments.
func prettyDiffIsLikelyToBeHelpful(diffs []diffmatchpatch.Diff) bool {
	equal, deleted, inserted := measureDiffTypeLengths(diffs)
	return equal > deleted && equal > inserted
}

func measureDiffTypeLengths(diffs []diffmatchpatch.Diff) (equal, deleted, inserted int) {
	for _, segment := range diffs {
		switch segment.Type {
		case diffmatchpatch.DiffEqual:
			equal += len(segment.Text)
		case diffmatchpatch.DiffDelete:
			deleted += len(segment.Text)
		case diffmatchpatch.DiffInsert:
			inserted += len(segment.Text)
		}
	}
	return equal, deleted, inserted
}
