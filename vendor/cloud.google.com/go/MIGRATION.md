# Code Changes

## v0.10.0

- pubsub: Replace

    ```
    sub.ModifyPushConfig(ctx, pubsub.PushConfig{Endpoint: "https://example.com/push"})
    ```

  with

    ```
    sub.Update(ctx, pubsub.SubscriptionConfigToUpdate{
        PushConfig: &pubsub.PushConfig{Endpoint: "https://example.com/push"},
    })
    ```

- trace: traceGRPCServerInterceptor will be provided from *trace.Client.
Given an initialized `*trace.Client` named `tc`, instead of

    ```
    s := grpc.NewServer(grpc.UnaryInterceptor(trace.GRPCServerInterceptor(tc)))
    ```

  write

    ```
    s := grpc.NewServer(grpc.UnaryInterceptor(tc.GRPCServerInterceptor()))
    ```

- trace trace.GRPCClientInterceptor will also provided from *trace.Client.
Instead of

    ```
    conn, err := grpc.Dial(srv.Addr, grpc.WithUnaryInterceptor(trace.GRPCClientInterceptor()))
    ```

  write

    ```
    conn, err := grpc.Dial(srv.Addr, grpc.WithUnaryInterceptor(tc.GRPCClientInterceptor()))
    ```

- trace: We removed the deprecated `trace.EnableGRPCTracing`. Use the gRPC
interceptor as a dial option as shown below when initializing Cloud package
clients:

    ```
    c, err := pubsub.NewClient(ctx, "project-id", option.WithGRPCDialOption(grpc.WithUnaryInterceptor(tc.GRPCClientInterceptor())))
    if err != nil {
        ...
    }
    ```
