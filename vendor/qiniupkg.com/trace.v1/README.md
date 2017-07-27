trace.v1 使用指南
===

## QuickStart

**最少只需添加 3 行代码**即可完成请求的链路追踪，并默认会记录关键时间点、请求的基础信息（BodySize/Path/Host/Address/Hostname/Reqid 等）。

追踪效果：

![trace](http://7aro2h.com1.z0.glb.clouddn.com/trace.png)

### 1. 初始化全局 tracer 配置

说明：若不对 trace 库做任何配置，默认不会记录任何 trace 相关的信息（但不妨碍代码正常调用）。

常见的配置过程如下（建议在服务启动后全局设置）：

__使用默认配置__：

```
trace.TracerEnable()
```

__指定服务名称__：

```
trace.TracerEnable(trace.SetService("<ServiceName>"))
```

其中：

- `ServiceName`: 用于告诉 trace 系统用什么名字指代该服务，不填则尝试取进程名为 serviceName

### 2. 配合 servestk.v1 跟踪服务端请求

servestk.v1 可以将多个 http Handler 合并为一个，并按压栈顺序包裹调用。所以只需将 trace.HTTPHandler 作为最后一个参数传入即可达到跟踪效果。

下面以 http 标准用法为例（其他 rpc 框架用法类似）：

```
import (
	"net/http"

	"qiniupkg.com/trace.v1"
	"github.com/qiniu/http/servestk.v1"
)

func main() {
	mux := trace.NewServeMux()
	// mux := trace.NewServeMuxWith(http.NewServeMux())
	// ...
	log.Fatal(http.ListenAndServe(":9876", mux))
}
```

### 3. 配合 xlog.v1 跟踪请求处理过程

在服务端处理请求的过程中，可使用 xlog.v1 将请求过程串联起来，并支持向该请求对应的 trace 过程添加自定义业务信息。

**A. 使用 *xlog.Logger 传递**

```
import (
	"net/http"
	"github.com/qiniu/xlog.v1"
)

func Handler(rw http.ResponseWriter, req *http.Request) {
	xl := xlog.New(rw, req)
	xl.T().Kv("some-key", "some-value")
	xl.T().Log("hi I'm a log with timestamp")

	f(xl, ...)
}

func f(xl *xlog.Logger, ...) {
	xl.T().Log("I'm a log with timestamp")
	xl.T().Kv("some-key", "some-value")
	...
}
```

**B. 使用 rpc.Logger 传递**

```
import (
	"net/http"
	"github.com/qiniu/xlog.v1"
	"github.com/qiniu/rpc.v1"
)

func Handler(rw http.ResponseWriter, req *http.Request) {
	xl := xlog.New(rw, req)
	xl.T().Log("I'm a log with timestamp")
	xl.T().Kv("some-key", "some-value")

	f(xl, ...)
}

func f(l rpc.Logger, ...) {
	r := trace.SafeRecorder(l)
	r.Log("I'm a log with timestamp")
	r.Kv("some-key", "some-value")
	...
}
```

**C. 使用 context.Context 传递**

```
import (
	"net/http"
	"github.com/qiniu/xlog.v1"
	"code.google.com/p/go.net/context"
)

func Handler(rw http.ResponseWriter, req *http.Request) {
	xl := xlog.New(rw, req)
	xl.T().Log("I'm a log with timestamp")
	xl.T().Kv("some-key", "some-value")

	f(xlog.NewContext(nil, xl), ...)
}

func f(ctx context.Context, ...) {
	xl := xlog.FromContextSafe(ctx)
	xl.T().Log("I'm a log with timestamp")
	xl.T().Kv("some-key", "some-value")
	...
}
```

### 3. 配合 rpc.v1/v2/v3/v7 跟踪客户端请求

使用 rpc.v1/v2/v3/v7 进行远程调用可确保新产生的 HTTP 请求也能够被关联到整个 trace 过程中。只需在调用 rpc 库时传入第 2 节中生成的 xlog.Logger 即可。具体请参考『完整示例 demo』一章。

### 4. 异步过程（队列传递）

调用方：

```
import (
	"net/http"
	"github.com/qiniu/xlog.v1"
)

func Handler(rw http.ResponseWriter, req *http.Request) {
	xl := xlog.New(rw, req)
	f(xl, ...)
}

func f(xl *xlog.Logger, ...) {
	
	t := xl.T().Child()
	defer t.Finish()

	// enqueue(TaskWithSpan(t.ID.ContextToken()))
	...
}
```

接收方：

```
import (
	"qiniupkg.com/trace.v1"
)

{
	// task := dequeue()
	// token := GetSpanFromTask(task)

	t := trace.FromContextToken(token).Async()
	defer t.Finish()
}
```


## 完整示例 demo（包含所有 rpc 版本）

下面完整实例了 api1 -> api2 -> api3 -> api4 -> api5 的过程。

演示步骤：

1. 编译并不带参运行下面这个 demo
2. curl http://127.0.0.1:9876/api1

```
package main

import (
	"log"
	"net/http"

	"github.com/qiniu/http/restrpc.v1"
	"github.com/qiniu/http/rpcutil.v1"
	rpcv1 "github.com/qiniu/rpc.v1"
	rpcv2 "github.com/qiniu/rpc.v2"
	rpcv3 "github.com/qiniu/rpc.v3"
	rpcv7 "qiniupkg.com/x/rpc.v7"
	"github.com/qiniu/xlog.v1"

	"qiniupkg.com/trace.v1"
	. "code.google.com/p/go.net/context"
)

type Service struct{}

// request entry
// api1 call api2
func (p *Service) GetApi1(env *rpcutil.Env) error {

	xl := xlog.NewWithReq(env.Req)
	xl.T().Log("im in api1")

	return rpcv1.DefaultClient.GetCall(xl, nil, "http://127.0.0.1:9876/api2")
}

// api2 call api3
func (p *Service) GetApi2(env *rpcutil.Env) error {

	xl := xlog.NewWithReq(env.Req)
	xl.T().Log("im in api2")

	return rpcv2.DefaultClient.Call(xl, nil, "GET", "http://127.0.0.1:9876/api3")
}

// api3 call api4
func (p *Service) GetApi3(env *rpcutil.Env) error {

	xl := xlog.NewWithReq(env.Req)
	xl.T().Log("im in api3")

	return rpcv3.DefaultClient.Call(xlog.NewContext(Background(), xl), nil, "GET", "http://127.0.0.1:9876/api4")
}

// api4 call api5
func (p *Service) GetApi4(env *rpcutil.Env) error {

	xl := xlog.NewWithReq(env.Req)
	xl.T().Log("im in api4")

	return rpcv7.DefaultClient.Call(xlog.NewContext(Background(), xl), nil, "GET", "http://127.0.0.1:9876/api5")
}

// api5 return
func (p *Service) GetApi5(env *rpcutil.Env) error {

	xl := xlog.NewWithReq(env.Req)
	xl.T().Log("im in api5")
	return nil
}

func main() {
	trace.TracerEnable(
		trace.SetService("trace-demo"),
		trace.SetSampler(trace.DummyTrueSampler), // 仅做演示使用，上线请勿添加此行
		trace.SetCollector(trace.StdoutCollector), // 仅做演示使用，上线请勿添加此行
	)
	r := restrpc.Router{
		Mux: trace.NewServeMuxWith(restrpc.NewServeMux()),
	}
	log.Fatal(http.ListenAndServe(":9876", r.Register(&Service{})))
}
```
