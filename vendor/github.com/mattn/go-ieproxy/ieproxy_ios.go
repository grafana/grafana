//go:build ios || iossimulator
// +build ios iossimulator

package ieproxy

func getConf() ProxyConf {
	return ProxyConf{}
}

func reloadConf() ProxyConf {
	return getConf()
}

func overrideEnvWithStaticProxy(pc ProxyConf, setenv envSetter) {
}
