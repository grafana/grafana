package ieproxy

import (
	"strings"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

type regeditValues struct {
	ProxyServer   string
	ProxyOverride string
	ProxyEnable   uint64
	AutoConfigURL string
}

var once sync.Once
var windowsProxyConf ProxyConf

// GetConf retrieves the proxy configuration from the Windows Regedit
func getConf() ProxyConf {
	once.Do(writeConf)
	return windowsProxyConf
}

// reloadConf forces a reload of the proxy configuration from the Windows registry
func reloadConf() ProxyConf {
	writeConf()
	return getConf()
}

func writeConf() {
	proxy := ""
	proxyByPass := ""
	autoConfigUrl := ""
	autoDetect := false

	// Try from IE first.
	if ieCfg, err := getUserConfigFromWindowsSyscall(); err == nil {
		defer globalFreeWrapper(ieCfg.lpszProxy)
		defer globalFreeWrapper(ieCfg.lpszProxyBypass)
		defer globalFreeWrapper(ieCfg.lpszAutoConfigUrl)

		proxy = StringFromUTF16Ptr(ieCfg.lpszProxy)
		proxyByPass = StringFromUTF16Ptr(ieCfg.lpszProxyBypass)
		autoConfigUrl = StringFromUTF16Ptr(ieCfg.lpszAutoConfigUrl)
		autoDetect = ieCfg.fAutoDetect
	}

	if proxy == "" && !autoDetect {
		// Try WinHTTP default proxy.
		if defaultCfg, err := getDefaultProxyConfiguration(); err == nil {
			defer globalFreeWrapper(defaultCfg.lpszProxy)
			defer globalFreeWrapper(defaultCfg.lpszProxyBypass)

			// Always set both of these (they are a pair, it doesn't make sense to set one here and keep the value of the other from above)
			proxy = StringFromUTF16Ptr(defaultCfg.lpszProxy)
			proxyByPass = StringFromUTF16Ptr(defaultCfg.lpszProxyBypass)
		}
	}

	if proxy == "" && !autoDetect {
		// Fall back to IE registry or manual detection if nothing is found there..
		regedit, _ := readRegedit() // If the syscall fails, backup to manual detection.
		windowsProxyConf = parseRegedit(regedit)
		return
	}

	// Setting the proxy settings.
	windowsProxyConf = ProxyConf{
		Static: StaticProxyConf{
			Active: len(proxy) > 0,
		},
		Automatic: ProxyScriptConf{
			Active: len(autoConfigUrl) > 0 || autoDetect,
		},
	}

	if windowsProxyConf.Static.Active {
		protocol := make(map[string]string)
		for _, s := range strings.Split(proxy, ";") {
			s = strings.TrimSpace(s)
			if s == "" {
				continue
			}
			pair := strings.SplitN(s, "=", 2)
			if len(pair) > 1 {
				protocol[pair[0]] = pair[1]
			} else {
				protocol[""] = pair[0]
			}
		}

		windowsProxyConf.Static.Protocols = protocol
		if len(proxyByPass) > 0 {
			windowsProxyConf.Static.NoProxy = strings.Replace(proxyByPass, ";", ",", -1)
		}
	}

	if windowsProxyConf.Automatic.Active {
		windowsProxyConf.Automatic.PreConfiguredURL = autoConfigUrl
	}
}

func getUserConfigFromWindowsSyscall() (*tWINHTTP_CURRENT_USER_IE_PROXY_CONFIG, error) {
	if err := winHttpGetIEProxyConfigForCurrentUser.Find(); err != nil {
		return nil, err
	}
	p := new(tWINHTTP_CURRENT_USER_IE_PROXY_CONFIG)
	r, _, err := winHttpGetIEProxyConfigForCurrentUser.Call(uintptr(unsafe.Pointer(p)))
	if rTrue(r) {
		return p, nil
	}
	return nil, err
}

func getDefaultProxyConfiguration() (*tWINHTTP_PROXY_INFO, error) {
	pInfo := new(tWINHTTP_PROXY_INFO)
	if err := winHttpGetDefaultProxyConfiguration.Find(); err != nil {
		return nil, err
	}
	r, _, err := winHttpGetDefaultProxyConfiguration.Call(uintptr(unsafe.Pointer(pInfo)))
	if rTrue(r) {
		return pInfo, nil
	}
	return nil, err
}

// OverrideEnvWithStaticProxy writes new values to the
// http_proxy, https_proxy and no_proxy environment variables.
// The values are taken from the Windows Regedit (should be called in init() function)
func overrideEnvWithStaticProxy(conf ProxyConf, setenv envSetter) {
	if conf.Static.Active {
		for _, scheme := range []string{"http", "https"} {
			url := mapFallback(scheme, "", conf.Static.Protocols)
			setenv(scheme+"_proxy", url)
		}
		if conf.Static.NoProxy != "" {
			setenv("no_proxy", conf.Static.NoProxy)
		}
	}
}

func parseRegedit(regedit regeditValues) ProxyConf {
	protocol := make(map[string]string)
	for _, s := range strings.Split(regedit.ProxyServer, ";") {
		if s == "" {
			continue
		}
		pair := strings.SplitN(s, "=", 2)
		if len(pair) > 1 {
			protocol[pair[0]] = pair[1]
		} else {
			protocol[""] = pair[0]
		}
	}

	return ProxyConf{
		Static: StaticProxyConf{
			Active:    regedit.ProxyEnable > 0,
			Protocols: protocol,
			NoProxy:   strings.Replace(regedit.ProxyOverride, ";", ",", -1), // to match linux style
		},
		Automatic: ProxyScriptConf{
			Active:           regedit.AutoConfigURL != "",
			PreConfiguredURL: regedit.AutoConfigURL,
		},
	}
}

func readRegedit() (values regeditValues, err error) {
	var proxySettingsPerUser uint64 = 1 // 1 is the default value to consider current user
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `Software\Policies\Microsoft\Windows\CurrentVersion\Internet Settings`, registry.QUERY_VALUE)
	if err == nil {
		//We had used the below variable tempPrxUsrSettings, because the Golang method GetIntegerValue
		//sets the value to zero even it fails.
		tempPrxUsrSettings, _, err := k.GetIntegerValue("ProxySettingsPerUser")
		if err == nil {
			//consider the value of tempPrxUsrSettings if it is a success
			proxySettingsPerUser = tempPrxUsrSettings
		}
		k.Close()
	}

	var hkey registry.Key
	if proxySettingsPerUser == 0 {
		hkey = registry.LOCAL_MACHINE
	} else {
		hkey = registry.CURRENT_USER
	}

	k, err = registry.OpenKey(hkey, `Software\Microsoft\Windows\CurrentVersion\Internet Settings`, registry.QUERY_VALUE)
	if err != nil {
		return
	}
	defer k.Close()

	values.ProxyServer, _, err = k.GetStringValue("ProxyServer")
	if err != nil && err != registry.ErrNotExist {
		return
	}
	values.ProxyOverride, _, err = k.GetStringValue("ProxyOverride")
	if err != nil && err != registry.ErrNotExist {
		return
	}

	values.ProxyEnable, _, err = k.GetIntegerValue("ProxyEnable")
	if err != nil && err != registry.ErrNotExist {
		return
	}

	values.AutoConfigURL, _, err = k.GetStringValue("AutoConfigURL")
	if err != nil && err != registry.ErrNotExist {
		return
	}
	err = nil
	return
}
