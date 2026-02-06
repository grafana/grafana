package clusterutil

import (
	"flag"
	"fmt"

	"github.com/grafana/dskit/flagext"
)

type ClusterValidationConfig struct {
	Label           string                  `yaml:"label" category:"experimental"`
	registeredFlags flagext.RegisteredFlags `yaml:"-"`
}

func (cfg *ClusterValidationConfig) RegisterFlagsWithPrefix(prefix string, f *flag.FlagSet) {
	cfg.registeredFlags = flagext.TrackRegisteredFlags(prefix, f, func(prefix string, f *flag.FlagSet) {
		f.StringVar(&cfg.Label, prefix+"label", "", "Primary cluster validation label.")
	})
}

func (cfg *ClusterValidationConfig) RegisteredFlags() flagext.RegisteredFlags {
	return cfg.registeredFlags
}

type ServerClusterValidationConfig struct {
	ClusterValidationConfig `yaml:",inline"`
	AdditionalLabels        flagext.StringSliceCSV                 `yaml:"additional_labels" category:"experimental"`
	GRPC                    ClusterValidationProtocolConfig        `yaml:"grpc" category:"experimental"`
	HTTP                    ClusterValidationProtocolConfigForHTTP `yaml:"http" category:"experimental"`
	registeredFlags         flagext.RegisteredFlags                `yaml:"-"`
}

// GetAllowedClusterLabels returns the effective cluster validation labels.
// It combines the primary Label with any AdditionalLabels.
// The primary Label is always first if present, followed by AdditionalLabels.
func (cfg *ServerClusterValidationConfig) GetAllowedClusterLabels() []string {
	if cfg.Label == "" && len(cfg.AdditionalLabels) == 0 {
		return nil
	}

	var labels []string
	if cfg.Label != "" {
		labels = append(labels, cfg.Label)
	}
	labels = append(labels, cfg.AdditionalLabels...)
	return labels
}

func (cfg *ServerClusterValidationConfig) Validate() error {
	// Validate that additional labels require primary label to be set
	if len(cfg.AdditionalLabels) > 0 && cfg.Label == "" {
		return fmt.Errorf("additional cluster validation labels require primary label to be set")
	}

	// Protocol validation only checks against the primary label
	err := cfg.GRPC.Validate("grpc", cfg.Label)
	if err != nil {
		return err
	}
	return cfg.HTTP.Validate("http", cfg.Label)
}

func (cfg *ServerClusterValidationConfig) RegisterFlagsWithPrefix(prefix string, f *flag.FlagSet) {
	cfg.registeredFlags = flagext.TrackRegisteredFlags(prefix, f, func(prefix string, f *flag.FlagSet) {
		cfg.ClusterValidationConfig.RegisterFlagsWithPrefix(prefix, f)
		f.Var(&cfg.AdditionalLabels, prefix+"additional-labels", "Comma-separated list of additional cluster validation labels that the server will accept from incoming requests.")
		cfg.GRPC.RegisterFlagsWithPrefix(prefix+"grpc.", f)
		cfg.HTTP.RegisterFlagsWithPrefix(prefix+"http.", f)
	})
}

func (cfg *ServerClusterValidationConfig) RegisteredFlags() flagext.RegisteredFlags {
	return cfg.registeredFlags
}

type ClusterValidationProtocolConfig struct {
	Enabled        bool `yaml:"enabled" category:"experimental"`
	SoftValidation bool `yaml:"soft_validation" category:"experimental"`
}

func (cfg *ClusterValidationProtocolConfig) Validate(prefix string, label string) error {
	if label == "" {
		if cfg.Enabled || cfg.SoftValidation {
			return fmt.Errorf("%s: validation cannot be enabled if cluster validation label is not configured", prefix)
		}
		return nil
	}

	if !cfg.Enabled && cfg.SoftValidation {
		return fmt.Errorf("%s: soft validation can be enabled only if cluster validation is enabled", prefix)
	}
	return nil
}

func (cfg *ClusterValidationProtocolConfig) RegisterFlagsWithPrefix(prefix string, f *flag.FlagSet) {
	softValidationFlag := prefix + "soft-validation"
	enabledFlag := prefix + "enabled"
	f.BoolVar(&cfg.SoftValidation, softValidationFlag, false, fmt.Sprintf("When enabled, soft cluster label validation is executed. Can be enabled only together with %s", enabledFlag))
	f.BoolVar(&cfg.Enabled, enabledFlag, false, "When enabled, cluster label validation is executed: configured cluster validation label is compared with the cluster validation label received through the requests.")
}

type ClusterValidationProtocolConfigForHTTP struct {
	ClusterValidationProtocolConfig `yaml:",inline"`
	ExcludedPaths                   flagext.StringSliceCSV `yaml:"excluded_paths" category:"experimental"`
	ExcludedUserAgents              flagext.StringSliceCSV `yaml:"excluded_user_agents" category:"experimental"`
}

func (cfg *ClusterValidationProtocolConfigForHTTP) RegisterFlagsWithPrefix(prefix string, f *flag.FlagSet) {
	cfg.ClusterValidationProtocolConfig.RegisterFlagsWithPrefix(prefix, f)
	f.Var(&cfg.ExcludedPaths, prefix+"excluded-paths", "Comma-separated list of url paths that are excluded from the cluster validation check.")
	f.Var(&cfg.ExcludedUserAgents, prefix+"excluded-user-agents", "Comma-separated list of user agents that are excluded from the cluster validation check.")
}
