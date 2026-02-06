## Retry Interceptor

The `retry` interceptor is a client-side middleware for gRPC that provides a generic mechanism to retry requests based on gRPC response codes.

### Build Flags

The `retry` interceptor supports a build flag `retrynotrace` to disable tracing for retry attempts.
This can be useful to avoid importing `golang.org/x/net/trace`, which allows for more aggressive deadcode elimination. This can yield improvements in binary size when tracing is not needed.

To build your application with the `retrynotrace` flag, use the following command:

```shell
go build -tags retrynotrace -o your_application
```

### Usage

To use the `retry` interceptor, you need to add it to your gRPC client interceptor chain:

```go
import (
    "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/retry"
    "google.golang.org/grpc"
)

func main() {
    opts := []grpc.DialOption{
        grpc.WithUnaryInterceptor(retry.UnaryClientInterceptor(
            retry.WithMax(3), // Maximum number of retries
            retry.WithPerRetryTimeout(2*time.Second), // Timeout per retry
        )),
    }

    conn, err := grpc.NewClient("your_grpc_server_address", opts...)
    if err != nil {
        log.Fatalf("Failed to connect: %v", err)
    }
    defer conn.Close()

    // Your gRPC client code here
}
```

### Configuration Options

- `retry.WithMax(maxRetries int)`: Sets the maximum number of retry attempts.
- `retry.WithPerRetryTimeout(timeout time.Duration)`: Sets the timeout for each retry attempt.
- `retry.WithBackoff(backoffFunc retry.BackoffFunc)`: Sets a custom backoff strategy.
- `retry.WithCodes(codes ...codes.Code)`: Specifies the gRPC response codes that should trigger a retry.