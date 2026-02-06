//go:build !ios && !iossimulator
// +build !ios,!iossimulator

package ieproxy

/*
#cgo LDFLAGS: -framework CoreFoundation
#cgo LDFLAGS: -framework CFNetwork
#include <strings.h>
#include <CFNetwork/CFProxySupport.h>
*/
import "C"

import (
	"fmt"
	"strings"
	"sync"
	"unsafe"
)

var once sync.Once
var darwinProxyConf ProxyConf

// GetConf retrieves the proxy configuration from the Windows Regedit
func getConf() ProxyConf {
	once.Do(writeConf)
	return darwinProxyConf
}

// reloadConf forces a reload of the proxy configuration.
func reloadConf() ProxyConf {
	writeConf()
	return getConf()
}

func cfStringGetGoString(cfStr C.CFStringRef) string {
	retCString := (*C.char)(C.calloc(C.ulong(uint(128)), 1))
	defer C.free(unsafe.Pointer(retCString))

	C.CFStringGetCString(cfStr, retCString, C.long(128), C.kCFStringEncodingUTF8)
	return C.GoString(retCString)
}

func cfNumberGetGoInt(cfNum C.CFNumberRef) int {
	ret := 0
	C.CFNumberGetValue(cfNum, C.kCFNumberIntType, unsafe.Pointer(&ret))
	return ret
}

func cfArrayGetGoStrings(cfArray C.CFArrayRef) []string {
	var ret []string
	for i := 0; i < int(C.CFArrayGetCount(cfArray)); i++ {
		cfStr := C.CFStringRef(C.CFArrayGetValueAtIndex(cfArray, C.long(i)))
		if unsafe.Pointer(cfStr) != C.NULL {
			ret = append(ret, cfStringGetGoString(cfStr))
		}
	}
	return ret
}

func writeConf() {
	cfDictProxy := C.CFDictionaryRef(C.CFNetworkCopySystemProxySettings())
	defer C.CFRelease(C.CFTypeRef(cfDictProxy))
	darwinProxyConf = ProxyConf{}

	cfNumHttpEnable := C.CFNumberRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesHTTPEnable)))
	if unsafe.Pointer(cfNumHttpEnable) != C.NULL && cfNumberGetGoInt(cfNumHttpEnable) > 0 {
		darwinProxyConf.Static.Active = true
		if darwinProxyConf.Static.Protocols == nil {
			darwinProxyConf.Static.Protocols = make(map[string]string)
		}
		httpHost := C.CFStringRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesHTTPProxy)))
		httpPort := C.CFNumberRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesHTTPPort)))

		httpProxy := fmt.Sprintf("%s:%d", cfStringGetGoString(httpHost), cfNumberGetGoInt(httpPort))
		darwinProxyConf.Static.Protocols["http"] = httpProxy
	}

	cfNumHttpsEnable := C.CFNumberRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesHTTPSEnable)))
	if unsafe.Pointer(cfNumHttpsEnable) != C.NULL && cfNumberGetGoInt(cfNumHttpsEnable) > 0 {
		darwinProxyConf.Static.Active = true
		if darwinProxyConf.Static.Protocols == nil {
			darwinProxyConf.Static.Protocols = make(map[string]string)
		}
		httpsHost := C.CFStringRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesHTTPSProxy)))
		httpsPort := C.CFNumberRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesHTTPSPort)))

		httpProxy := fmt.Sprintf("%s:%d", cfStringGetGoString(httpsHost), cfNumberGetGoInt(httpsPort))
		darwinProxyConf.Static.Protocols["https"] = httpProxy
	}

	if darwinProxyConf.Static.Active {
		cfArrayExceptionList := C.CFArrayRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesExceptionsList)))
		if unsafe.Pointer(cfArrayExceptionList) != C.NULL {
			exceptionList := cfArrayGetGoStrings(cfArrayExceptionList)
			darwinProxyConf.Static.NoProxy = strings.Join(exceptionList, ",")
		}
	}

	cfNumPacEnable := C.CFNumberRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesProxyAutoConfigEnable)))
	if unsafe.Pointer(cfNumPacEnable) != C.NULL && cfNumberGetGoInt(cfNumPacEnable) > 0 {
		cfStringPac := C.CFStringRef(C.CFDictionaryGetValue(cfDictProxy, unsafe.Pointer(C.kCFNetworkProxiesProxyAutoConfigURLString)))
		if unsafe.Pointer(cfStringPac) != C.NULL {
			pac := cfStringGetGoString(cfStringPac)
			darwinProxyConf.Automatic.PreConfiguredURL = pac
			darwinProxyConf.Automatic.Active = true
		}
	}
}

// OverrideEnvWithStaticProxy writes new values to the
// http_proxy, https_proxy and no_proxy environment variables.
// The values are taken from the MacOS System Preferences.
func overrideEnvWithStaticProxy(conf ProxyConf, setenv envSetter) {
	if conf.Static.Active {
		for _, scheme := range []string{"http", "https"} {
			url := conf.Static.Protocols[scheme]
			if url != "" {
				setenv(scheme+"_proxy", url)
			}
		}
		if conf.Static.NoProxy != "" {
			setenv("no_proxy", conf.Static.NoProxy)
		}
	}
}
