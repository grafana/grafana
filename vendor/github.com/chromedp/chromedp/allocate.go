package chromedp

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"strings"
	"sync"
)

// An Allocator is responsible for creating and managing a number of browsers.
//
// This interface abstracts away how the browser process is actually run. For
// example, an Allocator implementation may reuse browser processes, or connect
// to already-running browsers on remote machines.
type Allocator interface {
	// Allocate creates a new browser. It can be cancelled via the provided
	// context, at which point all the resources used by the browser (such
	// as temporary directories) will be freed.
	Allocate(context.Context, ...BrowserOption) (*Browser, error)

	// Wait blocks until an allocator has freed all of its resources.
	// Cancelling the allocator context will already perform this operation,
	// so normally there's no need to call Wait directly.
	Wait()
}

// setupExecAllocator is similar to NewExecAllocator, but it allows NewContext
// to create the allocator without the unnecessary context layer.
func setupExecAllocator(opts ...ExecAllocatorOption) *ExecAllocator {
	ep := &ExecAllocator{
		initFlags: make(map[string]interface{}),
	}
	for _, o := range opts {
		o(ep)
	}
	if ep.execPath == "" {
		ep.execPath = findExecPath()
	}
	return ep
}

// DefaultExecAllocatorOptions are the ExecAllocator options used by NewContext
// if the given parent context doesn't have an allocator set up.
var DefaultExecAllocatorOptions = []ExecAllocatorOption{
	NoFirstRun,
	NoDefaultBrowserCheck,
	Headless,
}

// NewExecAllocator creates a new context set up with an ExecAllocator, suitable
// for use with NewContext.
func NewExecAllocator(parent context.Context, opts ...ExecAllocatorOption) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(parent)
	c := &Context{Allocator: setupExecAllocator(opts...)}

	ctx = context.WithValue(ctx, contextKey{}, c)
	cancelWait := func() {
		cancel()
		c.Allocator.Wait()
	}
	return ctx, cancelWait
}

// ExecAllocatorOption is a exec allocator option.
type ExecAllocatorOption func(*ExecAllocator)

// ExecAllocator is an Allocator which starts new browser processes on the host
// machine.
type ExecAllocator struct {
	execPath  string
	initFlags map[string]interface{}

	wg sync.WaitGroup
}

// Allocate satisfies the Allocator interface.
func (a *ExecAllocator) Allocate(ctx context.Context, opts ...BrowserOption) (*Browser, error) {
	c := FromContext(ctx)
	if c == nil {
		return nil, ErrInvalidContext
	}

	var args []string
	for name, value := range a.initFlags {
		switch value := value.(type) {
		case string:
			args = append(args, fmt.Sprintf("--%s=%s", name, value))
		case bool:
			if value {
				args = append(args, fmt.Sprintf("--%s", name))
			}
		default:
			return nil, fmt.Errorf("invalid exec pool flag")
		}
	}

	removeDir := false
	dataDir, ok := a.initFlags["user-data-dir"].(string)
	if !ok {
		tempDir, err := ioutil.TempDir("", "chromedp-runner")
		if err != nil {
			return nil, err
		}
		args = append(args, "--user-data-dir="+tempDir)
		dataDir = tempDir
		removeDir = true
	}
	args = append(args, "--remote-debugging-port=0")

	// Force the first page to be blank, instead of the welcome page;
	// --no-first-run doesn't enforce that.
	args = append(args, "about:blank")

	cmd := exec.CommandContext(ctx, a.execPath, args...)

	a.wg.Add(1) // for the entire allocator
	c.wg.Add(1) // for this browser's root context
	go func() {
		<-ctx.Done()
		// First wait for the process to be finished.
		// TODO: do we care about this error in any scenario? if the
		// user cancelled the context and killed chrome, this will most
		// likely just be "signal: killed", which isn't interesting.
		cmd.Wait()
		// Then delete the temporary user data directory, if needed.
		if removeDir {
			if err := os.RemoveAll(dataDir); c.cancelErr == nil {
				c.cancelErr = err
			}
		}
		a.wg.Done()
		c.wg.Done()
	}()
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	defer stderr.Close()
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	wsURL, err := portFromStderr(stderr)
	if err != nil {
		return nil, err
	}

	browser, err := NewBrowser(ctx, wsURL, opts...)
	if err != nil {
		return nil, err
	}
	go func() {
		// If the browser loses connection, kill the entire process and
		// handler at once.
		<-browser.LostConnection
		Cancel(ctx)
	}()
	browser.process = cmd.Process
	browser.userDataDir = dataDir
	return browser, nil
}

// portFromStderr finds the free port that Chrome selected for the debugging
// protocol. This should be hooked up to a new Chrome process's Stderr pipe
// right after it is started.
func portFromStderr(rc io.ReadCloser) (string, error) {
	url := ""
	scanner := bufio.NewScanner(rc)
	prefix := "DevTools listening on"
	for scanner.Scan() {
		line := scanner.Text()
		if s := strings.TrimPrefix(line, prefix); s != line {
			url = strings.TrimSpace(s)
			break
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	rc.Close()
	return url, nil
}

// Wait satisfies the Allocator interface.
func (a *ExecAllocator) Wait() {
	a.wg.Wait()
}

// ExecPath returns an ExecAllocatorOption which uses the given path to execute
// browser processes. The given path can be an absolute path to a binary, or
// just the name of the program to find via exec.LookPath.
func ExecPath(path string) ExecAllocatorOption {
	return func(a *ExecAllocator) {
		// Convert to an absolute path if possible, to avoid
		// repeated LookPath calls in each Allocate.
		if fullPath, _ := exec.LookPath(path); fullPath != "" {
			a.execPath = fullPath
		} else {
			a.execPath = path
		}
	}
}

// findExecPath tries to find the Chrome browser somewhere in the current
// system. It performs a rather agressive search, which is the same in all
// systems. That may make it a bit slow, but it will only be run when creating a
// new ExecAllocator.
func findExecPath() string {
	for _, path := range [...]string{
		// Unix-like
		"headless_shell",
		"headless-shell",
		"chromium",
		"chromium-browser",
		"google-chrome",
		"google-chrome-stable",
		"google-chrome-beta",
		"google-chrome-unstable",
		"/usr/bin/google-chrome",

		// Windows
		"chrome",
		"chrome.exe", // in case PATHEXT is misconfigured
		`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,

		// Mac
		`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
	} {
		found, err := exec.LookPath(path)
		if err == nil {
			return found
		}
	}
	// Fall back to something simple and sensible, to give a useful error
	// message.
	return "google-chrome"
}

// Flag is a generic command line option to pass a flag to Chrome. If the value
// is a string, it will be passed as --name=value. If it's a boolean, it will be
// passed as --name if value is true.
func Flag(name string, value interface{}) ExecAllocatorOption {
	return func(a *ExecAllocator) {
		a.initFlags[name] = value
	}
}

// UserDataDir is the command line option to set the user data dir.
//
// Note: set this option to manually set the profile directory used by Chrome.
// When this is not set, then a default path will be created in the /tmp
// directory.
func UserDataDir(dir string) ExecAllocatorOption {
	return Flag("user-data-dir", dir)
}

// ProxyServer is the command line option to set the outbound proxy server.
func ProxyServer(proxy string) ExecAllocatorOption {
	return Flag("proxy-server", proxy)
}

// WindowSize is the command line option to set the initial window size.
func WindowSize(width, height int) ExecAllocatorOption {
	return Flag("window-size", fmt.Sprintf("%d,%d", width, height))
}

// UserAgent is the command line option to set the default User-Agent
// header.
func UserAgent(userAgent string) ExecAllocatorOption {
	return Flag("user-agent", userAgent)
}

// NoSandbox is the Chrome comamnd line option to disable the sandbox.
func NoSandbox(a *ExecAllocator) {
	Flag("no-sandbox", true)(a)
}

// NoFirstRun is the Chrome comamnd line option to disable the first run
// dialog.
func NoFirstRun(a *ExecAllocator) {
	Flag("no-first-run", true)(a)
}

// NoDefaultBrowserCheck is the Chrome comamnd line option to disable the
// default browser check.
func NoDefaultBrowserCheck(a *ExecAllocator) {
	Flag("no-default-browser-check", true)(a)
}

// Headless is the command line option to run in headless mode.
func Headless(a *ExecAllocator) {
	Flag("headless", true)(a)
}

// DisableGPU is the command line option to disable the GPU process.
func DisableGPU(a *ExecAllocator) {
	Flag("disable-gpu", true)(a)
}

// NewRemoteAllocator creates a new context set up with a RemoteAllocator,
// suitable for use with NewContext.
func NewRemoteAllocator(parent context.Context, url string) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(parent)
	c := &Context{Allocator: &RemoteAllocator{
		wsURL: url,
	}}
	ctx = context.WithValue(ctx, contextKey{}, c)
	return ctx, cancel
}

// RemoteAllocator is an Allocator which connects to an already running Chrome
// process via a websocket URL.
type RemoteAllocator struct {
	wsURL string

	wg sync.WaitGroup
}

// Allocate satisfies the Allocator interface.
func (a *RemoteAllocator) Allocate(ctx context.Context, opts ...BrowserOption) (*Browser, error) {
	// Use a different context for the websocket, so we can have a chance at
	// closing the relevant pages before closing the websocket connection.
	wctx, cancel := context.WithCancel(context.Background())

	a.wg.Add(1)
	go func() {
		<-ctx.Done()
		Cancel(ctx) // block until all pages are closed
		cancel()    // close the websocket connection
		a.wg.Done()
	}()
	browser, err := NewBrowser(wctx, a.wsURL, opts...)
	if err != nil {
		return nil, err
	}
	go func() {
		// If the browser loses connection, kill the entire process and
		// handler at once.
		<-browser.LostConnection
		Cancel(ctx)
	}()
	return browser, nil
}

// Wait satisfies the Allocator interface.
func (a *RemoteAllocator) Wait() {
	a.wg.Wait()
}
