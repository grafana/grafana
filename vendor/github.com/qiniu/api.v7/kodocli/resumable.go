package kodocli

import (
	. "context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"sync"

	"github.com/qiniu/x/xlog.v7"
)

// ----------------------------------------------------------

var (
	ErrInvalidPutProgress = errors.New("invalid put progress")
	ErrPutFailed          = errors.New("resumable put failed")
	ErrUnmatchedChecksum  = errors.New("unmatched checksum")
	ErrBadToken           = errors.New("invalid token")
)

const (
	InvalidCtx = 701 // UP: 无效的上下文(bput)，可能情况：Ctx非法或者已经被淘汰（太久未使用）
)

const (
	defaultWorkers   = 4
	defaultChunkSize = 1 * 1024 * 1024 // 1M
	defaultTryTimes  = 3
)

type Settings struct {
	TaskQsize int // 可选。任务队列大小。为 0 表示取 Workers * 4。
	Workers   int // 并行 Goroutine 数目。
	ChunkSize int // 默认的Chunk大小，不设定则为1M
	TryTimes  int // 默认的尝试次数，不设定则为3
}

var settings = Settings{
	TaskQsize: defaultWorkers * 4,
	Workers:   defaultWorkers,
	ChunkSize: defaultChunkSize,
	TryTimes:  defaultTryTimes,
}

func SetSettings(v *Settings) {

	settings = *v
	if settings.Workers == 0 {
		settings.Workers = defaultWorkers
	}
	if settings.TaskQsize == 0 {
		settings.TaskQsize = settings.Workers * 4
	}
	if settings.ChunkSize == 0 {
		settings.ChunkSize = defaultChunkSize
	}
	if settings.TryTimes == 0 {
		settings.TryTimes = defaultTryTimes
	}
}

// ----------------------------------------------------------

var tasks chan func()

func worker(tasks chan func()) {
	for {
		task := <-tasks
		task()
	}
}

func initWorkers() {

	tasks = make(chan func(), settings.TaskQsize)
	for i := 0; i < settings.Workers; i++ {
		go worker(tasks)
	}
}

func notifyNil(blkIdx int, blkSize int, ret *BlkputRet) {}
func notifyErrNil(blkIdx int, blkSize int, err error)   {}

// ----------------------------------------------------------

const (
	blockBits = 22
	blockMask = (1 << blockBits) - 1
)

func BlockCount(fsize int64) int {
	return int((fsize + blockMask) >> blockBits)
}

// ----------------------------------------------------------

type BlkputRet struct {
	Ctx      string `json:"ctx"`
	Checksum string `json:"checksum"`
	Crc32    uint32 `json:"crc32"`
	Offset   uint32 `json:"offset"`
	Host     string `json:"host"`
}

type RputExtra struct {
	Params     map[string]string                             // 可选。用户自定义参数，以"x:"开头 否则忽略
	MimeType   string                                        // 可选。
	ChunkSize  int                                           // 可选。每次上传的Chunk大小
	TryTimes   int                                           // 可选。尝试次数
	Progresses []BlkputRet                                   // 可选。上传进度
	Notify     func(blkIdx int, blkSize int, ret *BlkputRet) // 可选。进度提示（注意多个block是并行传输的）
	NotifyErr  func(blkIdx int, blkSize int, err error)
}

var once sync.Once

// ----------------------------------------------------------

type Policy struct {
	Scope   string   `json:"scope"`
	UpHosts []string `json:"uphosts"`
}

func unmarshal(uptoken string, uptokenPolicy *Policy) (err error) {
	parts := strings.Split(uptoken, ":")
	if len(parts) != 3 {
		err = ErrBadToken
		return
	}
	b, err := base64.URLEncoding.DecodeString(parts[2])
	if err != nil {
		return err
	}
	return json.Unmarshal(b, uptokenPolicy)
}

func (p Uploader) getUpHostFromToken(uptoken string) (uphosts []string, err error) {
	if len(p.UpHosts) != 0 {
		uphosts = p.UpHosts
		return
	}
	ak := strings.Split(uptoken, ":")[0]
	uptokenPolicy := Policy{}
	err = unmarshal(uptoken, &uptokenPolicy)
	if err != nil {
		return
	}
	if len(uptokenPolicy.UpHosts) == 0 {
		bucketName := strings.Split(uptokenPolicy.Scope, ":")[0]
		bucketInfo, err1 := p.ApiCli.GetBucketInfo(ak, bucketName)
		if err1 != nil {
			err = err1
			return
		}
		uphosts = bucketInfo.UpHosts
	} else {
		uphosts = uptokenPolicy.UpHosts
	}
	return
}

// 上传一个文件，支持断点续传和分块上传。
//
// ctx     是请求的上下文。
// ret     是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken 是由业务服务器颁发的上传凭证。
// key     是要上传的文件访问路径。比如："foo/bar.jpg"。注意我们建议 key 不要以 '/' 开头。另外，key 为空字符串是合法的。
// f       是文件内容的访问接口。考虑到需要支持分块上传和断点续传，要的是 io.ReaderAt 接口，而不是 io.Reader。
// fsize   是要上传的文件大小。
// extra   是上传的一些可选项。详细见 RputExtra 结构的描述。
//
func (p Uploader) Rput(
	ctx Context, ret interface{}, uptoken string,
	key string, f io.ReaderAt, fsize int64, extra *RputExtra) error {

	return p.rput(ctx, ret, uptoken, key, true, f, fsize, extra)
}

// 上传一个文件，支持断点续传和分块上传。文件的访问路径（key）自动生成。
// 如果 uptoken 中设置了 SaveKey，那么按 SaveKey 要求的规则生成 key，否则自动以文件的 hash 做 key。
//
// ctx     是请求的上下文。
// ret     是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken 是由业务服务器颁发的上传凭证。
// f       是文件内容的访问接口。考虑到需要支持分块上传和断点续传，要的是 io.ReaderAt 接口，而不是 io.Reader。
// fsize   是要上传的文件大小。
// extra   是上传的一些可选项。详细见 RputExtra 结构的描述。
//
func (p Uploader) RputWithoutKey(
	ctx Context, ret interface{}, uptoken string, f io.ReaderAt, fsize int64, extra *RputExtra) error {

	return p.rput(ctx, ret, uptoken, "", false, f, fsize, extra)
}

// 上传一个文件，支持断点续传和分块上传。
// 和 Rput 不同的只是一个通过提供文件路径来访问文件内容，一个通过 io.ReaderAt 来访问。
//
// ctx       是请求的上下文。
// ret       是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken   是由业务服务器颁发的上传凭证。
// key       是要上传的文件访问路径。比如："foo/bar.jpg"。注意我们建议 key 不要以 '/' 开头。另外，key 为空字符串是合法的。
// localFile 是要上传的文件的本地路径。
// extra     是上传的一些可选项。详细见 RputExtra 结构的描述。
//
func (p Uploader) RputFile(
	ctx Context, ret interface{}, uptoken, key, localFile string, extra *RputExtra) (err error) {

	return p.rputFile(ctx, ret, uptoken, key, true, localFile, extra)
}

// 上传一个文件，支持断点续传和分块上传。文件的访问路径（key）自动生成。
// 如果 uptoken 中设置了 SaveKey，那么按 SaveKey 要求的规则生成 key，否则自动以文件的 hash 做 key。
// 和 RputWithoutKey 不同的只是一个通过提供文件路径来访问文件内容，一个通过 io.ReaderAt 来访问。
//
// ctx       是请求的上下文。
// ret       是上传成功后返回的数据。如果 uptoken 中没有设置 CallbackUrl 或 ReturnBody，那么返回的数据结构是 PutRet 结构。
// uptoken   是由业务服务器颁发的上传凭证。
// localFile 是要上传的文件的本地路径。
// extra     是上传的一些可选项。详细见 RputExtra 结构的描述。
//
func (p Uploader) RputFileWithoutKey(
	ctx Context, ret interface{}, uptoken, localFile string, extra *RputExtra) (err error) {

	return p.rputFile(ctx, ret, uptoken, "", false, localFile, extra)
}

// ----------------------------------------------------------

func (p Uploader) rput(
	ctx Context, ret interface{}, uptoken string,
	key string, hasKey bool, f io.ReaderAt, fsize int64, extra *RputExtra) error {

	once.Do(initWorkers)

	log := xlog.NewWith(ctx)
	blockCnt := BlockCount(fsize)

	if extra == nil {
		extra = new(RputExtra)
	}
	if extra.Progresses == nil {
		extra.Progresses = make([]BlkputRet, blockCnt)
	} else if len(extra.Progresses) != blockCnt {
		return ErrInvalidPutProgress
	}

	if extra.ChunkSize == 0 {
		extra.ChunkSize = settings.ChunkSize
	}
	if extra.TryTimes == 0 {
		extra.TryTimes = settings.TryTimes
	}
	if extra.Notify == nil {
		extra.Notify = notifyNil
	}
	if extra.NotifyErr == nil {
		extra.NotifyErr = notifyErrNil
	}
	uphosts, err := p.getUpHostFromToken(uptoken)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	wg.Add(blockCnt)

	last := blockCnt - 1
	blkSize := 1 << blockBits
	nfails := 0
	p.Conn.Client = newUptokenClient(uptoken, p.Conn.Transport)

	for i := 0; i < blockCnt; i++ {
		blkIdx := i
		blkSize1 := blkSize
		if i == last {
			offbase := int64(blkIdx) << blockBits
			blkSize1 = int(fsize - offbase)
		}
		task := func() {
			defer wg.Done()
			tryTimes := extra.TryTimes
		lzRetry:
			err := p.resumableBput(ctx, uphosts, &extra.Progresses[blkIdx], f, blkIdx, blkSize1, extra)
			if err != nil {
				if tryTimes > 1 {
					tryTimes--
					log.Info("resumable.Put retrying ...", blkIdx, "reason:", err)
					goto lzRetry
				}
				log.Warn("resumable.Put", blkIdx, "failed:", err)
				extra.NotifyErr(blkIdx, blkSize1, err)
				nfails++
			}
		}
		tasks <- task
	}

	wg.Wait()
	if nfails != 0 {
		return ErrPutFailed
	}

	return p.mkfile(ctx, uphosts, ret, key, hasKey, fsize, extra)
}

func (p Uploader) rputFile(
	ctx Context, ret interface{}, uptoken string,
	key string, hasKey bool, localFile string, extra *RputExtra) (err error) {

	f, err := os.Open(localFile)
	if err != nil {
		return
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return
	}

	return p.rput(ctx, ret, uptoken, key, hasKey, f, fi.Size(), extra)
}

// ----------------------------------------------------------
