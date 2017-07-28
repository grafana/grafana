// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "context"

// HasPlugin indicates whether the cluster has the named plugin.
func (c *Client) HasPlugin(name string) (bool, error) {
	plugins, err := c.Plugins()
	if err != nil {
		return false, nil
	}
	for _, plugin := range plugins {
		if plugin == name {
			return true, nil
		}
	}
	return false, nil
}

// Plugins returns the list of all registered plugins.
func (c *Client) Plugins() ([]string, error) {
	stats, err := c.ClusterStats().Do(context.Background())
	if err != nil {
		return nil, err
	}
	if stats == nil {
		return nil, err
	}
	if stats.Nodes == nil {
		return nil, err
	}
	var plugins []string
	for _, plugin := range stats.Nodes.Plugins {
		plugins = append(plugins, plugin.Name)
	}
	return plugins, nil
}
