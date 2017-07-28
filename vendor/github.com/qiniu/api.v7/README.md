github.com/qiniu/api.v7 (Qiniu Go SDK v7.x)
===============

[![Build Status](https://travis-ci.org/qiniu/api.v7.svg?branch=develop)](https://travis-ci.org/qiniu/api.v7) [![GoDoc](https://godoc.org/github.com/qiniu/api.v7?status.svg)](https://godoc.org/github.com/qiniu/api.v7)

[![Qiniu Logo](http://open.qiniudn.com/logo.png)](http://qiniu.com/)

# 下载

```
go get -u github.com/qiniu/api.v7
```
如果碰到golang.org/x/net/context 不能下载，请把 http://devtools.qiniu.com/golang.org.x.net.context.tgz 下载到代码目录下并解压到src目录，或者直接下载全部 http://devtools.qiniu.com/qiniu_api_v7.tgz。

# 使用文档

## KODO Blob Storage (七牛对象存储)

* [github.com/qiniu/api.v7/kodo](http://godoc.org/github.com/qiniu/api.v7/kodo)
* [github.com/qiniu/api.v7/kodocli](http://godoc.org/github.com/qiniu/api.v7/kodocli)

如果您是在业务服务器（服务器端）调用七牛云存储的服务，请使用 [github.com/qiniu/api.v7/kodo](http://godoc.org/github.com/qiniu/api.v7/kodo)。

如果您是在客户端（比如：Android/iOS 设备、Windows/Mac/Linux 桌面环境）调用七牛云存储的服务，请使用 [github.com/qiniu/api.v7/kodocli](http://godoc.org/github.com/qiniu/api.v7/kodocli)。注意，在这种场合下您不应该在任何地方配置 AccessKey/SecretKey。泄露 AccessKey/SecretKey 如同泄露您的用户名/密码一样十分危险，会影响您的数据安全。

