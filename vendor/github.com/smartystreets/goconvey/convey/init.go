package convey

import (
	"flag"
	"os"

	"github.com/jtolds/gls"
	"github.com/smartystreets/assertions"
	"github.com/smartystreets/goconvey/convey/reporting"
)

func init() {
	assertions.GoConveyMode(true)

	declareFlags()

	ctxMgr = gls.NewContextManager()
}

func declareFlags() {
	flag.BoolVar(&json, "convey-json", false, "When true, emits results in JSON blocks. Default: 'false'")
	flag.BoolVar(&silent, "convey-silent", false, "When true, all output from GoConvey is suppressed.")
	flag.BoolVar(&story, "convey-story", false, "When true, emits story output, otherwise emits dot output. When not provided, this flag mirrors the value of the '-test.v' flag")

	if noStoryFlagProvided() {
		story = verboseEnabled
	}

	// FYI: flag.Parse() is called from the testing package.
}

func noStoryFlagProvided() bool {
	return !story && !storyDisabled
}

func buildReporter() reporting.Reporter {
	selectReporter := os.Getenv("GOCONVEY_REPORTER")

	switch {
	case testReporter != nil:
		return testReporter
	case json || selectReporter == "json":
		return reporting.BuildJsonReporter()
	case silent || selectReporter == "silent":
		return reporting.BuildSilentReporter()
	case selectReporter == "dot":
		// Story is turned on when verbose is set, so we need to check for dot reporter first.
		return reporting.BuildDotReporter()
	case story || selectReporter == "story":
		return reporting.BuildStoryReporter()
	default:
		return reporting.BuildDotReporter()
	}
}

var (
	ctxMgr *gls.ContextManager

	// only set by internal tests
	testReporter reporting.Reporter
)

var (
	json   bool
	silent bool
	story  bool

	verboseEnabled = flagFound("-test.v=true")
	storyDisabled  = flagFound("-story=false")
)

// flagFound parses the command line args manually for flags defined in other
// packages. Like the '-v' flag from the "testing" package, for instance.
func flagFound(flagValue string) bool {
	for _, arg := range os.Args {
		if arg == flagValue {
			return true
		}
	}
	return false
}
