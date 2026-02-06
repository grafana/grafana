<h1><a href="https://expr-lang.org"><img src="https://expr-lang.org/img/logo.png" alt="Zx logo" height="48"align="right"></a> Expr</h1>

> [!IMPORTANT]
> The repository [github.com/antonmedv/expr](https://github.com/antonmedv/expr) moved to [github.com/**expr-lang**/expr](https://github.com/expr-lang/expr).

[![test](https://github.com/expr-lang/expr/actions/workflows/test.yml/badge.svg)](https://github.com/expr-lang/expr/actions/workflows/test.yml) 
[![Go Report Card](https://goreportcard.com/badge/github.com/expr-lang/expr)](https://goreportcard.com/report/github.com/expr-lang/expr) 
[![Fuzzing Status](https://oss-fuzz-build-logs.storage.googleapis.com/badges/expr.svg)](https://bugs.chromium.org/p/oss-fuzz/issues/list?sort=-opened&can=1&q=proj:expr)
[![GoDoc](https://godoc.org/github.com/expr-lang/expr?status.svg)](https://godoc.org/github.com/expr-lang/expr)

**Expr** is a Go-centric expression language designed to deliver dynamic configurations with unparalleled accuracy, safety, and speed. 
**Expr** combines simple [syntax](https://expr-lang.org/docs/language-definition) with powerful features for ease of use:

```js
// Allow only admins and moderators to moderate comments.
user.Group in ["admin", "moderator"] || user.Id == comment.UserId
```

```js
// Determine whether the request is in the permitted time window.
request.Time - resource.Age < duration("24h")
```

```js
// Ensure all tweets are less than 240 characters.
all(tweets, len(.Content) <= 240)
```

## Features

**Expr** is a safe, fast, and intuitive expression evaluator optimized for the Go language. 
Here are its standout features:

### Safety and Isolation
* **Memory-Safe**: Expr is designed with a focus on safety, ensuring that programs do not access unrelated memory or introduce memory vulnerabilities.
* **Side-Effect-Free**: Expressions evaluated in Expr only compute outputs from their inputs, ensuring no side-effects that can change state or produce unintended results.
* **Always Terminating**: Expr is designed to prevent infinite loops, ensuring that every program will conclude in a reasonable amount of time.

### Go Integration
* **Seamless with Go**: Integrate Expr into your Go projects without the need to redefine types.

### Static Typing
* Ensures type correctness and prevents runtime type errors.
  ```go
  out, err := expr.Compile(`name + age`)
  // err: invalid operation + (mismatched types string and int)
  // | name + age
  // | .....^
  ```

### User-Friendly
* Provides user-friendly error messages to assist with debugging and development.

### Flexibility and Utility
* **Rich Operators**: Offers a reasonable set of basic operators for a variety of applications.
* **Built-in Functions**: Functions like `all`, `none`, `any`, `one`, `filter`, and `map` are provided out-of-the-box.

### Performance
* **Optimized for Speed**: Expr stands out in its performance, utilizing an optimizing compiler and a bytecode virtual machine. Check out these [benchmarks](https://github.com/antonmedv/golang-expression-evaluation-comparison#readme) for more details.

## Install

```
go get github.com/expr-lang/expr
```

## Documentation

* See [Getting Started](https://expr-lang.org/docs/Getting-Started) page for developer documentation.
* See [Language Definition](https://expr-lang.org/docs/language-definition) page to learn the syntax.

## Examples

[Play Online](https://go.dev/play/p/XCoNXEjm3TS)

```go
package main

import (
	"fmt"
	"github.com/expr-lang/expr"
)

func main() {
	env := map[string]interface{}{
		"greet":   "Hello, %v!",
		"names":   []string{"world", "you"},
		"sprintf": fmt.Sprintf,
	}

	code := `sprintf(greet, names[0])`

	program, err := expr.Compile(code, expr.Env(env))
	if err != nil {
		panic(err)
	}

	output, err := expr.Run(program, env)
	if err != nil {
		panic(err)
	}

	fmt.Println(output)
}
```

[Play Online](https://go.dev/play/p/tz-ZneBfSuw)

```go
package main

import (
	"fmt"
	"github.com/expr-lang/expr"
)

type Tweet struct {
	Len int
}

type Env struct {
	Tweets []Tweet
}

func main() {
	code := `all(Tweets, {.Len <= 240})`

	program, err := expr.Compile(code, expr.Env(Env{}))
	if err != nil {
		panic(err)
	}

	env := Env{
		Tweets: []Tweet{{42}, {98}, {69}},
	}
	output, err := expr.Run(program, env)
	if err != nil {
		panic(err)
	}

	fmt.Println(output)
}
```

## Who uses Expr?

* [Google](https://google.com) uses Expr as one of its expression languages on the [Google Cloud Platform](https://cloud.google.com).
* [Uber](https://uber.com) uses Expr to allow customization of its Uber Eats marketplace.
* [GoDaddy](https://godaddy.com) employs Expr for the customization of its GoDaddy Pro product.
* [ByteDance](https://bytedance.com) incorporates Expr into its internal business rule engine.
* [Aviasales](https://aviasales.ru) utilizes Expr as a business rule engine for its flight search engine.
* [Alibaba](https://alibaba.com) uses Expr in a web framework for building recommendation services.
* [Argo](https://argoproj.github.io) integrates Expr into Argo Rollouts and Argo Workflows for Kubernetes.
* [Wish.com](https://www.wish.com) employs Expr in its decision-making rule engine for the Wish Assistant.
* [OpenTelemetry](https://opentelemetry.io) integrates Expr into the OpenTelemetry Collector.
* [Philips Labs](https://github.com/philips-labs/tabia) employs Expr in Tabia, a tool designed to collect insights on their code bases.
* [CrowdSec](https://crowdsec.net) incorporates Expr into its security automation tool.
* [CoreDNS](https://coredns.io) uses Expr in CoreDNS, which is a DNS server.
* [qiniu](https://www.qiniu.com) implements Expr in its trade systems.
* [Junglee Games](https://www.jungleegames.com/) uses Expr for its in-house marketing retention tool, Project Audience.
* [Faceit](https://www.faceit.com) uses Expr to enhance customization of its eSports matchmaking algorithm.
* [Chaos Mesh](https://chaos-mesh.org) incorporates Expr into Chaos Mesh, a cloud-native Chaos Engineering platform.
* [Visually.io](https://visually.io) employs Expr as a business rule engine for its personalization targeting algorithm.
* [Akvorado](https://github.com/akvorado/akvorado) utilizes Expr to classify exporters and interfaces in network flows.
* [keda.sh](https://keda.sh) uses Expr to allow customization of its Kubernetes-based event-driven autoscaling.
* [Span Digital](https://spandigital.com/) uses Expr in its Knowledge Management products.
* [Xiaohongshu](https://www.xiaohongshu.com/) combining yaml with Expr for dynamically policies delivery.
* [Melrōse](https://melrōse.org) uses Expr to implement its music programming language.
* [Tork](https://www.tork.run/) integrates Expr into its workflow execution.
* [Critical Moments](https://criticalmoments.io) uses Expr for its mobile realtime conditional targeting system.
* [WoodpeckerCI](https://woodpecker-ci.org) uses Expr for [filtering workflows/steps](https://woodpecker-ci.org/docs/usage/workflow-syntax#evaluate).
* [FastSchema](https://github.com/fastschema/fastschema) - A BaaS leveraging Expr for its customizable and dynamic Access Control system.
* [WunderGraph Cosmo](https://github.com/wundergraph/cosmo) - GraphQL Federeration Router uses Expr to customize Middleware behaviour
* [SOLO](https://solo.one) uses Expr interally to allow dynamic code execution with custom defined functions.
* [Naoma.AI](https://www.naoma.ai) uses Expr as a part of its call scoring engine.

[Add your company too](https://github.com/expr-lang/expr/edit/master/README.md)

## License

[MIT](https://github.com/expr-lang/expr/blob/master/LICENSE)

<p align="center"><img src="https://expr-lang.org/img/gopher-small.png" width="150" /></p>
