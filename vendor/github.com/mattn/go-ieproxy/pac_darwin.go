package ieproxy

/*
#cgo LDFLAGS: -framework CoreFoundation
#cgo LDFLAGS: -framework CFNetwork
#include <strings.h>
#include <CFNetwork/CFProxySupport.h>

#define STR_LEN 128

void proxyAutoConfCallback(void* client, CFArrayRef proxies, CFErrorRef error) {
	CFTypeRef* result_ptr = (CFTypeRef*)client;
	if (error != NULL) {
		*result_ptr = CFRetain(error);
	  } else {
		*result_ptr = CFRetain(proxies);
	  }
	  CFRunLoopStop(CFRunLoopGetCurrent());
}

int intCFNumber(CFNumberRef num) {
	int ret;
	CFNumberGetValue(num, kCFNumberIntType, &ret);
	return ret;
}

char* _getProxyUrlFromPac(char* pac, char* reqCs) {
	char* retCString = (char*)calloc(STR_LEN, sizeof(char));

	CFStringRef reqStr = CFStringCreateWithCString(NULL, reqCs, kCFStringEncodingUTF8);
	CFStringRef pacStr = CFStringCreateWithCString(NULL, pac, kCFStringEncodingUTF8);
	CFURLRef pacUrl = CFURLCreateWithString(NULL, pacStr, NULL);
	CFURLRef reqUrl = CFURLCreateWithString(NULL, reqStr, NULL);

	CFTypeRef result = NULL;
	CFStreamClientContext context = { 0, &result, NULL, NULL, NULL };
	CFRunLoopSourceRef runloop_src = CFNetworkExecuteProxyAutoConfigurationURL(pacUrl, reqUrl, proxyAutoConfCallback, &context);

	if (runloop_src) {
		const CFStringRef private_runloop_mode = CFSTR("go-ieproxy");
		CFRunLoopAddSource(CFRunLoopGetCurrent(), runloop_src, private_runloop_mode);
		CFRunLoopRunInMode(private_runloop_mode, DBL_MAX, false);
		CFRunLoopRemoveSource(CFRunLoopGetCurrent(), runloop_src, kCFRunLoopCommonModes);

		if (CFGetTypeID(result) == CFArrayGetTypeID()) {
			CFArrayRef resultArray = (CFTypeRef)result;
			if (CFArrayGetCount(resultArray) > 0) {
				CFDictionaryRef pxy = (CFDictionaryRef)CFArrayGetValueAtIndex(resultArray, 0);
				CFStringRef pxyType = CFDictionaryGetValue(pxy, kCFProxyTypeKey);

				if (CFEqual(pxyType, kCFProxyTypeNone)) {
					// noop
				}

				if (CFEqual(pxyType, kCFProxyTypeHTTP)) {
					CFStringRef host = (CFStringRef)CFDictionaryGetValue(pxy, kCFProxyHostNameKey);
					CFNumberRef port = (CFNumberRef)CFDictionaryGetValue(pxy, kCFProxyPortNumberKey);

					char host_str[STR_LEN - 16];
					CFStringGetCString(host, host_str, STR_LEN - 16, kCFStringEncodingUTF8);

					int port_int = 80;
					if (port) {
						CFNumberGetValue(port, kCFNumberIntType, &port_int);
					}

					sprintf(retCString, "%s:%d", host_str, port_int);
				}
			}
		} else {
			// error
		}
	}

	CFRelease(result);
	CFRelease(reqStr);
	CFRelease(reqUrl);
	CFRelease(pacStr);
	CFRelease(pacUrl);
	return retCString;
}

char* _getPacUrl() {
	char* retCString = (char*)calloc(STR_LEN, sizeof(char));
	CFDictionaryRef proxyDict = CFNetworkCopySystemProxySettings();
	CFNumberRef pacEnable = (CFNumberRef)CFDictionaryGetValue(proxyDict, kCFNetworkProxiesProxyAutoConfigEnable);

	if (pacEnable && intCFNumber(pacEnable)) {
		CFStringRef pacUrlStr = (CFStringRef)CFDictionaryGetValue(proxyDict, kCFNetworkProxiesProxyAutoConfigURLString);
		if (pacUrlStr) {
			CFStringGetCString(pacUrlStr, retCString, STR_LEN, kCFStringEncodingUTF8);
		}
	}

	CFRelease(proxyDict);
	return retCString;
}

*/
import "C"
import (
	"net/url"
	"unsafe"
)

func (psc *ProxyScriptConf) findProxyForURL(URL string) string {
	if !psc.Active {
		return ""
	}
	proxy := getProxyForURL(psc.PreConfiguredURL, URL)
	return proxy
}

func getProxyForURL(pacFileURL, targetURL string) string {
	if pacFileURL == "" {
		pacFileURL = getPacUrl()
	}
	if pacFileURL == "" {
		return ""
	}
	if u, err := url.Parse(pacFileURL); err != nil || u.Scheme == "" {
		return ""
	}

	csUrl := C.CString(targetURL)
	csPac := C.CString(pacFileURL)
	csRet := C._getProxyUrlFromPac(csPac, csUrl)

	defer C.free(unsafe.Pointer(csUrl))
	defer C.free(unsafe.Pointer(csPac))
	defer C.free(unsafe.Pointer(csRet))

	return C.GoString(csRet)
}

func getPacUrl() string {
	csRet := C._getPacUrl()

	defer C.free(unsafe.Pointer(csRet))
	return C.GoString(csRet)
}
