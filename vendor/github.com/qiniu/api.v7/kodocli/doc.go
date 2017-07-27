/*
包 github.com/qiniu/api.v7/kodocli 提供了在客户端调用七牛云存储部分服务的能力

客户端，严谨说是非可信环境，主要是指在用户端执行的环境，比如：Android/iOS 设备、Windows/Mac/Linux 桌面环境、也包括浏览器（如果浏览器能够执行 Go 语言代码的话）。

注意，在这种场合下您不应该在任何地方配置 AccessKey/SecretKey。泄露 AccessKey/SecretKey 如同泄露您的用户名/密码一样十分危险，会影响您的数据安全。

第一个问题是如何上传文件。因为是在非可信环境，所以我们首先是要授予它有上传文件的能力。答案是给它颁发上传凭证。假设服务端也是 Go 语言，那么：

	import "github.com/qiniu/api.v7/kodo"

	kodo.SetMac("your-access-key", "your-secret-key") // 配置 AccessKey/SecretKey

	zone := kodo.ZoneZ0
	c := kodo.New(zone, nil) // 创建一个 Client 对象

	bucket := "your-bucket-name"
	key := "foo/bar.jpg"
	policy := &kodo.PutPolicy{
		Scope: bucket + ":" + key, // 上传文件的限制条件，这里限制只能上传一个名为 "foo/bar.jpg" 的文件
		Expires: 3600, // 这是限制上传凭证(uptoken)的过期时长，3600 是一小时
		...
	}
	uptoken := c.MakeUptoken(policy) // 生成上传凭证

生成上传凭证之后，通过某种方式将 uptoken 发送到客户端。这样客户端就可以上传文件了：

	zone := 0
	uploader := kodocli.NewUploader(zone, nil)
	ctx := context.Background()

	key := "foo/bar.jpg"
	localFile := "/your/local/image/file.jpg"
	err := uploader.PutFile(ctx, nil, uptoken, key, localFile, nil)
	if err != nil {
		... // 上传文件失败处理
		return
	}

注意，如果客户端上传的 key 不是 uptoken 所要求的 "foo/bar.jpg"，那么上传就会被拒绝。

如果我们希望一个 uptoken 可以上传多个文件，那么服务端颁发 uptoken 的代码需要调整下：

	bucket := "your-bucket-name"
	policy := &kodo.PutPolicy{
		Scope: bucket, // 上传文件的限制条件，这里是只限制了要上传到 "your-bucket-name" 空间
		Expires: 3600, // 这是限制上传凭证(uptoken)的过期时长，3600 是一小时
		...
	}
	uptoken := c.MakeUptoken(policy)

颁发这样的 uptoken 给客户端，客户端就可以用它上传任意名字(key)的文件，前提是服务器上还没有同名的文件。

特别需要注意的是，这种情况下服务端会拒绝已经有同名文件的上传请求，而不是覆盖服务器上已有的文件。这是出于数据安全的考虑。我们并不非常推荐 uptoken 复用的做法，除了注意文件名可能冲突外，还需要注意 uptoken 是有时效的，过期就需要重新向服务器申请新的上传凭证。

搞定文件的上传后，第二个问题是如何下载文件。如果是公开文件，我们只需要：

	import "net/http"

	domain := "domain-of-your-bucket.com" // 您的空间绑定的域名，这个可以在七牛的Portal中查到
	baseUrl := kodocli.MakeBaseUrl(domain, "foo/bar.jpg") // 得到下载 url
	resp, err := http.Get(baseUrl)
	...

但是对于私有空间，事情要复杂一些，需要客户端向您的业务服务器申请下载该文件。业务服务器确认该用户有权访问，则返回一个临时有效的 privateUrl。具体如何生成 privateUrl，可以看服务端 SDK 相关的文档介绍。
*/
package kodocli
