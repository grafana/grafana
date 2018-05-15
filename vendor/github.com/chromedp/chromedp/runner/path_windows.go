// +build windows

package runner

import "os/exec"

const (
	// DefaultChromePath is the default path to use for Google Chrome if the
	// executable is not in %PATH%.
	DefaultChromePath = `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

	// DefaultEdgeDiagnosticsAdapterPath is the default path to use for the
	// Microsoft Edge Diagnostics Adapter if the executable is not in %PATH%.
	DefaultEdgeDiagnosticsAdapterPath = `c:\Edge\EdgeDiagnosticsAdapter\x64\EdgeDiagnosticsAdapter.exe`
)

func findChromePath() string {
	path, err := exec.LookPath(`chrome.exe`)
	if err == nil {
		return path
	}

	return DefaultChromePath
}

func findEdgePath() string {
	path, err := exec.LookPath(`EdgeDiagnosticsAdapter.exe`)
	if err == nil {
		return path
	}

	return DefaultEdgeDiagnosticsAdapterPath
}
