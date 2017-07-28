package kodo

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/qiniu/api.v7/api"
	"github.com/qiniu/api.v7/auth/qbox"
	"github.com/qiniu/x/url.v7"
)

// ----------------------------------------------------------

// 根据空间(Bucket)的域名，以及文件的 key，获得 baseUrl。
// 如果空间是 public 的，那么通过 baseUrl 可以直接下载文件内容。
// 如果空间是 private 的，那么需要对 baseUrl 进行私有签名得到一个临时有效的 privateUrl 进行下载。
//
func MakeBaseUrl(domain, key string) (baseUrl string) {

	return "http://" + domain + "/" + url.Escape(key)
}

// ----------------------------------------------------------

type GetPolicy struct {
	Expires uint32
}

func (p *Client) MakePrivateUrl(baseUrl string, policy *GetPolicy) (privateUrl string) {

	var expires int64
	if policy == nil || policy.Expires == 0 {
		expires = 3600
	} else {
		expires = int64(policy.Expires)
	}
	deadline := time.Now().Unix() + expires

	if strings.Contains(baseUrl, "?") {
		baseUrl += "&e="
	} else {
		baseUrl += "?e="
	}
	baseUrl += strconv.FormatInt(deadline, 10)

	token := qbox.Sign(p.mac, []byte(baseUrl))
	return baseUrl + "&token=" + token
}

// --------------------------------------------------------------------------------

type PutPolicy struct {
	Scope               string   `json:"scope"`
	Expires             uint32   `json:"deadline"`             // 截止时间（以秒为单位）
	InsertOnly          uint16   `json:"insertOnly,omitempty"` // 若非0, 即使Scope为 Bucket:Key 的形式也是insert only
	DetectMime          uint8    `json:"detectMime,omitempty"` // 若非0, 则服务端根据内容自动确定 MimeType
	CallbackFetchKey    uint8    `json:"callbackFetchKey,omitempty"`
	FsizeLimit          int64    `json:"fsizeLimit,omitempty"`
	MimeLimit           string   `json:"mimeLimit,omitempty"`
	SaveKey             string   `json:"saveKey,omitempty"`
	CallbackUrl         string   `json:"callbackUrl,omitempty"`
	CallbackHost        string   `json:"callbackHost,omitempty"`
	CallbackBody        string   `json:"callbackBody,omitempty"`
	CallbackBodyType    string   `json:"callbackBodyType,omitempty"`
	ReturnUrl           string   `json:"returnUrl,omitempty"`
	ReturnBody          string   `json:"returnBody,omitempty"`
	PersistentOps       string   `json:"persistentOps,omitempty"`
	PersistentNotifyUrl string   `json:"persistentNotifyUrl,omitempty"`
	PersistentPipeline  string   `json:"persistentPipeline,omitempty"`
	AsyncOps            string   `json:"asyncOps,omitempty"`
	EndUser             string   `json:"endUser,omitempty"`
	Checksum            string   `json:"checksum,omitempty"` // 格式：<HashName>:<HexHashValue>，目前支持 MD5/SHA1。
	UpHosts             []string `json:"uphosts,omitempty"`
	DeleteAfterDays     int      `json:"deleteAfterDays,omitempty"`
	FileType            int      `json:"fileType,omitempty"`
}

func (p *Client) MakeUptoken(policy *PutPolicy) string {
	token, err := p.MakeUptokenWithSafe(policy)
	if err != nil {
		fmt.Errorf("makeuptoken failed: policy: %+v, error: %+v", policy, err)
	}
	return token
}

func (p *Client) MakeUptokenWithSafe(policy *PutPolicy) (token string, err error) {
	var rr = *policy
	if len(rr.UpHosts) == 0 {
		bucketName := getBucketNameFromPutPolicy(policy)
		bucketInfo, err1 := p.GetBucketInfo(bucketName)
		if err1 != nil {
			err = err1
			return
		}
		rr.UpHosts = bucketInfo.UpHosts
	}
	if rr.Expires == 0 {
		rr.Expires = 3600
	}
	rr.Expires += uint32(time.Now().Unix())
	b, _ := json.Marshal(&rr)
	token = qbox.SignWithData(p.mac, b)
	return
}

func getBucketNameFromPutPolicy(policy *PutPolicy) (bucketName string) {
	scope := policy.Scope
	bucketName = strings.Split(scope, ":")[0]
	return
}

func (p *Client) GetBucketInfo(bucketName string) (bucketInfo api.BucketInfo, err error) {
	return p.apiCli.GetBucketInfo(p.mac.AccessKey, bucketName)
}

// ----------------------------------------------------------
