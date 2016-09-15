package commands

import (
	"github.com/grafana/grafana-cli/pkg/log"
	"github.com/grafana/grafana-cli/pkg/services"
)

func listremoteCommand(c CommandLine) error {
	plugin, err := services.ListAllPlugins()

	if err != nil {
		return err
	}

	for _, i := range plugin.Plugins {
		log.Infof("id: %v version:\n", i.Id)
	}

	return nil
}
