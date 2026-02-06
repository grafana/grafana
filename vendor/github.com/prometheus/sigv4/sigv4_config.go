// Copyright 2021 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sigv4

import (
	"fmt"

	"github.com/prometheus/common/config"
)

// SigV4Config is the configuration for signing remote write requests with
// AWS's SigV4 verification process. Empty values will be retrieved using the
// AWS default credentials chain.
type SigV4Config struct {
	Region             string        `yaml:"region,omitempty"`
	AccessKey          string        `yaml:"access_key,omitempty"`
	SecretKey          config.Secret `yaml:"secret_key,omitempty"`
	Profile            string        `yaml:"profile,omitempty"`
	RoleARN            string        `yaml:"role_arn,omitempty"`
	UseFIPSSTSEndpoint bool          `yaml:"use_fips_sts_endpoint,omitempty"`
}

func (c *SigV4Config) Validate() error {
	if (c.AccessKey == "") != (c.SecretKey == "") {
		return fmt.Errorf("must provide a AWS SigV4 Access key and Secret Key if credentials are specified in the SigV4 config")
	}
	return nil
}

func (c *SigV4Config) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain SigV4Config
	*c = SigV4Config{}
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	return c.Validate()
}
