package validation

import "github.com/grafana/dskit/flagext"

type BlockedQuery struct {
	Pattern string                 `yaml:"pattern"`
	Regex   bool                   `yaml:"regex"`
	Hash    uint32                 `yaml:"hash"`
	Types   flagext.StringSliceCSV `yaml:"types"`
}
