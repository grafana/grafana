package kodocli

import (
	"bytes"
	. "context"
	"fmt"
	"hash/crc32"
	"io"
	"mime/multipart"
	"net/textproto"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
)

// ----------------------------------------------------------

const (
	DontCheckCrc    = 0
	CalcAndCheckCrc = 1
	CheckCrc        = 2
)

// 上传的额外可选项
//
type PutExtra struct {
	// 可选，用户自定义参数，必须以 "x:" 开头。若不以x:开头，则忽略。
	Params map[string]string

	// 可选，当为 "" 时候，服务端自动判断。
	MimeType string

	Crc32 uint32

	// CheckCrc == 0 (DontCheckCrc): 表示不进行 crc32 校验
	// CheckCrc == 1 (CalcAndCheckCrc): 对于 Put 等同于 CheckCrc = 2；对于 PutFile 会自动计算 crc32 值
	// CheckCrc == 2 (CheckCrc): 表示进行 crc32 校验，且 crc32 值就是上面的 Crc32 变量
	CheckCrc uint32

	// 上传事件：进度通知。这个事件的回调函数应该尽可能快地结束。
	OnProgress func(fsize, uploaded int64)
}

// ----------------------------------------------------------

// 如果 uptoken 没有指定 ReturnBody，那么返回值是标准的 PutRet 结构
//
type PutRet struct {
	Hash         string `json:"hash"`
	PersistentId string `json:"persistentId"`
	Key          string `json:"key"`
}

// ----------------------------------------------------------

// 上传一个文件。
// 和 Put 不同的只是一个通过提供文件路径来访问文件内容，一个通过 io.Reader 来访问。
//
// ctx       是请求的上下文。
// ret       是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken   是由业务服务器颁发的上传凭证。
// key       是要上传的文件访问路径。比如："foo/bar.jpg"。注意我们建议 key 不要以 '/' 开头。另外，key 为空字符串是合法的。
// localFile 是要上传的文件的本地路径。
// extra     是上传的一些可选项。详细见 PutExtra 结构的描述。
//
func (p Uploader) PutFile(
	ctx Context, ret interface{}, uptoken, key, localFile string, extra *PutExtra) (err error) {

	return p.putFile(ctx, ret, uptoken, key, true, localFile, extra)
}

// 上传一个文件。文件的访问路径（key）自动生成。
// 如果 uptoken 中设置了 SaveKey，那么按 SaveKey 要求的规则生成 key，否则自动以文件的 hash 做 key。
// 和 RputWithoutKey 不同的只是一个通过提供文件路径来访问文件内容，一个通过 io.Reader 来访问。
//
// ctx       是请求的上下文。
// ret       是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken   是由业务服务器颁发的上传凭证。
// localFile 是要上传的文件的本地路径。
// extra     是上传的一些可选项。详细见 PutExtra 结构的描述。
//
func (p Uploader) PutFileWithoutKey(
	ctx Context, ret interface{}, uptoken, localFile string, extra *PutExtra) (err error) {

	return p.putFile(ctx, ret, uptoken, "", false, localFile, extra)
}

func (p Uploader) putFile(
	ctx Context, ret interface{}, uptoken string,
	key string, hasKey bool, localFile string, extra *PutExtra) (err error) {

	f, err := os.Open(localFile)
	if err != nil {
		return
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return
	}
	fsize := fi.Size()

	if extra != nil && extra.CheckCrc == 1 {
		extra.Crc32, err = getFileCrc32(f)
		if err != nil {
			return
		}
	}
	return p.put(ctx, ret, uptoken, key, hasKey, f, fsize, extra, filepath.Base(localFile))
}

// ----------------------------------------------------------

// 上传一个文件。
//
// ctx     是请求的上下文。
// ret     是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken 是由业务服务器颁发的上传凭证。
// key     是要上传的文件访问路径。比如："foo/bar.jpg"。注意我们建议 key 不要以 '/' 开头。另外，key 为空字符串是合法的。
// data    是文件内容的访问接口（io.Reader）。
// fsize   是要上传的文件大小。
// extra   是上传的一些可选项。详细见 PutExtra 结构的描述。
//
func (p Uploader) Put(
	ctx Context, ret interface{}, uptoken, key string, data io.Reader, size int64, extra *PutExtra) error {

	return p.put(ctx, ret, uptoken, key, true, data, size, extra, path.Base(key))
}

// 上传一个文件。文件的访问路径（key）自动生成。
// 如果 uptoken 中设置了 SaveKey，那么按 SaveKey 要求的规则生成 key，否则自动以文件的 hash 做 key。
//
// ctx     是请求的上下文。
// ret     是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken 是由业务服务器颁发的上传凭证。
// data    是文件内容的访问接口（io.Reader）。
// fsize   是要上传的文件大小。
// extra   是上传的一些可选项。详细见 PutExtra 结构的描述。
//
func (p Uploader) PutWithoutKey(
	ctx Context, ret interface{}, uptoken string, data io.Reader, size int64, extra *PutExtra) error {

	return p.put(ctx, ret, uptoken, "", false, data, size, extra, "filename")
}

// ----------------------------------------------------------

var defaultPutExtra PutExtra

func (p Uploader) put(
	ctx Context, ret interface{}, uptoken string,
	key string, hasKey bool, data io.Reader, size int64, extra *PutExtra, fileName string) error {

	uphosts, err := p.getUpHostFromToken(uptoken)
	if err != nil {
		return err
	}
	var b bytes.Buffer
	writer := multipart.NewWriter(&b)

	if extra == nil {
		extra = &defaultPutExtra
	}

	if extra.OnProgress != nil {
		data = &readerWithProgress{reader: data, fsize: size, onProgress: extra.OnProgress}
	}

	err = writeMultipart(writer, uptoken, key, hasKey, extra, fileName)
	if err != nil {
		return err
	}

	lastLine := fmt.Sprintf("\r\n--%s--\r\n", writer.Boundary())
	r := strings.NewReader(lastLine)

	bodyLen := int64(-1)
	if size >= 0 {
		bodyLen = int64(b.Len()) + size + int64(len(lastLine))
	}
	mr := io.MultiReader(&b, data, r)

	contentType := writer.FormDataContentType()
	err = p.Conn.CallWith64(ctx, ret, "POST", uphosts[0], contentType, mr, bodyLen)
	if err != nil {
		return err
	}
	if extra.OnProgress != nil {
		extra.OnProgress(size, size)
	}
	return err
}

// ----------------------------------------------------------

type readerWithProgress struct {
	reader     io.Reader
	uploaded   int64
	fsize      int64
	onProgress func(fsize, uploaded int64)
}

func (p *readerWithProgress) Read(b []byte) (n int, err error) {

	if p.uploaded > 0 {
		p.onProgress(p.fsize, p.uploaded)
	}

	n, err = p.reader.Read(b)
	p.uploaded += int64(n)
	return
}

// ----------------------------------------------------------

func writeMultipart(
	writer *multipart.Writer, uptoken, key string, hasKey bool, extra *PutExtra, fileName string) (err error) {

	//token
	if err = writer.WriteField("token", uptoken); err != nil {
		return
	}

	//key
	if hasKey {
		if err = writer.WriteField("key", key); err != nil {
			return
		}
	}

	//extra.Params
	if extra.Params != nil {
		for k, v := range extra.Params {
			if strings.HasPrefix(k, "x:") {
				err = writer.WriteField(k, v)
				if err != nil {
					return
				}
			}
		}
	}

	//extra.CheckCrc
	if extra.CheckCrc != 0 {
		err = writer.WriteField("crc32", strconv.FormatInt(int64(extra.Crc32), 10))
		if err != nil {
			return
		}
	}

	//file
	head := make(textproto.MIMEHeader)
	head.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, escapeQuotes(fileName)))
	if extra.MimeType != "" {
		head.Set("Content-Type", extra.MimeType)
	}

	_, err = writer.CreatePart(head)
	return err
}

var quoteEscaper = strings.NewReplacer("\\", "\\\\", `"`, "\\\"")

func escapeQuotes(s string) string {
	return quoteEscaper.Replace(s)
}

// ----------------------------------------------------------

func getFileCrc32(f *os.File) (uint32, error) {

	h := crc32.NewIEEE()
	_, err := io.Copy(h, f)
	f.Seek(0, 0)

	return h.Sum32(), err
}

// ----------------------------------------------------------
