package build

import (
	"bufio"
	"embed"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
	bra "github.com/unknwon/bra/cmd"
	"github.com/urfave/cli"

	"github.com/grafana/grafana-plugin-sdk-go/build/utils"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e"
	ca "github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/certificate_authority"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/fixture"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/storage"
	"github.com/grafana/grafana-plugin-sdk-go/internal"
)

var (
	defaultOutputBinaryPath     = "dist"
	defaultPluginJSONPath       = "src"
	defaultNestedDataSourcePath = "datasource"
)

// Callbacks give you a way to run custom behavior when things happen
var beforeBuild = func(cfg Config) (Config, error) {
	return cfg, nil
}

// SetBeforeBuildCallback configures a custom callback
func SetBeforeBuildCallback(cb BeforeBuildCallback) error {
	beforeBuild = cb
	return nil
}

var exname string

// Deprecated: Use getExecutableNameForPlugin instead.
// getExecutableName returns the name of the executable for the current platform.
// It reads the plugin.json from the directory specified in `pluginJSONPath`. It uses internal.GetExecutableFromPluginJSON
// which will also retrieve the executable from a nested datasource directory which may not be the desired behavior.
func getExecutableName(os string, arch string, pluginJSONPath string) (string, error) {
	if exname == "" {
		exename, err := internal.GetExecutableFromPluginJSON(pluginJSONPath)
		if err != nil {
			return "", err
		}

		exname = exename
	}

	return asExecutableName(os, arch, exname), nil
}

// execNameCache is a cache for the executable name, so we don't have to read the plugin.json file multiple times.
var executableNameCache sync.Map

// getExecutableNameForPlugin returns the name of the executable from the plugin.json file in the provided directory.
// The executable name is cached to avoid reading the same file multiple times.
// If found, the executable name is returned in the format: <executable>_<os>_<arch>
func getExecutableNameForPlugin(os string, arch string, pluginDir string) (string, error) {
	if cached, ok := executableNameCache.Load(pluginDir); ok {
		return asExecutableName(os, arch, cached.(string)), nil
	}
	exe, err := internal.GetStringValueFromJSON(path.Join(pluginDir, "plugin.json"), "executable")
	if err != nil {
		return "", err
	}

	executableNameCache.Store(pluginDir, exe)

	return asExecutableName(os, arch, exe), nil
}

func asExecutableName(os string, arch string, exe string) string {
	exeName := fmt.Sprintf("%s_%s_%s", exe, os, arch)
	if os == "windows" {
		exeName = fmt.Sprintf("%s.exe", exeName)
	}
	return exeName
}

func buildBackend(cfg Config) error {
	cfg, args, err := getBuildBackendCmdInfo(cfg)
	if err != nil {
		return err
	}

	err = sh.RunWithV(cfg.Env, "go", args...)
	if err != nil {
		return err
	}
	b := Build{}
	return b.GenerateManifestFile()
}

func getBuildBackendCmdInfo(cfg Config) (Config, []string, error) {
	cfg, err := beforeBuild(cfg)
	if err != nil {
		return cfg, []string{}, err
	}

	pluginJSONPath := defaultPluginJSONPath
	if cfg.PluginJSONPath != "" {
		pluginJSONPath = cfg.PluginJSONPath
	}
	exePath, err := getExecutableNameForPlugin(cfg.OS, cfg.Arch, pluginJSONPath)
	if err != nil {
		// Look for a nested backend data source plugin
		nestedPluginJSONPath := defaultNestedDataSourcePath
		exe, err2 := getExecutableNameForPlugin(cfg.OS, cfg.Arch, filepath.Join(pluginJSONPath, nestedPluginJSONPath))
		if err2 != nil {
			// return the original error
			return cfg, []string{}, err
		}
		// For backwards compatibility, if the executable is in the root directory, strip that information.
		if strings.HasPrefix(exe, "../") {
			exePath = exe[3:]
		} else {
			// Make sure the executable is in the relevant nested plugin directory.
			exePath = filepath.Join(nestedPluginJSONPath, exe)
		}
	}

	ldFlags := ""
	if !cfg.EnableCGo {
		// Link statically
		ldFlags = `-extldflags "-static"`
	}

	if !cfg.EnableDebug {
		// Add linker flags to drop debug information
		prefix := ""
		if ldFlags != "" {
			prefix = " "
		}
		ldFlags = fmt.Sprintf("-w -s%s%s", prefix, ldFlags)
	}

	outputPath := cfg.OutputBinaryPath
	if outputPath == "" {
		outputPath = defaultOutputBinaryPath
	}
	args := []string{
		"build", "-o", filepath.Join(outputPath, exePath),
	}

	info := Info{
		Time: now().UnixNano() / int64(time.Millisecond),
	}
	pluginID, err := internal.GetStringValueFromJSON(filepath.Join(pluginJSONPath, "plugin.json"), "id")
	if err == nil && len(pluginID) > 0 {
		info.PluginID = pluginID
	}
	version, err := internal.GetStringValueFromJSON("package.json", "version")
	if err == nil && len(version) > 0 {
		info.Version = version
	}

	args = append(args, "-tags", "arrow_json_stdlib")

	flags := make(map[string]string, 10)
	info.appendFlags(flags)

	if cfg.CustomVars != nil {
		for k, v := range cfg.CustomVars {
			flags[k] = v
		}
	}

	// Sort the flags to ensure a consistent build command
	flagsKeys := make([]string, 0, len(flags))
	for k := range flags {
		flagsKeys = append(flagsKeys, k)
	}
	sort.Strings(flagsKeys)

	for _, k := range flagsKeys {
		ldFlags = fmt.Sprintf("%s -X '%s=%s'", ldFlags, k, flags[k])
	}
	args = append(args, "-ldflags", ldFlags)

	if cfg.EnableDebug {
		args = append(args, "-gcflags=all=-N -l")
	}
	rootPackage := "./pkg"
	if cfg.RootPackagePath != "" {
		rootPackage = cfg.RootPackagePath
	}
	args = append(args, rootPackage)

	cfg.Env["GOARCH"] = cfg.Arch
	cfg.Env["GOOS"] = cfg.OS
	if !cfg.EnableCGo {
		cfg.Env["CGO_ENABLED"] = "0"
	}
	return cfg, args, nil
}

func newBuildConfig(os string, arch string) Config {
	return Config{
		OS:          os,
		Arch:        arch,
		EnableDebug: false,
		Env:         map[string]string{},
	}
}

// Build is a namespace.
type Build mg.Namespace

// Linux builds the back-end plugin for Linux.
func (Build) Linux() error {
	return buildBackend(newBuildConfig("linux", "amd64"))
}

// LinuxARM builds the back-end plugin for Linux on ARM.
func (Build) LinuxARM() error {
	return buildBackend(newBuildConfig("linux", "arm"))
}

// LinuxARM64 builds the back-end plugin for Linux on ARM64.
func (Build) LinuxARM64() error {
	return buildBackend(newBuildConfig("linux", "arm64"))
}

// Windows builds the back-end plugin for Windows.
func (Build) Windows() error {
	return buildBackend(newBuildConfig("windows", "amd64"))
}

// Darwin builds the back-end plugin for OSX on AMD64.
func (Build) Darwin() error {
	return buildBackend(newBuildConfig("darwin", "amd64"))
}

// DarwinARM64 builds the back-end plugin for OSX on ARM (M1/M2).
func (Build) DarwinARM64() error {
	return buildBackend(newBuildConfig("darwin", "arm64"))
}

// Custom allows customizable back-end plugin builds for the provided os and arch.
// Note: Cutomized builds are not officially supported by Grafana, so this option is intended for developers who need
// to create their own custom build targets.
func (Build) Custom(os, arch string) error {
	return buildBackend(newBuildConfig(os, arch))
}

// GenerateManifestFile generates a manifest file for plugin submissions
func (Build) GenerateManifestFile() error {
	config := Config{}
	config, err := beforeBuild(config)
	if err != nil {
		return err
	}
	outputPath := config.OutputBinaryPath
	if outputPath == "" {
		outputPath = defaultOutputBinaryPath
	}
	manifestContent, err := utils.GenerateManifest()
	if err != nil {
		return err
	}

	manifestFilePath := filepath.Join(outputPath, "go_plugin_build_manifest")
	err = os.MkdirAll(outputPath, 0755)
	if err != nil {
		return err
	}
	// #nosec G306 - we need reading permissions for this file
	err = os.WriteFile(manifestFilePath, []byte(manifestContent), 0755)
	if err != nil {
		return err
	}
	return nil
}

// Debug builds the debug version for the current platform.
func (Build) Debug() error {
	cfg := newBuildConfig(runtime.GOOS, runtime.GOARCH)
	cfg.EnableDebug = true
	return buildBackend(cfg)
}

// DebugLinuxAMD64 builds the debug version targeted for linux on AMD64.
func (Build) DebugLinuxAMD64() error {
	cfg := newBuildConfig("linux", "amd64")
	cfg.EnableDebug = true
	return buildBackend(cfg)
}

// DebugLinuxARM64 builds the debug version targeted for linux on ARM64.
func (Build) DebugLinuxARM64() error {
	cfg := newBuildConfig("linux", "arm64")
	cfg.EnableDebug = true
	return buildBackend(cfg)
}

// DebugDarwinAMD64 builds the debug version targeted for OSX on AMD64.
func (Build) DebugDarwinAMD64() error {
	cfg := newBuildConfig("darwin", "amd64")
	cfg.EnableDebug = true
	return buildBackend(cfg)
}

// DebugDarwinARM64 builds the debug version targeted for OSX on ARM (M1/M2).
func (Build) DebugDarwinARM64() error {
	cfg := newBuildConfig("darwin", "arm64")
	cfg.EnableDebug = true
	return buildBackend(cfg)
}

// DebugWindowsAMD64 builds the debug version targeted for windows on AMD64.
func (Build) DebugWindowsAMD64() error {
	cfg := newBuildConfig("windows", "amd64")
	cfg.EnableDebug = true
	return buildBackend(cfg)
}

// Backend build a production build for the current platform
func (Build) Backend() error {
	// The M1 platform detection is kinda flakey, so we will just build both
	if runtime.GOOS == "darwin" {
		err := buildBackend(newBuildConfig("darwin", "arm64"))
		if err != nil {
			return err
		}
		return buildBackend(newBuildConfig("darwin", "amd64"))
	}
	cfg := newBuildConfig(runtime.GOOS, runtime.GOARCH)
	return buildBackend(cfg)
}

// BuildAll builds production executables for all supported platforms.
func BuildAll() { //revive:disable-line
	b := Build{}
	mg.Deps(b.Linux, b.Windows, b.Darwin, b.DarwinARM64, b.LinuxARM64, b.LinuxARM)
}

//go:embed tmpl/*
var tmpl embed.FS

// ensureWatchConfig creates a default .bra.toml file in the current directory if it doesn't exist.
func ensureWatchConfig() error {
	exists, err := utils.Exists(".bra.toml")
	if err != nil {
		return err
	}

	if exists {
		return nil
	}

	fmt.Println("No .bra.toml file found. Creating one...")
	config, err := tmpl.ReadFile("tmpl/bra.toml")
	if err != nil {
		return err
	}

	return os.WriteFile(".bra.toml", config, 0600)
}

// Watch rebuilds the plugin backend debug version when files change.
func Watch() error {
	if err := ensureWatchConfig(); err != nil {
		return err
	}

	// this is needed to run `bra run` programmatically
	app := cli.NewApp()
	app.Name = "bra"
	app.Usage = ""
	app.Action = func(c *cli.Context) error {
		return bra.Run.Run(c)
	}
	return app.Run(os.Args)
}

// Test runs backend tests.
func Test() error {
	return sh.RunV("go", "test", "./pkg/...")
}

// TestRace runs backend tests with the data race detector enabled.
func TestRace() error {
	return sh.RunV("go", "test", "-race", "./pkg/...")
}

// Coverage runs backend tests and makes a coverage report.
func Coverage() error {
	// Create a coverage folder if it does not already exist
	if err := os.MkdirAll(filepath.Join(".", "coverage"), os.ModePerm); err != nil {
		return err
	}

	if err := sh.RunV("go", "test", "./pkg/...", "-coverpkg", "./...", "-v", "-cover", "-coverprofile=coverage/backend.out"); err != nil {
		return err
	}

	if err := sh.RunV("go", "tool", "cover", "-func=coverage/backend.out", "-o", "coverage/backend.txt"); err != nil {
		return err
	}

	return sh.RunV("go", "tool", "cover", "-html=coverage/backend.out", "-o", "coverage/backend.html")
}

// Lint audits the source style
func Lint() error {
	return sh.RunV("golangci-lint", "run", "./...")
}

// Format formats the sources.
func Format() error {
	return sh.RunV("gofmt", "-w", ".")
}

// Clean cleans build artifacts, by deleting the dist directory.
func Clean() error {
	err := os.RemoveAll("dist")
	if err != nil {
		return err
	}

	err = os.RemoveAll("coverage")
	if err != nil {
		return err
	}

	err = os.RemoveAll("ci")
	if err != nil {
		return err
	}
	return nil
}

// E2E is a namespace.
type E2E mg.Namespace

// Append starts the E2E proxy in append mode.
func (E2E) Append() error {
	return e2eProxy(e2e.ProxyModeAppend)
}

// Overwrite starts the E2E proxy in overwrite mode.
func (E2E) Overwrite() error {
	return e2eProxy(e2e.ProxyModeOverwrite)
}

// Replay starts the E2E proxy in replay mode.
func (E2E) Replay() error {
	return e2eProxy(e2e.ProxyModeReplay)
}

// Certificate prints the CA certificate to stdout.
func (E2E) Certificate() error {
	cfg, err := config.LoadConfig("proxy.json")
	if err != nil {
		return err
	}

	if cert, _, err := ca.LoadKeyPair(cfg.CAConfig.Cert, cfg.CAConfig.PrivateKey); err == nil {
		fmt.Print(string(cert))
		return nil
	}

	fmt.Print(string(ca.CACertificate))
	return nil
}

func e2eProxy(mode e2e.ProxyMode) error {
	cfg, err := config.LoadConfig("proxy.json")
	if err != nil {
		return err
	}
	fixtures := make([]*fixture.Fixture, 0)
	for _, s := range cfg.Storage {
		switch s.Type {
		case config.StorageTypeHAR:
			store := storage.NewHARStorage(s.Path)
			fixtures = append(fixtures, fixture.NewFixture(store))
		case config.StorageTypeOpenAPI:
			store := storage.NewOpenAPIStorage(s.Path)
			fixtures = append(fixtures, fixture.NewFixture(store))
		}
	}
	proxy := e2e.NewProxy(mode, fixtures, cfg)
	return proxy.Start()
}

// checkLinuxPtraceScope verifies that ptrace is configured as required.
func checkLinuxPtraceScope() error {
	ptracePath := "/proc/sys/kernel/yama/ptrace_scope"
	byteValue, err := os.ReadFile(ptracePath)
	if err != nil {
		return fmt.Errorf("unable to read ptrace_scope: %w", err)
	}
	val := strings.TrimSpace(string(byteValue))
	if val != "0" {
		log.Printf("WARNING:")
		fmt.Printf("ptrace_scope set to value other than 0 (currently: %s), this might prevent debugger from connecting\n", val)
		fmt.Printf("try writing \"0\" to %s\n", ptracePath)
		fmt.Printf("Set ptrace_scope to 0? y/N (default N)\n")

		scanner := bufio.NewScanner(os.Stdin)
		if scanner.Scan() {
			if scanner.Text() == "y" || scanner.Text() == "Y" {
				// if err := sh.RunV("echo", "0", "|", "sudo", "tee", ptracePath); err != nil {
				// 	return // Error?
				// }
				log.Printf("TODO, run: echo 0 | sudo tee /proc/sys/kernel/yama/ptrace_scope")
			} else {
				fmt.Printf("Did not write\n")
			}
		}
	}

	return nil
}
