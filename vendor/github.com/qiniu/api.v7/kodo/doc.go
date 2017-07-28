/*
包 github.com/qiniu/api.v7/kodo 提供了在您的业务服务器（服务端）调用七牛云存储服务的能力

首先，我们要配置下 AccessKey/SecretKey，这可以在七牛 Portal 中查到：

	kodo.SetMac("your-access-key", "your-secret-key")

然后我们创建一个 Client 对象：

	zone := kodo.ZoneZ0 // 您空间(Bucket)所在的区域
	c := kodo.New(zone, nil) // 用默认配置创建 Client

有了 Client，你就可以操作您的空间(Bucket)了，比如我们要上传一个文件：

	import "golang.org/x/net/context"

	bucket := c.Bucket("your-bucket-name")
	ctx := context.Background()
	...
	localFile := "/your/local/image/file.jpg"
	err := bucket.PutFile(ctx, nil, "foo/bar.jpg", localFile, nil)
	if err != nil {
		... // 上传文件失败处理
		return
	}
	// 上传文件成功
	// 这时登录七牛Portal，在 your-bucket-name 空间就可以看到一个 foo/bar.jpg 的文件了

当然，除了上传文件，各种空间(Bucket)相关的操作都可以有，最常见自然是增删改查了：

	entry, err := bucket.Stat(ctx, "foo/bar.jpg") // 看看空间中是否存在某个文件，其属性是什么
	bucket.Delete(ctx, "foo/bar.jpg") // 删除空间中的某个文件
	bucket.ChangeMime(ctx, "foo/bar.jpg", "image/jpeg") // 修改某个文件的 MIME 属性
	bucket.Move(ctx, "foo/bar.jpg", "new-name.jpg") // 移动文件
	bucket.Copy(ctx, "foo/bar.jpg", "new-copy-file.jpg") // 复制文件

等等... 请问怎么下载文件？如果是公开文件，我们只需要：

	import "net/http"

	domain := "domain-of-your-bucket.com" // 您的空间绑定的域名，这个可以在七牛的Portal中查到
	baseUrl := kodo.MakeBaseUrl(domain, "foo/bar.jpg") // 得到下载 url
	resp, err := http.Get(baseUrl)
	...

但是对于私有空间，事情要复杂一些，访问上面的 baseUrl 会被拒绝。我们需要多做一步：

	privateUrl := c.MakePrivateUrl(baseUrl, nil) // 用默认的下载策略去生成私有下载的 url
	resp, err := http.Get(privateUrl)
	...
*/
package kodo
