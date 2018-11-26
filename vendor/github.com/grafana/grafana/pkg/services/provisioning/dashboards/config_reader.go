package dashboards

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	yaml "gopkg.in/yaml.v2"
)

type configReader struct {
	path string
	log  log.Logger
}

func (cr *configReader) parseConfigs(file os.FileInfo) ([]*DashboardsAsConfig, error) {
	filename, _ := filepath.Abs(filepath.Join(cr.path, file.Name()))
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	apiVersion := &ConfigVersion{ApiVersion: 0}
	yaml.Unmarshal(yamlFile, &apiVersion)

	if apiVersion.ApiVersion > 0 {

		v1 := &DashboardAsConfigV1{}
		err := yaml.Unmarshal(yamlFile, &v1)
		if err != nil {
			return nil, err
		}

		if v1 != nil {
			return v1.mapToDashboardAsConfig(), nil
		}

	} else {
		var v0 []*DashboardsAsConfigV0
		err := yaml.Unmarshal(yamlFile, &v0)
		if err != nil {
			return nil, err
		}

		if v0 != nil {
			cr.log.Warn("[Deprecated] the dashboard provisioning config is outdated. please upgrade", "filename", filename)
			return mapV0ToDashboardAsConfig(v0), nil
		}
	}

	return []*DashboardsAsConfig{}, nil
}

func (cr *configReader) readConfig() ([]*DashboardsAsConfig, error) {
	var dashboards []*DashboardsAsConfig

	files, err := ioutil.ReadDir(cr.path)
	if err != nil {
		cr.log.Error("can't read dashboard provisioning files from directory", "path", cr.path)
		return dashboards, nil
	}

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".yaml") && !strings.HasSuffix(file.Name(), ".yml") {
			continue
		}

		parsedDashboards, err := cr.parseConfigs(file)
		if err != nil {
			return nil, err
		}

		if len(parsedDashboards) > 0 {
			dashboards = append(dashboards, parsedDashboards...)
		}
	}

	for i := range dashboards {
		if dashboards[i].OrgId == 0 {
			dashboards[i].OrgId = 1
		}

		if dashboards[i].UpdateIntervalSeconds == 0 {
			dashboards[i].UpdateIntervalSeconds = 10
		}
	}

	return dashboards, nil
}
