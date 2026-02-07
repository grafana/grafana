package ieproxy

import "golang.org/x/sys/windows"

var winHttp = windows.NewLazySystemDLL("winhttp.dll")
var winHttpGetProxyForURL = winHttp.NewProc("WinHttpGetProxyForUrl")
var winHttpOpen = winHttp.NewProc("WinHttpOpen")
var winHttpCloseHandle = winHttp.NewProc("WinHttpCloseHandle")
var winHttpGetIEProxyConfigForCurrentUser = winHttp.NewProc("WinHttpGetIEProxyConfigForCurrentUser")
var winHttpGetDefaultProxyConfiguration = winHttp.NewProc("WinHttpGetDefaultProxyConfiguration")

type tWINHTTP_AUTOPROXY_OPTIONS struct {
	dwFlags                autoProxyFlag
	dwAutoDetectFlags      autoDetectFlag
	lpszAutoConfigUrl      *uint16
	lpvReserved            *uint16
	dwReserved             uint32
	fAutoLogonIfChallenged bool
}
type autoProxyFlag uint32

const (
	fWINHTTP_AUTOPROXY_AUTO_DETECT         = autoProxyFlag(0x00000001)
	fWINHTTP_AUTOPROXY_CONFIG_URL          = autoProxyFlag(0x00000002)
	fWINHTTP_AUTOPROXY_NO_CACHE_CLIENT     = autoProxyFlag(0x00080000)
	fWINHTTP_AUTOPROXY_NO_CACHE_SVC        = autoProxyFlag(0x00100000)
	fWINHTTP_AUTOPROXY_NO_DIRECTACCESS     = autoProxyFlag(0x00040000)
	fWINHTTP_AUTOPROXY_RUN_INPROCESS       = autoProxyFlag(0x00010000)
	fWINHTTP_AUTOPROXY_RUN_OUTPROCESS_ONLY = autoProxyFlag(0x00020000)
	fWINHTTP_AUTOPROXY_SORT_RESULTS        = autoProxyFlag(0x00400000)
)

type autoDetectFlag uint32

const (
	fWINHTTP_AUTO_DETECT_TYPE_DHCP  = autoDetectFlag(0x00000001)
	fWINHTTP_AUTO_DETECT_TYPE_DNS_A = autoDetectFlag(0x00000002)
)

type tWINHTTP_PROXY_INFO struct {
	dwAccessType    uint32
	lpszProxy       *uint16
	lpszProxyBypass *uint16
}

type tWINHTTP_CURRENT_USER_IE_PROXY_CONFIG struct {
	fAutoDetect       bool
	lpszAutoConfigUrl *uint16
	lpszProxy         *uint16
	lpszProxyBypass   *uint16
}
