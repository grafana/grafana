// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package cmdrunner

// addrTranslator implements stateless identity functions, as the host and plugin
// run in the same context wrt Unix and network addresses.
type addrTranslator struct{}

func (*addrTranslator) PluginToHost(pluginNet, pluginAddr string) (string, string, error) {
	return pluginNet, pluginAddr, nil
}

func (*addrTranslator) HostToPlugin(hostNet, hostAddr string) (string, string, error) {
	return hostNet, hostAddr, nil
}
