# Testing Code that depends on Go Client Libraries

The Go client libraries generated as a part of `cloud.google.com/go` all take
the approach of returning concrete types instead of interfaces. That way, new
fields and methods can be added to the libraries without breaking users. This
document will go over some patterns that can be used to test code that depends
on the Go client libraries.

## Testing gRPC services using fakes

*Note*: You can see the full
[example code using a fake here](https://github.com/googleapis/google-cloud-go/tree/main/internal/examples/fake).

The clients found in `cloud.google.com/go` are gRPC based, with a couple of
notable exceptions being the [`storage`](https://pkg.go.dev/cloud.google.com/go/storage)
and [`bigquery`](https://pkg.go.dev/cloud.google.com/go/bigquery) clients.
Interactions with gRPC services can be faked by serving up your own in-memory
server within your test. One benefit of using this approach is that you don’t
need to define an interface in your runtime code; you can keep using
concrete struct types. You instead define a fake server in your test code. For
example, take a look at the following function:

```go
import (
        "context"
        "fmt"
        "log"
        "os"

        translate "cloud.google.com/go/translate/apiv3"
        "github.com/googleapis/gax-go/v2"
        translatepb "google.golang.org/genproto/googleapis/cloud/translate/v3"
)

func TranslateTextWithConcreteClient(client *translate.TranslationClient, text string, targetLang string) (string, error) {
        ctx := context.Background()
        log.Printf("Translating %q to %q", text, targetLang)
        req := &translatepb.TranslateTextRequest{
                Parent:             fmt.Sprintf("projects/%s/locations/global", os.Getenv("GOOGLE_CLOUD_PROJECT")),
                TargetLanguageCode: "en-US",
                Contents:           []string{text},
        }
        resp, err := client.TranslateText(ctx, req)
        if err != nil {
                return "", fmt.Errorf("unable to translate text: %v", err)
        }
        translations := resp.GetTranslations()
        if len(translations) != 1 {
                return "", fmt.Errorf("expected only one result, got %d", len(translations))
        }
        return translations[0].TranslatedText, nil
}
```

Here is an example of what a fake server implementation would look like for
faking the interactions above:

```go
import (
        "context"

        translatepb "google.golang.org/genproto/googleapis/cloud/translate/v3"
)

type fakeTranslationServer struct {
        translatepb.UnimplementedTranslationServiceServer
}

func (f *fakeTranslationServer) TranslateText(ctx context.Context, req *translatepb.TranslateTextRequest) (*translatepb.TranslateTextResponse, error) {
        resp := &translatepb.TranslateTextResponse{
                Translations: []*translatepb.Translation{
                        &translatepb.Translation{
                                TranslatedText: "Hello World",
                        },
                },
        }
        return resp, nil
}
```

All of the generated protobuf code found in [google.golang.org/genproto](https://pkg.go.dev/google.golang.org/genproto)
contains a similar `package.UnimplementedFooServer` type that is useful for
creating fakes. By embedding the unimplemented server in the
`fakeTranslationServer`, the fake will “inherit” all of the RPCs the server
exposes. Then, by providing our own `fakeTranslationServer.TranslateText`
method you can “override” the default unimplemented behavior of the one RPC that
you would like to be faked.

The test itself does require a little bit of setup: start up a `net.Listener`,
register the server, and tell the client library to call the server:

```go
import (
        "context"
        "net"
        "testing"

        translate "cloud.google.com/go/translate/apiv3"
        "google.golang.org/api/option"
        translatepb "google.golang.org/genproto/googleapis/cloud/translate/v3"
        "google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func TestTranslateTextWithConcreteClient(t *testing.T) {
        ctx := context.Background()

        // Setup the fake server.
        fakeTranslationServer := &fakeTranslationServer{}
        l, err := net.Listen("tcp", "localhost:0")
        if err != nil {
                t.Fatal(err)
        }
        gsrv := grpc.NewServer()
        translatepb.RegisterTranslationServiceServer(gsrv, fakeTranslationServer)
        fakeServerAddr := l.Addr().String()
        go func() {
                if err := gsrv.Serve(l); err != nil {
                        panic(err)
                }
        }()

        // Create a client.
        client, err := translate.NewTranslationClient(ctx,
                option.WithEndpoint(fakeServerAddr),
                option.WithoutAuthentication(),
                option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())),
        )
        if err != nil {
                t.Fatal(err)
        }

        // Run the test.
        text, err := TranslateTextWithConcreteClient(client, "Hola Mundo", "en-US")
        if err != nil {
                t.Fatal(err)
        }
        if text != "Hello World" {
                t.Fatalf("got %q, want Hello World", text)
        }
}
```

## Testing using mocks

*Note*: You can see the full
[example code using a mock here](https://github.com/googleapis/google-cloud-go/tree/main/internal/examples/mock).

When mocking code you need to work with interfaces. Let’s create an interface
for the `cloud.google.com/go/translate/apiv3` client used in the
`TranslateTextWithConcreteClient` function mentioned in the previous section.
The `translate.Client` has over a dozen methods but this code only uses one of
them. Here is an interface that satisfies the interactions of the
`translate.Client` in this function.

```go
type TranslationClient interface {
        TranslateText(ctx context.Context, req *translatepb.TranslateTextRequest, opts ...gax.CallOption) (*translatepb.TranslateTextResponse, error)
}
```

Now that we have an interface that satisfies the method being used we can
rewrite the function signature to take the interface instead of the concrete
type.

```go
func TranslateTextWithInterfaceClient(client TranslationClient, text string, targetLang string) (string, error) {
// ...
}
```

This allows a real `translate.Client` to be passed to the method in production
and for a mock implementation to be passed in during testing. This pattern can
be applied to any Go code, not just `cloud.google.com/go`. This is because
interfaces in Go are implicitly satisfied. Structs in the client libraries can
implicitly implement interfaces defined in your codebase. Let’s take a look at
what it might look like to define a lightweight mock for the `TranslationClient`
interface.

```go
import (
        "context"
        "testing"

        "github.com/googleapis/gax-go/v2"
        translatepb "google.golang.org/genproto/googleapis/cloud/translate/v3"
)

type mockClient struct{}

func (*mockClient) TranslateText(_ context.Context, req *translatepb.TranslateTextRequest, opts ...gax.CallOption) (*translatepb.TranslateTextResponse, error) {
        resp := &translatepb.TranslateTextResponse{
                Translations: []*translatepb.Translation{
                        &translatepb.Translation{
                                TranslatedText: "Hello World",
                        },
                },
        }
        return resp, nil
}

func TestTranslateTextWithAbstractClient(t *testing.T) {
        client := &mockClient{}
        text, err := TranslateTextWithInterfaceClient(client, "Hola Mundo", "en-US")
        if err != nil {
                t.Fatal(err)
        }
        if text != "Hello World" {
                t.Fatalf("got %q, want Hello World", text)
        }
}
```

If you prefer to not write your own mocks there are mocking frameworks such as
[golang/mock](https://github.com/golang/mock) which can generate mocks for you
from an interface. As a word of caution though, try to not
[overuse mocks](https://testing.googleblog.com/2013/05/testing-on-toilet-dont-overuse-mocks.html).

## Testing using emulators

Some of the client libraries provided in `cloud.google.com/go` support running
against a service emulator. The concept is similar to that of using fakes,
mentioned above, but the server is managed for you. You just need to start it up
and instruct the client library to talk to the emulator by setting a service
specific emulator environment variable. Current services/environment-variables
are:

- bigtable: `BIGTABLE_EMULATOR_HOST`
- datastore: `DATASTORE_EMULATOR_HOST`
- firestore: `FIRESTORE_EMULATOR_HOST`
- pubsub: `PUBSUB_EMULATOR_HOST`
- spanner: `SPANNER_EMULATOR_HOST`
- storage: `STORAGE_EMULATOR_HOST`
  - Although the storage client supports an emulator environment variable there is no official emulator provided by gcloud.

For more information on emulators please refer to the
[gcloud documentation](https://cloud.google.com/sdk/gcloud/reference/beta/emulators).
