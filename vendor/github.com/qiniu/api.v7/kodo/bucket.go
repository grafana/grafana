package kodo

import (
	. "context"
	"encoding/base64"
	"fmt"
	"io"
	"net/url"
	"strconv"

	"github.com/qiniu/api.v7/api"
	"github.com/qiniu/x/log.v7"
)

// ----------------------------------------------------------

// Batch 批量操作。
//
func (p *Client) Batch(ctx Context, ret interface{}, op []string) (err error) {

	return p.CallWithForm(ctx, ret, "POST", p.RSHost+"/batch", map[string][]string{"op": op})
}

// ----------------------------------------------------------

type Bucket struct {
	api.BucketInfo
	Conn *Client
	Name string
}

// Buckets 获取所有地区的所有空间(bucket)
//
// shared 是否获取所有授权获得空间，true为包含授权空间
//
func (p *Client) Buckets(ctx Context, shared bool) (buckets []string, err error) {
	if shared {
		err = p.Call(ctx, &buckets, "POST", p.RSHost+"/buckets?shared=trye")
	} else {
		err = p.Call(ctx, &buckets, "POST", p.RSHost+"/buckets")
	}
	return
}

// Bucket 取七牛空间（bucket）的对象实例。
//
// name 是创建该七牛空间（bucket）时采用的名称。
//
func (p *Client) Bucket(name string) Bucket {
	b, err := p.BucketWithSafe(name)
	if err != nil {
		log.Errorf("Bucket(%s) failed: %+v", name, err)
	}
	return b
}

// BucketWithSafe 确认空间存在并获取七牛空间（bucket）的对象实例。
func (p *Client) BucketWithSafe(name string) (Bucket, error) {
	var info api.BucketInfo
	if len(p.UpHosts) == 0 {
		var err error
		info, err = p.apiCli.GetBucketInfo(p.mac.AccessKey, name)
		if err != nil {
			return Bucket{}, err
		}
	} else {
		info.IoHost = p.IoHost
		info.UpHosts = p.UpHosts
	}
	return Bucket{info, p, name}, nil
}

// Entry 资源元信息
type Entry struct {
	Hash     string `json:"hash"`
	Fsize    int64  `json:"fsize"`
	PutTime  int64  `json:"putTime"`
	MimeType string `json:"mimeType"`
	Type     int    `json:"type"`
	EndUser  string `json:"endUser"`
}

// Stat 取文件属性。
//
// ctx 是请求的上下文。
// key 是要访问的文件的访问路径。
//
func (p Bucket) Stat(ctx Context, key string) (entry Entry, err error) {
	err = p.Conn.Call(ctx, &entry, "POST", p.Conn.RSHost+URIStat(p.Name, key))
	return
}

// Delete 删除一个文件。
//
// ctx 是请求的上下文。
// key 是要删除的文件的访问路径。
//
func (p Bucket) Delete(ctx Context, key string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.RSHost+URIDelete(p.Name, key))
}

// Move 移动一个文件。
//
// ctx     是请求的上下文。
// keySrc  是要移动的文件的旧路径。
// keyDest 是要移动的文件的新路径。
//
func (p Bucket) Move(ctx Context, keySrc, keyDest string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.RSHost+URIMove(p.Name, keySrc, p.Name, keyDest))
}

// MoveEx 跨空间（bucket）移动一个文件。
//
// ctx        是请求的上下文。
// keySrc     是要移动的文件的旧路径。
// bucketDest 是文件的目标空间。
// keyDest    是要移动的文件的新路径。
//
func (p Bucket) MoveEx(ctx Context, keySrc, bucketDest, keyDest string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.RSHost+URIMove(p.Name, keySrc, bucketDest, keyDest))
}

// Copy 复制一个文件。
//
// ctx     是请求的上下文。
// keySrc  是要复制的文件的源路径。
// keyDest 是要复制的文件的目标路径。
//
func (p Bucket) Copy(ctx Context, keySrc, keyDest string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.RSHost+URICopy(p.Name, keySrc, p.Name, keyDest))
}

// ChangeMime 修改文件的MIME类型。
//
// ctx  是请求的上下文。
// key  是要修改的文件的访问路径。
// mime 是要设置的新MIME类型。
//
func (p Bucket) ChangeMime(ctx Context, key, mime string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.RSHost+URIChangeMime(p.Name, key, mime))
}

// ChangeType 修改文件的存储类型。
//
// ctx      是请求的上下文。
// key      是要修改的文件的访问路径。
// fileType 是要设置的新存储类型。0 表示标准存储；1 表示低频存储。
//
func (p Bucket) ChangeType(ctx Context, key string, fileType int) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.RSHost+URIChangeType(p.Name, key, fileType))
}

// Fetch 从网上抓取一个资源并存储到七牛空间（bucket）中。
//
// ctx 是请求的上下文。
// key 是要存储的文件的访问路径。如果文件已经存在则覆盖。
// url 是要抓取的资源的URL。
//
func (p Bucket) Fetch(ctx Context, key string, url string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.IoHost+uriFetch(p.Name, key, url))
}

// DeleteAfterDays 更新文件生命周期
//
// ctx 是请求的上下文。
// key 是要更新的文件的访问路径。
// deleteAfterDays 设置为0表示取消 lifecycle
//
func (p Bucket) DeleteAfterDays(ctx Context, key string, days int) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.RSHost+URIDeleteAfterDays(p.Name, key, days))
}

// Image 设置镜像源
//
// srcSiteURL 镜像源的访问域名。必须设置为形如 `http://source.com/` 或 `http://114.114.114.114/` 的字符串
// host 回源时使用的 Host 头部值
//
// 镜像源地址支持两种格式：
// 格式 1：`http(s)://绑定域名/源站资源相对路径`
// 格式 2：`http(s)://绑定 IP/源站资源相对路径`
//
func (p Bucket) Image(ctx Context, srcSiteURL, host string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", "http://pu.qbox.me:10200"+URIImage(p.Name, srcSiteURL, host))
}

// UnImage 取消镜像源
//
func (p Bucket) UnImage(ctx Context) (err error) {
	return p.Conn.Call(ctx, nil, "POST", "http://pu.qbox.me:10200"+URIUnImage(p.Name))
}

// Prefetch 镜像资源更新
//
// key 被抓取资源名称
//
func (p Bucket) Prefetch(ctx Context, key string) (err error) {
	return p.Conn.Call(ctx, nil, "POST", p.Conn.IoHost+URIPrefetch(p.Name, key))
}

// PfopResult pfop返回信息
type PfopResult struct {
	PersistentID string `json:"persistentId,omitempty"`
}

// FopRet 持久化云处理结果
type FopRet struct {
	ID          string `json:"id"`
	Code        int    `json:"code"`
	Desc        string `json:"desc"`
	InputBucket string `json:"inputBucket,omitempty"`
	InputKey    string `json:"inputKey,omitempty"`
	Pipeline    string `json:"pipeline,omitempty"`
	Reqid       string `json:"reqid,omitempty"`
	Items       []FopResult
}

// FopResult 云处理操作列表，包含每个云处理操作的状态信息
type FopResult struct {
	Cmd   string   `json:"cmd"`
	Code  int      `json:"code"`
	Desc  string   `json:"desc"`
	Error string   `json:"error,omitempty"`
	Hash  string   `json:"hash,omitempty"`
	Key   string   `json:"key,omitempty"`
	Keys  []string `json:"keys,omitempty"`
}

// Pfop 持久化数据处理
//
// bucket		资源空间
// key			源资源名
// fops			云处理操作列表，用`;``分隔，如:`avthumb/flv;saveas/cWJ1Y2tldDpxa2V5`，是将上传的视频文件转码成flv格式后存储为 qbucket:qkey ，其中 cWJ1Y2tldDpxa2V5 是 qbucket:qkey 的URL安全的Base64编码结果。
// notifyURL	处理结果通知接收 URL，七牛将会向你设置的 URL 发起 Content-Type: application/json 的 POST 请求。
// pipeline		为空则表示使用公用队列，处理速度比较慢。建议指定私有队列，转码的时候使用独立的计算资源。
// force		强制执行数据处理。当服务端发现 fops 指定的数据处理结果已经存在，那就认为已经处理成功，避免重复处理浪费资源。本字段设为 `true`，则可强制执行数据处理并覆盖原结果。
//
func (p *Client) Pfop(ctx Context, bucket, key, fops, notifyURL, pipeline string, force bool) (persistentID string, err error) {
	pfopParams := map[string][]string{
		"bucket": []string{bucket},
		"key":    []string{key},
		"fops":   []string{fops},
	}
	if notifyURL != "" {
		pfopParams["notifyURL"] = []string{notifyURL}
	}
	if pipeline != "" {
		pfopParams["pipeline"] = []string{pipeline}
	}
	if force {
		pfopParams["force"] = []string{"1"}
	}
	var ret PfopResult
	err = p.CallWithForm(ctx, &ret, "POST", "http://api.qiniu.com/pfop/", pfopParams)
	if err != nil {
		return
	}

	persistentID = ret.PersistentID
	return
}

// Prefop 持久化处理状态查询
func (p *Client) Prefop(ctx Context, persistentID string) (ret FopRet, err error) {
	err = p.Call(ctx, &ret, "GET", "http://api.qiniu.com/status/get/prefop?id="+persistentID)
	return
}

// ----------------------------------------------------------

// ListItem List借口返回结果
type ListItem struct {
	Key      string `json:"key"`
	Hash     string `json:"hash"`
	Fsize    int64  `json:"fsize"`
	PutTime  int64  `json:"putTime"`
	MimeType string `json:"mimeType"`
	EndUser  string `json:"endUser"`
}

// List 首次请求，请将 marker 设置为 ""。
// 无论 err 值如何，均应该先看 entries 是否有内容。
// 如果后续没有更多数据，err 返回 EOF，markerOut 返回 ""（但不通过该特征来判断是否结束）。
//
func (p Bucket) List(
	ctx Context, prefix, delimiter, marker string, limit int) (entries []ListItem, commonPrefixes []string, markerOut string, err error) {

	listUrl := p.makeListURL(prefix, delimiter, marker, limit)

	var listRet struct {
		Marker   string     `json:"marker"`
		Items    []ListItem `json:"items"`
		Prefixes []string   `json:"commonPrefixes"`
	}
	err = p.Conn.Call(ctx, &listRet, "POST", listUrl)
	if err != nil {
		return
	}
	if listRet.Marker == "" {
		return listRet.Items, listRet.Prefixes, "", io.EOF
	}
	return listRet.Items, listRet.Prefixes, listRet.Marker, nil
}

func (p Bucket) makeListURL(prefix, delimiter, marker string, limit int) string {

	query := make(url.Values)
	query.Add("bucket", p.Name)
	if prefix != "" {
		query.Add("prefix", prefix)
	}
	if delimiter != "" {
		query.Add("delimiter", delimiter)
	}
	if marker != "" {
		query.Add("marker", marker)
	}
	if limit > 0 {
		query.Add("limit", strconv.FormatInt(int64(limit), 10))
	}
	return p.Conn.RSFHost + "/list?" + query.Encode()
}

// ----------------------------------------------------------

type BatchStatItemRet struct {
	Data  Entry  `json:"data"`
	Error string `json:"error"`
	Code  int    `json:"code"`
}

// BatchStat 批量取文件属性
func (p Bucket) BatchStat(ctx Context, keys ...string) (ret []BatchStatItemRet, err error) {

	b := make([]string, len(keys))
	for i, key := range keys {
		b[i] = URIStat(p.Name, key)
	}
	err = p.Conn.Batch(ctx, &ret, b)
	return
}

type BatchItemRet struct {
	Error string `json:"error"`
	Code  int    `json:"code"`
}

// BatchDelete 批量删除
func (p Bucket) BatchDelete(ctx Context, keys ...string) (ret []BatchItemRet, err error) {

	b := make([]string, len(keys))
	for i, key := range keys {
		b[i] = URIDelete(p.Name, key)
	}
	err = p.Conn.Batch(ctx, &ret, b)
	return
}

type KeyPair struct {
	Src  string
	Dest string
}

// BatchMove 批量移动文件
func (p Bucket) BatchMove(ctx Context, entries ...KeyPair) (ret []BatchItemRet, err error) {

	b := make([]string, len(entries))
	for i, e := range entries {
		b[i] = URIMove(p.Name, e.Src, p.Name, e.Dest)
	}
	err = p.Conn.Batch(ctx, &ret, b)
	return
}

// BatchCopy 批量复制文件
func (p Bucket) BatchCopy(ctx Context, entries ...KeyPair) (ret []BatchItemRet, err error) {

	b := make([]string, len(entries))
	for i, e := range entries {
		b[i] = URICopy(p.Name, e.Src, p.Name, e.Dest)
	}
	err = p.Conn.Batch(ctx, &ret, b)
	return
}

// ----------------------------------------------------------

func encodeURI(uri string) string {
	return base64.URLEncoding.EncodeToString([]byte(uri))
}

func uriFetch(bucket, key, url string) string {
	return "/fetch/" + encodeURI(url) + "/to/" + encodeURI(bucket+":"+key)
}

func URIDelete(bucket, key string) string {
	return "/delete/" + encodeURI(bucket+":"+key)
}

func URIStat(bucket, key string) string {
	return "/stat/" + encodeURI(bucket+":"+key)
}

func URICopy(bucketSrc, keySrc, bucketDest, keyDest string) string {
	return "/copy/" + encodeURI(bucketSrc+":"+keySrc) + "/" + encodeURI(bucketDest+":"+keyDest)
}

func URIMove(bucketSrc, keySrc, bucketDest, keyDest string) string {
	return "/move/" + encodeURI(bucketSrc+":"+keySrc) + "/" + encodeURI(bucketDest+":"+keyDest)
}

func URIChangeMime(bucket, key, mime string) string {
	return "/chgm/" + encodeURI(bucket+":"+key) + "/mime/" + encodeURI(mime)
}

func URIChangeType(bucket, key string, fileType int) string {
	return "/chtype/" + encodeURI(bucket+":"+key) + "/type/" + strconv.Itoa(fileType)
}

func URIDeleteAfterDays(bucket, key string, days int) string {
	return fmt.Sprintf("/deleteAfterDays/%s/%d", encodeURI(bucket+":"+key), days)
}

func URIImage(bucket, srcSiteURL, host string) string {
	return fmt.Sprintf("/image/%s/from/%s/host/%s", bucket, encodeURI(srcSiteURL), encodeURI(host))
}

func URIUnImage(bucket string) string {
	return fmt.Sprintf("/unimage/%s", bucket)
}

func URIPrefetch(bucket, key string) string {
	return fmt.Sprintf("/prefetch/%s", encodeURI(bucket+":"+key))
}

// ----------------------------------------------------------
