package cdn

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/qiniu/api.v7/auth/qbox"
)

const (
	LIST_LOG_API = "http://fusion.qiniuapi.com/v2/tune/log/list"
)

// ListLogRequest 日志下载请求内容
type ListLogRequest struct {
	Day     string `json:"day"`
	Domains string `json:"domains"`
}

// ListLogResult 日志下载相应内容
type ListLogResult struct {
	Code  int                        `json:"code"`
	Error string                     `json:"error"`
	Data  map[string][]LogDomainInfo `json:"data"`
}

// LogDomainInfo 日志下载信息
type LogDomainInfo struct {
	Name         string `json:"name"`
	Size         int64  `json:"size"`
	ModifiedTime int64  `json:"mtime"`
	URL          string `json:"url"`
}

// GetCdnLogList 获取CDN域名访问日志的下载链接
// http://developer.qiniu.com/article/fusion/api/log.html
func GetCdnLogList(date, domains string) (domainLogs []LogDomainInfo, err error) {

	//new log query request
	logReq := ListLogRequest{
		Day:     date,
		Domains: domains,
	}

	logReqBytes, _ := json.Marshal(&logReq)
	req, reqErr := http.NewRequest("POST", LIST_LOG_API, bytes.NewReader(logReqBytes))
	if reqErr != nil {
		err = fmt.Errorf("New request error, %s", reqErr)
		return
	}

	mac := qbox.NewMac("", "")
	token, signErr := mac.SignRequest(req, false)
	if signErr != nil {
		err = signErr
		return
	}

	req.Header.Add("Authorization", "QBox "+token)
	req.Header.Add("Content-Type", "application/json")

	resp, respErr := http.DefaultClient.Do(req)
	if respErr != nil {
		err = fmt.Errorf("Get response error, %s", respErr)
		return
	}
	defer resp.Body.Close()

	listLogResult := ListLogResult{}
	decoder := json.NewDecoder(resp.Body)
	if decodeErr := decoder.Decode(&listLogResult); decodeErr != nil {
		err = fmt.Errorf("Parse response error, %s", decodeErr)
		return
	}
	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("Get log list error, %d %s", listLogResult.Code, listLogResult.Error)
		return
	}

	domainItems := strings.Split(domains, ";")

	for _, domain := range domainItems {
		for _, v := range listLogResult.Data[domain] {
			domainLogs = append(domainLogs, v)
		}
	}
	return

}
