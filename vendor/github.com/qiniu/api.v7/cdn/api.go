package cdn

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/qiniu/api.v7/auth/qbox"
	. "github.com/qiniu/api.v7/conf"
)

var (
	FUSION_HOST = "http://fusion.qiniuapi.com"
)

/* TrafficReqBody

批量查询带宽/流量 请求内容

	StartDate	string	开始日期，例如：2016-07-01
	EndDate		string	结束日期，例如：2016-07-03
	Granularity	string	粒度，取值：5min ／ hour ／day
	Domains	 	string	域名列表，以 ；分割
*/
type TrafficReqBody struct {
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Granularity string `json:"granularity"`
	Domains     string `json:"domains"`
}

// TrafficResp
// 带宽/流量查询响应内容
type TrafficResp struct {
	Code  int                        `json:"code"`
	Error string                     `json:"error"`
	Time  []string                   `json:"time,omitempty"`
	Data  map[string]TrafficRespData `json:"data,omitempty"`
}

// TrafficRespData
// 带宽/流量数据
type TrafficRespData struct {
	DomainChina   []int `json:"china"`
	DomainOversea []int `json:"oversea"`
}

/*
// BandWidth

获取域名访问带宽数据
http://developer.qiniu.com/article/fusion/api/traffic-bandwidth.html

	StartDate		string		必须	开始日期，例如：2016-07-01
	EndDate			string		必须	结束日期，例如：2016-07-03
	Granularity		string		必须	粒度，取值：5min ／ hour ／day
	Domains			[]string	必须	域名列表
*/
func GetBandWidthData(startDate, endDate, granularity string, domainList []string) (bandwidthData TrafficResp, err error) {

	domains := strings.Join(domainList, ";")
	reqBody := TrafficReqBody{
		StartDate:   startDate,
		EndDate:     endDate,
		Granularity: granularity,
		Domains:     domains,
	}

	resData, reqErr := postRequest("v2/tune/bandwidth", reqBody)
	if reqErr != nil {
		err = reqErr
		return
	}
	umErr := json.Unmarshal(resData, &bandwidthData)
	if umErr != nil {
		err = umErr
		return
	}
	return
}

/* Flux

获取域名访问流量数据
http://developer.qiniu.com/article/fusion/api/traffic-bandwidth.html

	StartDate		string		必须	开始日期，例如：2016-07-01
	EndDate			string		必须	结束日期，例如：2016-07-03
	Granularity		string		必须	粒度，取值：5min ／ hour ／day
	Domains			[]string	必须	域名列表
*/
func GetFluxData(startDate, endDate, granularity string, domainList []string) (fluxData TrafficResp, err error) {

	domains := strings.Join(domainList, ";")
	reqBody := TrafficReqBody{
		StartDate:   startDate,
		EndDate:     endDate,
		Granularity: granularity,
		Domains:     domains,
	}

	resData, reqErr := postRequest("v2/tune/flux", reqBody)
	if reqErr != nil {
		err = reqErr
		return
	}

	umErr := json.Unmarshal(resData, &fluxData)
	if umErr != nil {
		err = umErr
		return
	}

	return
}

// RefreshReq
// 缓存刷新请求内容
type RefreshReq struct {
	Urls []string `json:"urls"`
	Dirs []string `json:"dirs"`
}

// RefreshResp
// 缓存刷新响应内容
type RefreshResp struct {
	Code          int      `json:"code"`
	Error         string   `json:"error"`
	RequestID     string   `json:"requestId,omitempty"`
	InvalidUrls   []string `json:"invalidUrls,omitempty"`
	InvalidDirs   []string `json:"invalidDirs,omitempty"`
	UrlQuotaDay   int      `json:"urlQuotaDay,omitempty"`
	UrlSurplusDay int      `json:"urlSurplusDay,omitempty"`
	DirQuotaDay   int      `json:"dirQuotaDay,omitempty"`
	DirSurplusDay int      `json:"dirSurplusDay,omitempty"`
}

/* RefreshUrlsAndDirs

刷新链接列表，每次最多不可以超过100条链接
http://developer.qiniu.com/article/fusion/api/refresh.html

	urls	要刷新的单个url列表，总数不超过100条；单个url，即一个具体的url，例如：http://bar.foo.com/index.html
	dirs	要刷新的目录url列表，总数不超过10条；目录dir，即表示一个目录级的url，例如：http://bar.foo.com/dir/，也支持在尾部使用通配符，例如：http://bar.foo.com/dir/*
*/
func RefreshUrlsAndDirs(urls, dirs []string) (result RefreshResp, err error) {

	reqBody := RefreshReq{
		Urls: urls,
		Dirs: dirs,
	}

	resData, reqErr := postRequest("v2/tune/refresh", reqBody)
	if reqErr != nil {
		err = reqErr
		return
	}
	umErr := json.Unmarshal(resData, &result)
	if umErr != nil {
		err = reqErr
		return
	}

	return
}

// RefreshUrls
// 刷新文件
func RefreshUrls(urls []string) (result RefreshResp, err error) {
	return RefreshUrlsAndDirs(urls, nil)
}

// RefreshDirs
// 刷新目录
func RefreshDirs(dirs []string) (result RefreshResp, err error) {
	return RefreshUrlsAndDirs(nil, dirs)
}

// PrefetchReq
// 文件预取请求内容
type PrefetchReq struct {
	Urls []string `json:"urls"`
}

// PrefetchResp
// 文件预取响应内容
type PrefetchResp struct {
	Code        int      `json:"code"`
	Error       string   `json:"error"`
	RequestID   string   `json:"requestId,omitempty"`
	InvalidUrls []string `json:"invalidUrls,omitempty"`
	QuotaDay    int      `json:"quotaDay,omitempty"`
	SurplusDay  int      `json:"surplusDay,omitempty"`
}

// PrefetchUrls
// 预取文件链接，每次最多不可以超过100条
// http://developer.qiniu.com/article/fusion/api/prefetch.html
func PrefetchUrls(urls []string) (result PrefetchResp, err error) {

	reqBody := PrefetchReq{
		Urls: urls,
	}

	resData, reqErr := postRequest("v2/tune/prefetch", reqBody)
	if reqErr != nil {
		err = reqErr
		return
	}

	umErr := json.Unmarshal(resData, &result)
	if umErr != nil {
		err = umErr
		return
	}

	return
}

// RequestWithBody
// 带body对api发出请求并且返回response body
func postRequest(path string, body interface{}) (resData []byte, err error) {

	urlStr := fmt.Sprintf("%s/%s", FUSION_HOST, path)

	reqData, _ := json.Marshal(body)
	req, reqErr := http.NewRequest("POST", urlStr, bytes.NewReader(reqData))
	if reqErr != nil {
		err = reqErr
		return
	}

	mac := qbox.NewMac(ACCESS_KEY, SECRET_KEY)
	accessToken, signErr := mac.SignRequest(req, false)
	if signErr != nil {
		err = signErr
		return
	}

	req.Header.Add("Authorization", "QBox "+accessToken)
	req.Header.Add("Content-Type", "application/json")

	resp, httpErr := http.DefaultClient.Do(req)
	if httpErr != nil {
		err = httpErr
		return
	}
	defer resp.Body.Close()

	resData, ioErr := ioutil.ReadAll(resp.Body)
	if ioErr != nil {
		err = ioErr
		return
	}

	return
}
