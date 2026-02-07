package build

// Config holds the setup variables required for a build
type Config struct {
	OS               string // GOOS
	Arch             string // GOOS
	EnableDebug      bool
	CustomVars       map[string]string
	Env              map[string]string
	EnableCGo        bool
	RootPackagePath  string
	OutputBinaryPath string
	PluginJSONPath   string
}

// BeforeBuildCallback hooks into the build process
type BeforeBuildCallback func(cfg Config) (Config, error)
