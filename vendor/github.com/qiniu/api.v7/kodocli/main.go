package kodocli

import (
	"net/http"

	"github.com/qiniu/api.v7/api"
	"github.com/qiniu/api.v7/conf"
	"github.com/qiniu/x/rpc.v7"
	"github.com/qiniu/x/url.v7"
)

// ----------------------------------------------------------

type zoneConfig struct {
	UpHosts []string
}

var zones = []zoneConfig{
	// z0:
	{
		UpHosts: []string{
			"http://upload.qiniu.com",
			"http://up.qiniu.com",
			"-H up.qiniu.com http://183.136.139.16",
		},
	},
	// z1:
	{
		UpHosts: []string{
			"http://upload-z1.qiniu.com",
			"http://up-z1.qiniu.com",
			"-H up-z1.qiniu.com http://106.38.227.27",
		},
	},
	// z2 华南机房:
	{
		UpHosts: []string{
			"http://up-z2.qiniu.com",
			"http://upload-z2.qiniu.com",
		},
	},
	// na0 北美机房:
	{
		UpHosts: []string{
			"http://up-na0.qiniu.com",
			"http://upload-na0.qiniu.com",
		},
	},
}

// ----------------------------------------------------------

type UploadConfig struct {
	UpHosts   []string
	Transport http.RoundTripper

	APIHost string
	Scheme  string
}

type Uploader struct {
	Conn    rpc.Client
	UpHosts []string
	ApiCli  *api.Client
}

func NewUploader(zone int, cfg *UploadConfig) (p Uploader) {

	var uc UploadConfig
	if cfg != nil {
		uc = *cfg
	}
	if uc.Scheme != "https" {
		uc.Scheme = "http"
	}
	if uc.APIHost == "" {
		uc.APIHost = api.DefaultApiHost
	}
	if len(uc.UpHosts) == 0 {
		if zone > 0 && zone < len(zones) {
			uc.UpHosts = zones[zone].UpHosts
		}
	}

	p.UpHosts = uc.UpHosts
	p.Conn.Client = &http.Client{Transport: uc.Transport}
	p.ApiCli = api.NewClient(uc.APIHost, uc.Scheme)
	return
}

func NewUploaderWithoutZone(cfg *UploadConfig) (p Uploader) {
	return NewUploader(-1, cfg)
}

// ----------------------------------------------------------

// 根据空间(Bucket)的域名，以及文件的 key，获得 baseUrl。
// 如果空间是 public 的，那么通过 baseUrl 可以直接下载文件内容。
// 如果空间是 private 的，那么需要对 baseUrl 进行私有签名得到一个临时有效的 privateUrl 进行下载。
//
func MakeBaseUrl(domain, key string) (baseUrl string) {
	return "http://" + domain + "/" + url.Escape(key)
}

// ----------------------------------------------------------

// 设置使用这个SDK的应用程序名。userApp 必须满足 [A-Za-z0-9_\ \-\.]*
//
func SetAppName(userApp string) error {

	return conf.SetAppName(userApp)
}

// ----------------------------------------------------------
