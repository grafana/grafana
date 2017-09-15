package kodo

import (
	"net/http"

	"github.com/qiniu/api.v7/api"
	"github.com/qiniu/api.v7/auth/qbox"
	"github.com/qiniu/api.v7/conf"
	"github.com/qiniu/x/rpc.v7"
)

// ----------------------------------------------------------

type zoneConfig struct {
	IoHost  string
	UpHosts []string
}

const (
	// ZoneZ0  华东机房
	ZoneZ0 = iota
	// ZoneZ1 华北机房
	ZoneZ1
	// ZoneZ2 华南机房
	ZoneZ2
	// ZoneNa0 北美机房
	ZoneNa0
)

var zones = []zoneConfig{
	// z0 华东机房:
	{
		IoHost: "http://iovip.qbox.me",
		UpHosts: []string{
			"http://up.qiniu.com",
			"http://upload.qiniu.com",
			"-H up.qiniu.com http://183.136.139.16",
		},
	},
	// z1 华北机房:
	{
		IoHost: "http://iovip-z1.qbox.me",
		UpHosts: []string{
			"http://up-z1.qiniu.com",
			"http://upload-z1.qiniu.com",
			"-H up-z1.qiniu.com http://106.38.227.27",
		},
	},
	// z2 华南机房:
	{
		IoHost: "http://iovip-z2.qbox.me",
		UpHosts: []string{
			"http://up-z2.qiniu.com",
			"http://upload-z2.qiniu.com",
		},
	},
	// na0 北美机房:
	{
		IoHost: "http://iovip-na0.qbox.me",
		UpHosts: []string{
			"http://up-na0.qiniu.com",
			"http://upload-na0.qiniu.com",
		},
	},
}

const (
	defaultRsHost  = "http://rs.qbox.me"
	defaultRsfHost = "http://rsf.qbox.me"
)

// ----------------------------------------------------------

type Config struct {
	AccessKey string
	SecretKey string
	RSHost    string
	RSFHost   string
	APIHost   string
	Scheme    string
	IoHost    string
	UpHosts   []string
	Transport http.RoundTripper
}

// ----------------------------------------------------------

type Client struct {
	rpc.Client
	mac *qbox.Mac
	Config

	apiCli *api.Client
}

func New(zone int, cfg *Config) (p *Client) {

	p = new(Client)
	if cfg != nil {
		p.Config = *cfg
	}

	p.mac = qbox.NewMac(p.AccessKey, p.SecretKey)
	p.Client = rpc.Client{qbox.NewClient(p.mac, p.Transport)}

	if p.RSHost == "" {
		p.RSHost = defaultRsHost
	}
	if p.RSFHost == "" {
		p.RSFHost = defaultRsfHost
	}
	if p.Scheme != "https" {
		p.Scheme = "http"
	}
	if p.APIHost == "" {
		p.APIHost = api.DefaultApiHost
	}
	p.apiCli = api.NewClient(p.APIHost, p.Scheme)

	if zone < 0 || zone >= len(zones) {
		return
	}
	if len(p.UpHosts) == 0 {
		p.UpHosts = zones[zone].UpHosts
	}
	if p.IoHost == "" {
		p.IoHost = zones[zone].IoHost
	}
	return
}

func NewWithoutZone(cfg *Config) (p *Client) {
	return New(-1, cfg)
}

// ----------------------------------------------------------

// 设置全局默认的 ACCESS_KEY, SECRET_KEY 变量。
//
func SetMac(accessKey, secretKey string) {

	conf.ACCESS_KEY, conf.SECRET_KEY = accessKey, secretKey
}

// ----------------------------------------------------------

// 设置使用这个SDK的应用程序名。userApp 必须满足 [A-Za-z0-9_\ \-\.]*
//
func SetAppName(userApp string) error {

	return conf.SetAppName(userApp)
}

// ----------------------------------------------------------
