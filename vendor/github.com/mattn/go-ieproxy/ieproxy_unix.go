//go:build !windows && (!darwin || !cgo)
// +build !windows
// +build !darwin !cgo

package ieproxy

func getConf() ProxyConf {
	return ProxyConf{}
}

func reloadConf() ProxyConf {
	return getConf()
}

func overrideEnvWithStaticProxy(pc ProxyConf, setenv envSetter) {
}
