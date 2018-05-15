// +build darwin

package runner

const (
	// DefaultChromePath is the default path to the Chrome application.
	DefaultChromePath = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
)

func findChromePath() string {
	return DefaultChromePath
}
