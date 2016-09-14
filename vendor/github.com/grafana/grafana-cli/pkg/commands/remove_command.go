package commands

import (
	"errors"
	"github.com/grafana/grafana-cli/pkg/log"
	m "github.com/grafana/grafana-cli/pkg/models"
	services "github.com/grafana/grafana-cli/pkg/services"
)

var getPluginss func(path string) []m.InstalledPlugin = services.GetLocalPlugins
var removePlugin func(pluginPath, id string) error = services.RemoveInstalledPlugin

func removeCommand(c CommandLine) error {
	pluginPath := c.GlobalString("path")
	localPlugins := getPluginss(pluginPath)

	log.Info("remove!\n")

	plugin := c.Args().First()
	log.Info("plugin: " + plugin + "\n")
	if plugin == "" {
		return errors.New("Missing which plugin parameter")
	}

	log.Infof("plugins : \n%v\n", localPlugins)

	for _, p := range localPlugins {
		log.Infof("is %s == %s ? %v", p.Id, c.Args().First(), p.Id == c.Args().First())
		if p.Id == c.Args().First() {
			removePlugin(pluginPath, p.Id)
		}
	}

	return nil
}
