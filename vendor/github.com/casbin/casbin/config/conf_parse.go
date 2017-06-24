// Copyright 2017 The casbin Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

type casbinConfig struct {
	ModelPath     string
	PolicyBackend string
	PolicyPath    string
	DBDriver      string
	DBDataSource  string
}

// LoadConfig loads the casbin config file: casbin.conf
func LoadConfig(cfgPath string) *casbinConfig {
	ccfg := casbinConfig{}
	cfg, err := NewConfig(cfgPath)
	if err != nil {
		panic(err)
	}

	ccfg.ModelPath = cfg.String("default::model_path")
	ccfg.PolicyBackend = cfg.String("default::policy_backend")

	if ccfg.PolicyBackend == "file" {
		ccfg.PolicyPath = cfg.String("file::policy_path")
	} else if ccfg.PolicyBackend == "database" {
		ccfg.DBDriver = cfg.String("database::driver")
		ccfg.DBDataSource = cfg.String("database::data_source")
	}

	return &ccfg
}
