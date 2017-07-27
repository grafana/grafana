package cdn

import (
	"crypto/md5"
	"fmt"
	"net/url"
	"time"
)

// CreateTimestampAntileechURL 构建带时间戳防盗链的链接
// encryptKey 七牛防盗链key
func CreateTimestampAntileechURL(urlStr string, encryptKey string, durationInSeconds int64) (antileechURL string, err error) {

	u, err := url.Parse(urlStr)
	if err != nil {
		return
	}

	expireTime := time.Now().Add(time.Second * time.Duration(durationInSeconds)).Unix()
	toSignStr := fmt.Sprintf("%s%s%x", encryptKey, u.EscapedPath(), expireTime)
	signedStr := fmt.Sprintf("%x", md5.Sum([]byte(toSignStr)))

	q := url.Values{}
	q.Add("sign", signedStr)
	q.Add("t", fmt.Sprintf("%x", expireTime))

	if u.RawQuery == "" {
		antileechURL = u.String() + "?" + q.Encode()
	} else {

		antileechURL = u.String() + "&" + q.Encode()
	}

	return
}
