package main

import (
	"bytes"
	"errors"
	"fmt"
	"go/ast"
	"go/build"
	"go/doc"
	"go/parser"
	"go/scanner"
	"go/token"
	"go/types"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"text/template"
	"time"
	"unicode"
	"unicode/utf8"

	gbuild "github.com/gopherjs/gopherjs/build"
	"github.com/gopherjs/gopherjs/compiler"
	"github.com/gopherjs/gopherjs/internal/sysutil"
	"github.com/kisielk/gotool"
	"github.com/neelance/sourcemap"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"golang.org/x/crypto/ssh/terminal"
)

var currentDirectory string

func init() {
	var err error
	currentDirectory, err = os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	currentDirectory, err = filepath.EvalSymlinks(currentDirectory)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	gopaths := filepath.SplitList(build.Default.GOPATH)
	if len(gopaths) == 0 {
		fmt.Fprintf(os.Stderr, "$GOPATH not set. For more details see: go help gopath\n")
		os.Exit(1)
	}
}

func main() {
	var (
		options = &gbuild.Options{CreateMapFile: true}
		pkgObj  string
		tags    string
	)

	flagVerbose := pflag.NewFlagSet("", 0)
	flagVerbose.BoolVarP(&options.Verbose, "verbose", "v", false, "print the names of packages as they are compiled")
	flagQuiet := pflag.NewFlagSet("", 0)
	flagQuiet.BoolVarP(&options.Quiet, "quiet", "q", false, "suppress non-fatal warnings")

	compilerFlags := pflag.NewFlagSet("", 0)
	compilerFlags.BoolVarP(&options.Minify, "minify", "m", false, "minify generated code")
	compilerFlags.BoolVar(&options.Color, "color", terminal.IsTerminal(int(os.Stderr.Fd())) && os.Getenv("TERM") != "dumb", "colored output")
	compilerFlags.StringVar(&tags, "tags", "", "a list of build tags to consider satisfied during the build")
	compilerFlags.BoolVar(&options.MapToLocalDisk, "localmap", false, "use local paths for sourcemap")

	flagWatch := pflag.NewFlagSet("", 0)
	flagWatch.BoolVarP(&options.Watch, "watch", "w", false, "watch for changes to the source files")

	cmdBuild := &cobra.Command{
		Use:   "build [packages]",
		Short: "compile packages and dependencies",
	}
	cmdBuild.Flags().StringVarP(&pkgObj, "output", "o", "", "output file")
	cmdBuild.Flags().AddFlagSet(flagVerbose)
	cmdBuild.Flags().AddFlagSet(flagQuiet)
	cmdBuild.Flags().AddFlagSet(compilerFlags)
	cmdBuild.Flags().AddFlagSet(flagWatch)
	cmdBuild.Run = func(cmd *cobra.Command, args []string) {
		options.BuildTags = strings.Fields(tags)
		for {
			s := gbuild.NewSession(options)

			err := func() error {
				// Handle "gopherjs build [files]" ad-hoc package mode.
				if len(args) > 0 && (strings.HasSuffix(args[0], ".go") || strings.HasSuffix(args[0], ".inc.js")) {
					for _, arg := range args {
						if !strings.HasSuffix(arg, ".go") && !strings.HasSuffix(arg, ".inc.js") {
							return fmt.Errorf("named files must be .go or .inc.js files")
						}
					}
					if pkgObj == "" {
						basename := filepath.Base(args[0])
						pkgObj = basename[:len(basename)-3] + ".js"
					}
					names := make([]string, len(args))
					for i, name := range args {
						name = filepath.ToSlash(name)
						names[i] = name
						if s.Watcher != nil {
							s.Watcher.Add(name)
						}
					}
					err := s.BuildFiles(args, pkgObj, currentDirectory)
					return err
				}

				// Expand import path patterns.
				patternContext := gbuild.NewBuildContext("", options.BuildTags)
				pkgs := (&gotool.Context{BuildContext: *patternContext}).ImportPaths(args)

				for _, pkgPath := range pkgs {
					if s.Watcher != nil {
						pkg, err := gbuild.NewBuildContext(s.InstallSuffix(), options.BuildTags).Import(pkgPath, "", build.FindOnly)
						if err != nil {
							return err
						}
						s.Watcher.Add(pkg.Dir)
					}
					pkg, err := gbuild.Import(pkgPath, 0, s.InstallSuffix(), options.BuildTags)
					if err != nil {
						return err
					}
					archive, err := s.BuildPackage(pkg)
					if err != nil {
						return err
					}
					if len(pkgs) == 1 { // Only consider writing output if single package specified.
						if pkgObj == "" {
							pkgObj = filepath.Base(pkg.Dir) + ".js"
						}
						if pkg.IsCommand() && !pkg.UpToDate {
							if err := s.WriteCommandPackage(archive, pkgObj); err != nil {
								return err
							}
						}
					}
				}
				return nil
			}()
			exitCode := handleError(err, options, nil)

			if s.Watcher == nil {
				os.Exit(exitCode)
			}
			s.WaitForChange()
		}
	}

	cmdInstall := &cobra.Command{
		Use:   "install [packages]",
		Short: "compile and install packages and dependencies",
	}
	cmdInstall.Flags().AddFlagSet(flagVerbose)
	cmdInstall.Flags().AddFlagSet(flagQuiet)
	cmdInstall.Flags().AddFlagSet(compilerFlags)
	cmdInstall.Flags().AddFlagSet(flagWatch)
	cmdInstall.Run = func(cmd *cobra.Command, args []string) {
		options.BuildTags = strings.Fields(tags)
		for {
			s := gbuild.NewSession(options)

			err := func() error {
				// Expand import path patterns.
				patternContext := gbuild.NewBuildContext("", options.BuildTags)
				pkgs := (&gotool.Context{BuildContext: *patternContext}).ImportPaths(args)

				if cmd.Name() == "get" {
					goGet := exec.Command("go", append([]string{"get", "-d", "-tags=js"}, pkgs...)...)
					goGet.Stdout = os.Stdout
					goGet.Stderr = os.Stderr
					if err := goGet.Run(); err != nil {
						return err
					}
				}
				for _, pkgPath := range pkgs {
					pkg, err := gbuild.Import(pkgPath, 0, s.InstallSuffix(), options.BuildTags)
					if s.Watcher != nil && pkg != nil { // add watch even on error
						s.Watcher.Add(pkg.Dir)
					}
					if err != nil {
						return err
					}

					archive, err := s.BuildPackage(pkg)
					if err != nil {
						return err
					}

					if pkg.IsCommand() && !pkg.UpToDate {
						if err := s.WriteCommandPackage(archive, pkg.PkgObj); err != nil {
							return err
						}
					}
				}
				return nil
			}()
			exitCode := handleError(err, options, nil)

			if s.Watcher == nil {
				os.Exit(exitCode)
			}
			s.WaitForChange()
		}
	}

	cmdDoc := &cobra.Command{
		Use:   "doc [arguments]",
		Short: "display documentation for the requested, package, method or symbol",
	}
	cmdDoc.Run = func(cmd *cobra.Command, args []string) {
		goDoc := exec.Command("go", append([]string{"doc"}, args...)...)
		goDoc.Stdout = os.Stdout
		goDoc.Stderr = os.Stderr
		goDoc.Env = append(os.Environ(), "GOARCH=js")
		err := goDoc.Run()
		exitCode := handleError(err, options, nil)
		os.Exit(exitCode)
	}

	cmdGet := &cobra.Command{
		Use:   "get [packages]",
		Short: "download and install packages and dependencies",
	}
	cmdGet.Flags().AddFlagSet(flagVerbose)
	cmdGet.Flags().AddFlagSet(flagQuiet)
	cmdGet.Flags().AddFlagSet(compilerFlags)
	cmdGet.Run = cmdInstall.Run

	cmdRun := &cobra.Command{
		Use:   "run [gofiles...] [arguments...]",
		Short: "compile and run Go program",
	}
	cmdRun.Flags().AddFlagSet(flagVerbose)
	cmdRun.Flags().AddFlagSet(flagQuiet)
	cmdRun.Flags().AddFlagSet(compilerFlags)
	cmdRun.Run = func(cmd *cobra.Command, args []string) {
		err := func() error {
			lastSourceArg := 0
			for {
				if lastSourceArg == len(args) || !(strings.HasSuffix(args[lastSourceArg], ".go") || strings.HasSuffix(args[lastSourceArg], ".inc.js")) {
					break
				}
				lastSourceArg++
			}
			if lastSourceArg == 0 {
				return fmt.Errorf("gopherjs run: no go files listed")
			}

			tempfile, err := ioutil.TempFile(currentDirectory, filepath.Base(args[0])+".")
			if err != nil && strings.HasPrefix(currentDirectory, runtime.GOROOT()) {
				tempfile, err = ioutil.TempFile("", filepath.Base(args[0])+".")
			}
			if err != nil {
				return err
			}
			defer func() {
				tempfile.Close()
				os.Remove(tempfile.Name())
				os.Remove(tempfile.Name() + ".map")
			}()
			s := gbuild.NewSession(options)
			if err := s.BuildFiles(args[:lastSourceArg], tempfile.Name(), currentDirectory); err != nil {
				return err
			}
			if err := runNode(tempfile.Name(), args[lastSourceArg:], "", options.Quiet); err != nil {
				return err
			}
			return nil
		}()
		exitCode := handleError(err, options, nil)

		os.Exit(exitCode)
	}

	cmdTest := &cobra.Command{
		Use:   "test [packages]",
		Short: "test packages",
	}
	bench := cmdTest.Flags().String("bench", "", "Run benchmarks matching the regular expression. By default, no benchmarks run. To run all benchmarks, use '--bench=.'.")
	benchtime := cmdTest.Flags().String("benchtime", "", "Run enough iterations of each benchmark to take t, specified as a time.Duration (for example, -benchtime 1h30s). The default is 1 second (1s).")
	count := cmdTest.Flags().String("count", "", "Run each test and benchmark n times (default 1). Examples are always run once.")
	run := cmdTest.Flags().String("run", "", "Run only those tests and examples matching the regular expression.")
	short := cmdTest.Flags().Bool("short", false, "Tell long-running tests to shorten their run time.")
	verbose := cmdTest.Flags().BoolP("verbose", "v", false, "Log all tests as they are run. Also print all text from Log and Logf calls even if the test succeeds.")
	compileOnly := cmdTest.Flags().BoolP("compileonly", "c", false, "Compile the test binary to pkg.test.js but do not run it (where pkg is the last element of the package's import path). The file name can be changed with the -o flag.")
	outputFilename := cmdTest.Flags().StringP("output", "o", "", "Compile the test binary to the named file. The test still runs (unless -c is specified).")
	cmdTest.Flags().AddFlagSet(compilerFlags)
	cmdTest.Run = func(cmd *cobra.Command, args []string) {
		options.BuildTags = strings.Fields(tags)
		err := func() error {
			// Expand import path patterns.
			patternContext := gbuild.NewBuildContext("", options.BuildTags)
			args = (&gotool.Context{BuildContext: *patternContext}).ImportPaths(args)

			pkgs := make([]*gbuild.PackageData, len(args))
			for i, pkgPath := range args {
				var err error
				pkgs[i], err = gbuild.Import(pkgPath, 0, "", options.BuildTags)
				if err != nil {
					return err
				}
			}

			var exitErr error
			for _, pkg := range pkgs {
				if len(pkg.TestGoFiles) == 0 && len(pkg.XTestGoFiles) == 0 {
					fmt.Printf("?   \t%s\t[no test files]\n", pkg.ImportPath)
					continue
				}
				s := gbuild.NewSession(options)

				tests := &testFuncs{Package: pkg.Package}
				collectTests := func(testPkg *gbuild.PackageData, testPkgName string, needVar *bool) error {
					if testPkgName == "_test" {
						for _, file := range pkg.TestGoFiles {
							if err := tests.load(filepath.Join(pkg.Package.Dir, file), testPkgName, &tests.ImportTest, &tests.NeedTest); err != nil {
								return err
							}
						}
					} else {
						for _, file := range pkg.XTestGoFiles {
							if err := tests.load(filepath.Join(pkg.Package.Dir, file), "_xtest", &tests.ImportXtest, &tests.NeedXtest); err != nil {
								return err
							}
						}
					}
					_, err := s.BuildPackage(testPkg)
					return err
				}

				if err := collectTests(&gbuild.PackageData{
					Package: &build.Package{
						ImportPath: pkg.ImportPath,
						Dir:        pkg.Dir,
						GoFiles:    append(pkg.GoFiles, pkg.TestGoFiles...),
						Imports:    append(pkg.Imports, pkg.TestImports...),
					},
					IsTest:  true,
					JSFiles: pkg.JSFiles,
				}, "_test", &tests.NeedTest); err != nil {
					return err
				}

				if err := collectTests(&gbuild.PackageData{
					Package: &build.Package{
						ImportPath: pkg.ImportPath + "_test",
						Dir:        pkg.Dir,
						GoFiles:    pkg.XTestGoFiles,
						Imports:    pkg.XTestImports,
					},
					IsTest: true,
				}, "_xtest", &tests.NeedXtest); err != nil {
					return err
				}

				buf := new(bytes.Buffer)
				if err := testmainTmpl.Execute(buf, tests); err != nil {
					return err
				}

				fset := token.NewFileSet()
				mainFile, err := parser.ParseFile(fset, "_testmain.go", buf, 0)
				if err != nil {
					return err
				}

				importContext := &compiler.ImportContext{
					Packages: s.Types,
					Import: func(path string) (*compiler.Archive, error) {
						if path == pkg.ImportPath || path == pkg.ImportPath+"_test" {
							return s.Archives[path], nil
						}
						return s.BuildImportPath(path)
					},
				}
				mainPkgArchive, err := compiler.Compile("main", []*ast.File{mainFile}, fset, importContext, options.Minify)
				if err != nil {
					return err
				}

				if *compileOnly && *outputFilename == "" {
					*outputFilename = pkg.Package.Name + "_test.js"
				}

				var outfile *os.File
				if *outputFilename != "" {
					outfile, err = os.Create(*outputFilename)
					if err != nil {
						return err
					}
				} else {
					outfile, err = ioutil.TempFile(currentDirectory, "test.")
					if err != nil {
						return err
					}
				}
				defer func() {
					outfile.Close()
					if *outputFilename == "" {
						os.Remove(outfile.Name())
						os.Remove(outfile.Name() + ".map")
					}
				}()

				if err := s.WriteCommandPackage(mainPkgArchive, outfile.Name()); err != nil {
					return err
				}

				if *compileOnly {
					continue
				}

				var args []string
				if *bench != "" {
					args = append(args, "-test.bench", *bench)
				}
				if *benchtime != "" {
					args = append(args, "-test.benchtime", *benchtime)
				}
				if *count != "" {
					args = append(args, "-test.count", *count)
				}
				if *run != "" {
					args = append(args, "-test.run", *run)
				}
				if *short {
					args = append(args, "-test.short")
				}
				if *verbose {
					args = append(args, "-test.v")
				}
				status := "ok  "
				start := time.Now()
				if err := runNode(outfile.Name(), args, pkg.Dir, options.Quiet); err != nil {
					if _, ok := err.(*exec.ExitError); !ok {
						return err
					}
					exitErr = err
					status = "FAIL"
				}
				fmt.Printf("%s\t%s\t%.3fs\n", status, pkg.ImportPath, time.Since(start).Seconds())
			}
			return exitErr
		}()
		exitCode := handleError(err, options, nil)

		os.Exit(exitCode)
	}

	cmdServe := &cobra.Command{
		Use:   "serve [root]",
		Short: "compile on-the-fly and serve",
	}
	cmdServe.Flags().AddFlagSet(flagVerbose)
	cmdServe.Flags().AddFlagSet(flagQuiet)
	cmdServe.Flags().AddFlagSet(compilerFlags)
	var addr string
	cmdServe.Flags().StringVarP(&addr, "http", "", ":8080", "HTTP bind address to serve")
	cmdServe.Run = func(cmd *cobra.Command, args []string) {
		options.BuildTags = strings.Fields(tags)
		dirs := append(filepath.SplitList(build.Default.GOPATH), build.Default.GOROOT)
		var root string

		if len(args) > 1 {
			cmdServe.HelpFunc()(cmd, args)
			os.Exit(1)
		}

		if len(args) == 1 {
			root = args[0]
		}

		sourceFiles := http.FileServer(serveCommandFileSystem{
			serveRoot:  root,
			options:    options,
			dirs:       dirs,
			sourceMaps: make(map[string][]byte),
		})

		ln, err := net.Listen("tcp", addr)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		if tcpAddr := ln.Addr().(*net.TCPAddr); tcpAddr.IP.Equal(net.IPv4zero) || tcpAddr.IP.Equal(net.IPv6zero) { // Any available addresses.
			fmt.Printf("serving at http://localhost:%d and on port %d of any available addresses\n", tcpAddr.Port, tcpAddr.Port)
		} else { // Specific address.
			fmt.Printf("serving at http://%s\n", tcpAddr)
		}
		fmt.Fprintln(os.Stderr, http.Serve(tcpKeepAliveListener{ln.(*net.TCPListener)}, sourceFiles))
	}

	cmdVersion := &cobra.Command{
		Use:   "version",
		Short: "print GopherJS compiler version",
	}
	cmdVersion.Run = func(cmd *cobra.Command, args []string) {
		if len(args) > 0 {
			cmdServe.HelpFunc()(cmd, args)
			os.Exit(1)
		}

		fmt.Printf("GopherJS %s\n", compiler.Version)
	}

	rootCmd := &cobra.Command{
		Use:  "gopherjs",
		Long: "GopherJS is a tool for compiling Go source code to JavaScript.",
	}
	rootCmd.AddCommand(cmdBuild, cmdGet, cmdInstall, cmdRun, cmdTest, cmdServe, cmdVersion, cmdDoc)
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(2)
	}
}

// tcpKeepAliveListener sets TCP keep-alive timeouts on accepted
// connections. It's used by ListenAndServe and ListenAndServeTLS so
// dead TCP connections (e.g. closing laptop mid-download) eventually
// go away.
type tcpKeepAliveListener struct {
	*net.TCPListener
}

func (ln tcpKeepAliveListener) Accept() (c net.Conn, err error) {
	tc, err := ln.AcceptTCP()
	if err != nil {
		return
	}
	tc.SetKeepAlive(true)
	tc.SetKeepAlivePeriod(3 * time.Minute)
	return tc, nil
}

type serveCommandFileSystem struct {
	serveRoot  string
	options    *gbuild.Options
	dirs       []string
	sourceMaps map[string][]byte
}

func (fs serveCommandFileSystem) Open(requestName string) (http.File, error) {
	name := path.Join(fs.serveRoot, requestName[1:]) // requestName[0] == '/'

	dir, file := path.Split(name)
	base := path.Base(dir) // base is parent folder name, which becomes the output file name.

	isPkg := file == base+".js"
	isMap := file == base+".js.map"
	isIndex := file == "index.html"

	if isPkg || isMap || isIndex {
		// If we're going to be serving our special files, make sure there's a Go command in this folder.
		s := gbuild.NewSession(fs.options)
		pkg, err := gbuild.Import(path.Dir(name), 0, s.InstallSuffix(), fs.options.BuildTags)
		if err != nil || pkg.Name != "main" {
			isPkg = false
			isMap = false
			isIndex = false
		}

		switch {
		case isPkg:
			buf := new(bytes.Buffer)
			browserErrors := new(bytes.Buffer)
			err := func() error {
				archive, err := s.BuildPackage(pkg)
				if err != nil {
					return err
				}

				sourceMapFilter := &compiler.SourceMapFilter{Writer: buf}
				m := &sourcemap.Map{File: base + ".js"}
				sourceMapFilter.MappingCallback = gbuild.NewMappingCallback(m, fs.options.GOROOT, fs.options.GOPATH, fs.options.MapToLocalDisk)

				deps, err := compiler.ImportDependencies(archive, s.BuildImportPath)
				if err != nil {
					return err
				}
				if err := compiler.WriteProgramCode(deps, sourceMapFilter); err != nil {
					return err
				}

				mapBuf := new(bytes.Buffer)
				m.WriteTo(mapBuf)
				buf.WriteString("//# sourceMappingURL=" + base + ".js.map\n")
				fs.sourceMaps[name+".map"] = mapBuf.Bytes()

				return nil
			}()
			handleError(err, fs.options, browserErrors)
			if err != nil {
				buf = browserErrors
			}
			return newFakeFile(base+".js", buf.Bytes()), nil

		case isMap:
			if content, ok := fs.sourceMaps[name]; ok {
				return newFakeFile(base+".js.map", content), nil
			}
		}
	}

	for _, d := range fs.dirs {
		dir := http.Dir(filepath.Join(d, "src"))

		f, err := dir.Open(name)
		if err == nil {
			return f, nil
		}

		// source maps are served outside of serveRoot
		f, err = dir.Open(requestName)
		if err == nil {
			return f, nil
		}
	}

	if isIndex {
		// If there was no index.html file in any dirs, supply our own.
		return newFakeFile("index.html", []byte(`<html><head><meta charset="utf-8"><script src="`+base+`.js"></script></head><body></body></html>`)), nil
	}

	return nil, os.ErrNotExist
}

type fakeFile struct {
	name string
	size int
	io.ReadSeeker
}

func newFakeFile(name string, content []byte) *fakeFile {
	return &fakeFile{name: name, size: len(content), ReadSeeker: bytes.NewReader(content)}
}

func (f *fakeFile) Close() error {
	return nil
}

func (f *fakeFile) Readdir(count int) ([]os.FileInfo, error) {
	return nil, os.ErrInvalid
}

func (f *fakeFile) Stat() (os.FileInfo, error) {
	return f, nil
}

func (f *fakeFile) Name() string {
	return f.name
}

func (f *fakeFile) Size() int64 {
	return int64(f.size)
}

func (f *fakeFile) Mode() os.FileMode {
	return 0
}

func (f *fakeFile) ModTime() time.Time {
	return time.Time{}
}

func (f *fakeFile) IsDir() bool {
	return false
}

func (f *fakeFile) Sys() interface{} {
	return nil
}

// handleError handles err and returns an appropriate exit code.
// If browserErrors is non-nil, errors are written for presentation in browser.
func handleError(err error, options *gbuild.Options, browserErrors *bytes.Buffer) int {
	switch err := err.(type) {
	case nil:
		return 0
	case compiler.ErrorList:
		for _, entry := range err {
			printError(entry, options, browserErrors)
		}
		return 1
	case *exec.ExitError:
		return err.Sys().(syscall.WaitStatus).ExitStatus()
	default:
		printError(err, options, browserErrors)
		return 1
	}
}

// printError prints err to Stderr with options. If browserErrors is non-nil, errors are also written for presentation in browser.
func printError(err error, options *gbuild.Options, browserErrors *bytes.Buffer) {
	e := sprintError(err)
	options.PrintError("%s\n", e)
	if browserErrors != nil {
		fmt.Fprintln(browserErrors, `console.error("`+template.JSEscapeString(e)+`");`)
	}
}

// sprintError returns an annotated error string without trailing newline.
func sprintError(err error) string {
	makeRel := func(name string) string {
		if relname, err := filepath.Rel(currentDirectory, name); err == nil {
			return relname
		}
		return name
	}

	switch e := err.(type) {
	case *scanner.Error:
		return fmt.Sprintf("%s:%d:%d: %s", makeRel(e.Pos.Filename), e.Pos.Line, e.Pos.Column, e.Msg)
	case types.Error:
		pos := e.Fset.Position(e.Pos)
		return fmt.Sprintf("%s:%d:%d: %s", makeRel(pos.Filename), pos.Line, pos.Column, e.Msg)
	default:
		return fmt.Sprintf("%s", e)
	}
}

func runNode(script string, args []string, dir string, quiet bool) error {
	var allArgs []string
	if b, _ := strconv.ParseBool(os.Getenv("SOURCE_MAP_SUPPORT")); os.Getenv("SOURCE_MAP_SUPPORT") == "" || b {
		allArgs = []string{"--require", "source-map-support/register"}
		if err := exec.Command("node", "--require", "source-map-support/register", "--eval", "").Run(); err != nil {
			if !quiet {
				fmt.Fprintln(os.Stderr, "gopherjs: Source maps disabled. Install source-map-support module for nice stack traces. See https://github.com/gopherjs/gopherjs#gopherjs-run-gopherjs-test.")
			}
			allArgs = []string{}
		}
	}

	if runtime.GOOS != "windows" {
		// We've seen issues with stack space limits causing
		// recursion-heavy standard library tests to fail (e.g., see
		// https://github.com/gopherjs/gopherjs/pull/669#issuecomment-319319483).
		//
		// There are two separate limits in non-Windows environments:
		//
		// -	OS process limit
		// -	Node.js (V8) limit
		//
		// GopherJS fetches the current OS process limit, and sets the
		// Node.js limit to the same value. So both limits are kept in sync
		// and can be controlled by setting OS process limit. E.g.:
		//
		// 	ulimit -s 10000 && gopherjs test
		//
		cur, err := sysutil.RlimitStack()
		if err != nil {
			return fmt.Errorf("failed to get stack size limit: %v", err)
		}
		allArgs = append(allArgs, fmt.Sprintf("--stack_size=%v", cur/1000)) // Convert from bytes to KB.
	}

	allArgs = append(allArgs, script)
	allArgs = append(allArgs, args...)

	node := exec.Command("node", allArgs...)
	node.Dir = dir
	node.Stdin = os.Stdin
	node.Stdout = os.Stdout
	node.Stderr = os.Stderr
	err := node.Run()
	if _, ok := err.(*exec.ExitError); err != nil && !ok {
		err = fmt.Errorf("could not run Node.js: %s", err.Error())
	}
	return err
}

type testFuncs struct {
	Tests       []testFunc
	Benchmarks  []testFunc
	Examples    []testFunc
	TestMain    *testFunc
	Package     *build.Package
	ImportTest  bool
	NeedTest    bool
	ImportXtest bool
	NeedXtest   bool
}

type testFunc struct {
	Package   string // imported package name (_test or _xtest)
	Name      string // function name
	Output    string // output, for examples
	Unordered bool   // output is allowed to be unordered.
}

var testFileSet = token.NewFileSet()

func (t *testFuncs) load(filename, pkg string, doImport, seen *bool) error {
	f, err := parser.ParseFile(testFileSet, filename, nil, parser.ParseComments)
	if err != nil {
		return err
	}
	for _, d := range f.Decls {
		n, ok := d.(*ast.FuncDecl)
		if !ok {
			continue
		}
		if n.Recv != nil {
			continue
		}
		name := n.Name.String()
		switch {
		case isTestMain(n):
			if t.TestMain != nil {
				return errors.New("multiple definitions of TestMain")
			}
			t.TestMain = &testFunc{pkg, name, "", false}
			*doImport, *seen = true, true
		case isTest(name, "Test"):
			t.Tests = append(t.Tests, testFunc{pkg, name, "", false})
			*doImport, *seen = true, true
		case isTest(name, "Benchmark"):
			t.Benchmarks = append(t.Benchmarks, testFunc{pkg, name, "", false})
			*doImport, *seen = true, true
		}
	}
	ex := doc.Examples(f)
	sort.Sort(byOrder(ex))
	for _, e := range ex {
		*doImport = true // import test file whether executed or not
		if e.Output == "" && !e.EmptyOutput {
			// Don't run examples with no output.
			continue
		}
		t.Examples = append(t.Examples, testFunc{pkg, "Example" + e.Name, e.Output, e.Unordered})
		*seen = true
	}

	return nil
}

type byOrder []*doc.Example

func (x byOrder) Len() int           { return len(x) }
func (x byOrder) Swap(i, j int)      { x[i], x[j] = x[j], x[i] }
func (x byOrder) Less(i, j int) bool { return x[i].Order < x[j].Order }

// isTestMain tells whether fn is a TestMain(m *testing.M) function.
func isTestMain(fn *ast.FuncDecl) bool {
	if fn.Name.String() != "TestMain" ||
		fn.Type.Results != nil && len(fn.Type.Results.List) > 0 ||
		fn.Type.Params == nil ||
		len(fn.Type.Params.List) != 1 ||
		len(fn.Type.Params.List[0].Names) > 1 {
		return false
	}
	ptr, ok := fn.Type.Params.List[0].Type.(*ast.StarExpr)
	if !ok {
		return false
	}
	// We can't easily check that the type is *testing.M
	// because we don't know how testing has been imported,
	// but at least check that it's *M or *something.M.
	if name, ok := ptr.X.(*ast.Ident); ok && name.Name == "M" {
		return true
	}
	if sel, ok := ptr.X.(*ast.SelectorExpr); ok && sel.Sel.Name == "M" {
		return true
	}
	return false
}

// isTest tells whether name looks like a test (or benchmark, according to prefix).
// It is a Test (say) if there is a character after Test that is not a lower-case letter.
// We don't want TesticularCancer.
func isTest(name, prefix string) bool {
	if !strings.HasPrefix(name, prefix) {
		return false
	}
	if len(name) == len(prefix) { // "Test" is ok
		return true
	}
	rune, _ := utf8.DecodeRuneInString(name[len(prefix):])
	return !unicode.IsLower(rune)
}

var testmainTmpl = template.Must(template.New("main").Parse(`
package main

import (
{{if not .TestMain}}
	"os"
{{end}}
	"testing"
	"testing/internal/testdeps"

{{if .ImportTest}}
	{{if .NeedTest}}_test{{else}}_{{end}} {{.Package.ImportPath | printf "%q"}}
{{end}}
{{if .ImportXtest}}
	{{if .NeedXtest}}_xtest{{else}}_{{end}} {{.Package.ImportPath | printf "%s_test" | printf "%q"}}
{{end}}
)

var tests = []testing.InternalTest{
{{range .Tests}}
	{"{{.Name}}", {{.Package}}.{{.Name}}},
{{end}}
}

var benchmarks = []testing.InternalBenchmark{
{{range .Benchmarks}}
	{"{{.Name}}", {{.Package}}.{{.Name}}},
{{end}}
}

var examples = []testing.InternalExample{
{{range .Examples}}
	{"{{.Name}}", {{.Package}}.{{.Name}}, {{.Output | printf "%q"}}, {{.Unordered}}},
{{end}}
}

func main() {
	m := testing.MainStart(testdeps.TestDeps{}, tests, benchmarks, examples)
{{with .TestMain}}
	{{.Package}}.{{.Name}}(m)
{{else}}
	os.Exit(m.Run())
{{end}}
}

`))
