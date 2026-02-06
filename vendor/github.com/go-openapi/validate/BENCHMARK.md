# Benchmark

Validating the Kubernetes Swagger API

## v0.22.6: 60,000,000 allocs
```
goos: linux
goarch: amd64
pkg: github.com/go-openapi/validate
cpu: AMD Ryzen 7 5800X 8-Core Processor
Benchmark_KubernetesSpec/validating_kubernetes_API-16         	       1	8549863982 ns/op	7067424936 B/op	59583275 allocs/op
```

## After refact PR: minor but noticable improvements: 25,000,000 allocs
```
go test -bench Spec
goos: linux
goarch: amd64
pkg: github.com/go-openapi/validate
cpu: AMD Ryzen 7 5800X 8-Core Processor
Benchmark_KubernetesSpec/validating_kubernetes_API-16         	       1	4064535557 ns/op	3379715592 B/op	25320330 allocs/op
```

## After reduce GC pressure PR: 17,000,000 allocs
```
goos: linux
goarch: amd64
pkg: github.com/go-openapi/validate
cpu: AMD Ryzen 7 5800X 8-Core Processor             
Benchmark_KubernetesSpec/validating_kubernetes_API-16         	       1	3758414145 ns/op	2593881496 B/op	17111373 allocs/op
```
