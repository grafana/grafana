/*
包 github.com/qiniu/api.v7/cdn 提供了七牛CDN的API功能
首先，我们要配置下 AccessKey/SecretKey,
	import "github.com/qiniu/api.v7/kodo"

	kodo.SetMac("ak", "sk")
设置了AccessKey/SecretKey 就可以使用cdn的各类功能

比如我们要生成一个带时间戳防盗链的链接：
	q :=url.Values{}// url.Values 请求参数
	link, err := cdn.CreateTimestampAntileechURL(""http://www.qiniu.com/abc/bcc/aa-s.mp4?x=2&y=3", "encryptedkey", 20)
	if err != nil {
		fmt.Println(err)
	}
	fmt.Println(link)

又或者我们要列出CDN日志及其下载地址：
	resp, err := cdn.GetCdnLogList("2016-12-26", "x-mas.com")
	if err != nil {
		fmt.Println(err)
	}
	fmt.Println(resp)

*/
package cdn
