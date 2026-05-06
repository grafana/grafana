package ieproxy

import (
	"strings"
	"syscall"
	"unsafe"
)

func (psc *ProxyScriptConf) findProxyForURL(URL string) string {
	if !psc.Active {
		return ""
	}
	proxy, _ := getProxyForURL(psc.PreConfiguredURL, URL)
	i := strings.Index(proxy, ";")
	if i >= 0 {
		return proxy[:i]
	}
	return proxy
}

func getProxyForURL(pacfileURL, URL string) (string, error) {
	pacfileURLPtr, err := syscall.UTF16PtrFromString(pacfileURL)
	if err != nil {
		return "", err
	}
	URLPtr, err := syscall.UTF16PtrFromString(URL)
	if err != nil {
		return "", err
	}

	handle, _, err := winHttpOpen.Call(0, 0, 0, 0, 0)
	if handle == 0 {
		return "", err
	}
	defer winHttpCloseHandle.Call(handle)

	dwFlags := fWINHTTP_AUTOPROXY_CONFIG_URL
	dwAutoDetectFlags := autoDetectFlag(0)
	pfURLptr := pacfileURLPtr

	if pacfileURL == "" {
		dwFlags = fWINHTTP_AUTOPROXY_AUTO_DETECT
		dwAutoDetectFlags = fWINHTTP_AUTO_DETECT_TYPE_DNS_A | fWINHTTP_AUTO_DETECT_TYPE_DHCP
		pfURLptr = nil
	}

	options := tWINHTTP_AUTOPROXY_OPTIONS{
		dwFlags:                dwFlags, // adding cache might cause issues: https://github.com/mattn/go-ieproxy/issues/6
		dwAutoDetectFlags:      dwAutoDetectFlags,
		lpszAutoConfigUrl:      pfURLptr,
		lpvReserved:            nil,
		dwReserved:             0,
		fAutoLogonIfChallenged: true, // may not be optimal https://msdn.microsoft.com/en-us/library/windows/desktop/aa383153(v=vs.85).aspx
	} // lpszProxyBypass isn't used as this only executes in cases where there (may) be a pac file (autodetect can fail), where lpszProxyBypass couldn't be returned.
	// in the case that autodetect fails and no pre-specified pacfile is present, no proxy is returned.

	info := new(tWINHTTP_PROXY_INFO)

	ret, _, err := winHttpGetProxyForURL.Call(
		handle,
		uintptr(unsafe.Pointer(URLPtr)),
		uintptr(unsafe.Pointer(&options)),
		uintptr(unsafe.Pointer(info)),
	)
	if ret > 0 {
		err = nil
	}

	defer globalFreeWrapper(info.lpszProxyBypass)
	defer globalFreeWrapper(info.lpszProxy)
	return StringFromUTF16Ptr(info.lpszProxy), err
}
