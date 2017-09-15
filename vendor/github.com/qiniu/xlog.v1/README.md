xlog.v1 tracing 功能使用指南
===

### 文档说明

* xlog.v1 已支持 trace.v1 请求追踪功能，结合 servestk.v1 + rpc.v1/v2/v3/v7 可以完成对完整的请求链进行跟踪记录
* xlog.v1 在 trace.DefaultTracer 未 Enable 的情况下不会产生任何请求追踪效果
* 下文主要介绍 xlog.v1 在 trace.DefaultTracer Enable 的情况下的使用方式（**请注意区分日志记录方式**）


### 1. 使用 xlog 记录程序运行日志（非 tracing）

若希望将一些信息关联到 xlog.Logger 对应的请求上，并记录到本地程序运行日志中，那么使用 xlog.Logger 对象自身的一些日志方法即可，例如：

```
xl := xlog.New(rw, req)
xl.Error("some error message")
xl.Info("some infomation")
...
```

注意：**以上的方法记录的日志信息与 tracing 系统无关，日志内容只会同程序标准输出一样被日志系统收集。**

### 2. 服务端使用 xlog 追踪请求（tracing 日志）

利用 xlog.Logger.T() 返回的 trace.Recorder 对象可以将一些信息关联到当前的请求上，并最终被  tracing 系统收集、分析、展示。

**PreA. 使用 trace.HTTPHandler**

若希望 trace 信息能够通过 xlog 记录下来，首先需使用 trace.HTTPHandler 包裹所有的 handler，例如：


```
import (
	"net/http"
	"qiniupkg.com/trace.v1"
	"github.com/qiniu/http/servestk.v1"
)

func main {
	mux := servestk.New(http.NewServeMux(), trace.HTTPHandler)
	http.ListenAndServe(":9876", mux)
}
```

**A. 使用 *xlog.Logger 传递**

```
import (
	"net/http"
	"github.com/qiniu/xlog.v1"
)

func Handler(rw http.ResponseWriter, req *http.Request) {
	xl := xlog.New(rw, req)

	xl.T().Name("my-name")
	xl.T().Kv("some-key", "some-value")
	xl.T().Log("hi I'm a log with timestamp")
	xl.T().LogAt("I was born at", time.Now())

	f(xl, ...)
}

func f(xl *xlog.Logger, ...) {
	...
	xl.T().Kv("some-key", "some-value")
	xl.T().Log("I'm a log with timestamp")
	xl.T().LogAt("I was born at", time.Now())
	...
}
```

**B. 使用 rpc.Logger 传递**

```
import (
	"net/http"
	"github.com/qiniu/rpc.v1"
	"github.com/qiniu/xlog.v1"
	"qiniupkg.com/trace.v1"
)

func Handler(rw http.ResponseWriter, req *http.Request) {
	xl := xlog.New(rw, req)

	xl.T().Name("my-name")
	xl.T().Kv("some-key", "some-value")
	xl.T().Log("I'm a log with timestamp")
	xl.T().LogAt("I was born at", time.Now())

	f(xl, ...)
}

func f(l rpc.Logger, ...) {
	t := trace.SafeRecorder(l)
	...
	t.Kv("some-key", "some-value")
	t.Log("I'm a log with timestamp")
	t.LogAt("I was born at", time.Now())
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

	xl.T().Name("my-name")
	xl.T().Kv("some-key", "some-value")
	xl.T().Log("I'm a log with timestamp")
	xl.T().LogAt("I was born at", time.Now())

	f(xlog.NewContext(context.Background(), xl), ...)
}

func f(ctx context.Context, ...) {
	xl := xlog.FromContextSafe(ctx)
	...
	xl.T().Kv("some-key", "some-value")
	xl.T().Log("I'm a log with timestamp")
	xl.T().LogAt("I was born at", time.Now())
	...
}
```
