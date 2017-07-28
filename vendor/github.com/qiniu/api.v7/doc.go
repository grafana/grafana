/*
包 github.com/qiniu/api.v7 是七牛 Go 语言 SDK v7.x 版本

七牛对象存储，我们取了一个好听的名字，叫 KODO Blob Storage。要使用它，你主要和以下两个包打交道：

	import "github.com/qiniu/api.v7/kodo"
	import "github.com/qiniu/api.v7/kodocli"

如果您是在业务服务器（服务器端）调用七牛云存储的服务，请使用 github.com/qiniu/api.v7/kodo。

如果您是在客户端（比如：Android/iOS 设备、Windows/Mac/Linux 桌面环境）调用七牛云存储的服务，请使用 github.com/qiniu/api.v7/kodocli。
注意，在这种场合下您不应该在任何地方配置 AccessKey/SecretKey。泄露 AccessKey/SecretKey 如同泄露您的用户名/密码一样十分危险，
会影响您的数据安全。
*/
package api

import (
	_ "github.com/qiniu/api.v7/auth/qbox"
	_ "github.com/qiniu/api.v7/cdn"
	_ "github.com/qiniu/api.v7/conf"
	_ "github.com/qiniu/api.v7/kodo"
	_ "github.com/qiniu/api.v7/kodocli"
)
