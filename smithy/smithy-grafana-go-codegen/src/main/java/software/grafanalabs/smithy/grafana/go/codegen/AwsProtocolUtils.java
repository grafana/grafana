package software.grafanalabs.smithy.grafana.go.codegen;

import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.SymbolUtils;
import software.amazon.smithy.go.codegen.integration.HttpProtocolTestGenerator;
import software.amazon.smithy.go.codegen.integration.HttpProtocolUnitTestGenerator;
import software.amazon.smithy.go.codegen.integration.HttpProtocolUnitTestGenerator.ConfigValue;
import software.amazon.smithy.go.codegen.integration.HttpProtocolUnitTestRequestGenerator;
import software.amazon.smithy.go.codegen.integration.HttpProtocolUnitTestResponseErrorGenerator;
import software.amazon.smithy.go.codegen.integration.HttpProtocolUnitTestResponseGenerator;
import software.amazon.smithy.go.codegen.integration.IdempotencyTokenMiddlewareGenerator;
import software.amazon.smithy.go.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.utils.SetUtils;

/**
 * Utility methods for generating AWS protocols.
 */
final class AwsProtocolUtils {
    private AwsProtocolUtils() {
    }

    /**
     * Generates HTTP protocol tests with all required AWS-specific configuration set.
     *
     * @param context The generation context.
     */
    /*
    static void generateHttpProtocolTests(GenerationContext context) {
        Set<HttpProtocolUnitTestGenerator.ConfigValue> configValues = new TreeSet<>(SetUtils.of(
                HttpProtocolUnitTestGenerator.ConfigValue.builder()
                        .name(AddAwsConfigFields.REGION_CONFIG_NAME)
                        .value(writer -> writer.write("$S,", "us-west-2"))
                        .build(),
                HttpProtocolUnitTestGenerator.ConfigValue.builder()
                        .name(AddAwsConfigFields.ENDPOINT_RESOLVER_CONFIG_NAME)
                        .value(writer -> {
                            writer.addUseImports(AwsGoDependency.CORE);
                            writer.openBlock("$L(func(region string, options $L) (e aws.Endpoint, err error) {", "}),",
                                    EndpointGenerator.RESOLVER_FUNC_NAME, EndpointGenerator.RESOLVER_OPTIONS, () -> {
                                        writer.write("e.URL = serverURL");
                                        writer.write("e.SigningRegion = \"us-west-2\"");
                                        writer.write("return e, err");
                                    });
                        })
                        .build(),
                HttpProtocolUnitTestGenerator.ConfigValue.builder()
                        .name("APIOptions")
                        .value(writer -> {
                            Symbol stackSymbol = SymbolUtils.createPointableSymbolBuilder("Stack",
                                    SmithyGoDependency.SMITHY_MIDDLEWARE).build();
                            writer.openBlock("[]func($P) error{", "},", stackSymbol, () -> {
                                writer.openBlock("func(s $P) error {", "},", stackSymbol, () -> {
                                    writer.write("s.Finalize.Clear()");
                                    writer.write("return nil");
                                });
                            });
                        })
                        .build()
        ));

        // TODO can this check be replaced with a lookup into the runtime plugins?
        if (IdempotencyTokenMiddlewareGenerator.hasOperationsWithIdempotencyToken(context.getModel(),
                context.getService())) {
            configValues.add(
                    HttpProtocolUnitTestGenerator.ConfigValue.builder()
                            .name(IdempotencyTokenMiddlewareGenerator.IDEMPOTENCY_CONFIG_NAME)
                            .value(writer -> {
                                writer.addUseImports(SmithyGoDependency.SMITHY_RAND);
                                writer.addUseImports(SmithyGoDependency.SMITHY_TESTING);
                                writer.write("smithyrand.NewUUIDIdempotencyToken(&smithytesting.ByteLoop{}),");
                            })
                            .build()
            );
        }

        Set<ConfigValue> inputConfigValues = new TreeSet<>(configValues);
        inputConfigValues.add(HttpProtocolUnitTestGenerator.ConfigValue.builder()
                .name(AddAwsConfigFields.HTTP_CLIENT_CONFIG_NAME)
                .value(writer -> {
                    writer.addUseImports(AwsGoDependency.HTTP_TRANSPORT);
                    writer.write("awshttp.NewBuildableClient(),");
                })
                .build());

        Set<HttpProtocolUnitTestGenerator.SkipTest> inputSkipTests = new TreeSet<>(SetUtils.of(
                // Smithy 1.6 changed unit tests that the SDK codegen don't support or are opinionated.
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restjson#RestJson"))
                        .operation(ShapeId.from("aws.protocoltests.restjson#EmptyInputAndEmptyOutput"))
                        .addTestName("RestJsonEmptyInputAndEmptyOutputWithJson")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restjson#RestJson"))
                        .operation(ShapeId.from("aws.protocoltests.restjson#EndpointOperation"))
                        .addTestName("RestJsonEndpointTrait")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restjson#RestJson"))
                        .operation(ShapeId.from("aws.protocoltests.restjson#EndpointWithHostLabelOperation"))
                        .addTestName("RestJsonEndpointTraitWithHostLabel")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.ec2#AwsEc2"))
                        .operation(ShapeId.from("aws.protocoltests.ec2#EndpointOperation"))
                        .addTestName("Ec2QueryEndpointTrait")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.ec2#AwsEc2"))
                        .operation(ShapeId.from("aws.protocoltests.ec2#EndpointWithHostLabelOperation"))
                        .addTestName("Ec2QueryEndpointTraitWithHostLabel")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json#JsonProtocol"))
                        .operation(ShapeId.from("aws.protocoltests.json#EmptyOperation"))
                        .addTestName("json_1_1_service_supports_empty_payload_for_no_input_shape")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json#JsonProtocol"))
                        .operation(ShapeId.from("aws.protocoltests.json#EndpointOperation"))
                        .addTestName("AwsJson11EndpointTrait")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json#JsonProtocol"))
                        .operation(ShapeId.from("aws.protocoltests.json#EndpointWithHostLabelOperation"))
                        .addTestName("AwsJson11EndpointTraitWithHostLabel")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json10#JsonRpc10"))
                        .operation(ShapeId.from("aws.protocoltests.json10#NoInputAndNoOutput"))
                        .addTestName("AwsJson10ServiceSupportsNoPayloadForNoInput")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json10#JsonRpc10"))
                        .operation(ShapeId.from("aws.protocoltests.json10#EndpointOperation"))
                        .addTestName("AwsJson10EndpointTrait")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json10#JsonRpc10"))
                        .operation(ShapeId.from("aws.protocoltests.json10#EndpointWithHostLabelOperation"))
                        .addTestName("AwsJson10EndpointTraitWithHostLabel")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.query#AwsQuery"))
                        .operation(ShapeId.from("aws.protocoltests.query#EndpointOperation"))
                        .addTestName("AwsQueryEndpointTrait")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.query#AwsQuery"))
                        .operation(ShapeId.from("aws.protocoltests.query#EndpointWithHostLabelOperation"))
                        .addTestName("AwsQueryEndpointTraitWithHostLabel")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restxml#RestXml"))
                        .operation(ShapeId.from("aws.protocoltests.restxml#EndpointOperation"))
                        .addTestName("RestXmlEndpointTrait")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restxml#RestXml"))
                        .operation(ShapeId.from("aws.protocoltests.restxml#EndpointWithHostLabelHeaderOperation"))
                        .addTestName("RestXmlEndpointTraitWithHostLabelAndHttpBinding")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restxml#RestXml"))
                        .operation(ShapeId.from("aws.protocoltests.restxml#EndpointWithHostLabelOperation"))
                        .addTestName("RestXmlEndpointTraitWithHostLabel")
                        .build(),

                // Null lists/maps without sparse tag
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restjson#RestJson"))
                        .operation(ShapeId.from("aws.protocoltests.restjson#JsonLists"))
                        .addTestName("RestJsonListsSerializeNull")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restjson#RestJson"))
                        .operation(ShapeId.from("aws.protocoltests.restjson#JsonMaps"))
                        .addTestName("RestJsonSerializesNullMapValues")
                        .build(),
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json#JsonProtocol"))
                        .operation(ShapeId.from("aws.protocoltests.json#NullOperation"))
                        .addTestName("AwsJson11MapsSerializeNullValues")
                        .addTestName("AwsJson11ListsSerializeNull")
                        .build(),

                // JSON RPC serialize empty modeled input should always serialize something
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.json10#JsonRpc10"))
                        .operation(ShapeId.from("aws.protocoltests.json10#EmptyInputAndEmptyOutput"))
                        .addTestName("AwsJson10EmptyInputAndEmptyOutput")
                        .build(),

                // HTTP Payload Values that are unset vs set by the customer and how content-type should be handled.
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restjson#RestJson"))
                        .operation(ShapeId.from("aws.protocoltests.restjson#TestPayloadBlob"))
                        .addTestName("RestJsonHttpWithEmptyBlobPayload")
                        .build()
        ));

        Set<HttpProtocolUnitTestGenerator.SkipTest> outputSkipTests = new TreeSet<>(SetUtils.of(
                // REST-JSON optional (SHOULD) test cases
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restjson#RestJson"))
                        .operation(ShapeId.from("aws.protocoltests.restjson#JsonMaps"))
                        .addTestName("RestJsonDeserializesDenseSetMapAndSkipsNull")
                        .build(),

                // REST-XML opinionated test - prefix headers as empty vs nil map
                HttpProtocolUnitTestGenerator.SkipTest.builder()
                        .service(ShapeId.from("aws.protocoltests.restxml#RestXml"))
                        .operation(ShapeId.from("aws.protocoltests.restxml#HttpPrefixHeaders"))
                        .addTestName("HttpPrefixHeadersAreNotPresent")
                        .build()
        ));

        new HttpProtocolTestGenerator(context,
                (HttpProtocolUnitTestRequestGenerator.Builder) new HttpProtocolUnitTestRequestGenerator
                        .Builder()
                        .settings(context.getSettings())
                        .addSkipTests(inputSkipTests)
                        .addClientConfigValues(inputConfigValues),
                (HttpProtocolUnitTestResponseGenerator.Builder) new HttpProtocolUnitTestResponseGenerator
                        .Builder()
                        .settings(context.getSettings())
                        .addSkipTests(outputSkipTests)
                        .addClientConfigValues(configValues),
                (HttpProtocolUnitTestResponseErrorGenerator.Builder) new HttpProtocolUnitTestResponseErrorGenerator
                        .Builder()
                        .settings(context.getSettings())
                        .addClientConfigValues(configValues)
        ).generateProtocolTests();
    }
    */

    public static void writeJsonErrorMessageCodeDeserializer(GenerationContext context) {
        GoWriter writer = context.getWriter().get();
        // The error code could be in the headers, even though for this protocol it should be in the body.
        writer.write("code := response.Header.Get(\"X-Amzn-ErrorType\")");
        writer.write("if len(code) != 0 { errorCode = restjson.SanitizeErrorCode(code) }");
        writer.write("");

        initializeJsonDecoder(writer, "errorBody");
        writer.addUseImports(AwsGoDependency.REST_JSON_PROTOCOL);
        // This will check various body locations for the error code and error message
        writer.write("code, message, err := restjson.GetErrorInfo(decoder)");
        handleDecodeError(writer);

        writer.addUseImports(SmithyGoDependency.IO);
        // Reset the body in case it needs to be used for anything else.
        writer.write("errorBody.Seek(0, io.SeekStart)");

        // Only set the values if something was found so that we keep the default values.
        writer.write("if len(code) != 0 { errorCode = restjson.SanitizeErrorCode(code) }");
        writer.write("if len(message) != 0 { errorMessage = message }");
        writer.write("");
    }

    public static void initializeJsonDecoder(GoWriter writer, String bodyLocation) {
        // Use a ring buffer and tee reader to help in pinpointing any deserialization errors.
        writer.addUseImports(SmithyGoDependency.SMITHY_IO);
        writer.write("var buff [1024]byte");
        writer.write("ringBuffer := smithyio.NewRingBuffer(buff[:])");
        writer.write("");

        writer.addUseImports(SmithyGoDependency.IO);
        writer.addUseImports(SmithyGoDependency.JSON);
        writer.write("body := io.TeeReader($L, ringBuffer)", bodyLocation);
        writer.write("decoder := json.NewDecoder(body)");
        writer.write("decoder.UseNumber()");
    }

    /**
     * Decodes JSON into {@code shape} with type {@code interface{}} using the encoding/json decoder
     * referenced by {@code decoder}.
     *
     * @param writer            GoWriter to write code to
     * @param errorReturnExtras extra parameters to return if an error occurs
     */
    public static void decodeJsonIntoInterface(GoWriter writer, String errorReturnExtras) {
        writer.write("var shape interface{}");
        writer.addUseImports(SmithyGoDependency.IO);
        writer.openBlock("if err := decoder.Decode(&shape); err != nil && err != io.EOF {", "}", () -> {
            wrapAsDeserializationError(writer);
            writer.write("return $Lerr", errorReturnExtras);
        });
        writer.write("");
    }

    /**
     * Wraps the Go error {@code err} in a {@code DeserializationError} with a snapshot
     *
     * @param writer
     */
    private static void wrapAsDeserializationError(GoWriter writer) {
        writer.write("var snapshot bytes.Buffer");
        writer.write("io.Copy(&snapshot, ringBuffer)");
        writer.openBlock("err = &smithy.DeserializationError {", "}", () -> {
            writer.write("Err: fmt.Errorf(\"failed to decode response body, %w\", err),");
            writer.write("Snapshot: snapshot.Bytes(),");
        });
    }

    public static void handleDecodeError(GoWriter writer, String returnExtras) {
        writer.openBlock("if err != nil {", "}", () -> {
            writer.addUseImports(SmithyGoDependency.BYTES);
            writer.addUseImports(SmithyGoDependency.SMITHY);
            writer.addUseImports(SmithyGoDependency.IO);
            wrapAsDeserializationError(writer);
            writer.write("return $Lerr", returnExtras);
        }).write("");
    }

    public static void handleDecodeError(GoWriter writer) {
        handleDecodeError(writer, "");
    }

    public static void writeJsonEventMessageSerializerDelegator(
            GenerationContext ctx,
            String functionName,
            String operand,
            String contentType
    ) {
        var writer = ctx.getWriter().get();

        var stringValue = SymbolUtils.createValueSymbolBuilder("StringValue",
                AwsGoDependency.SERVICE_INTERNAL_EVENTSTREAM).build();
        var contentTypeHeader = SymbolUtils.createValueSymbolBuilder("ContentTypeHeader",
                AwsGoDependency.SERVICE_INTERNAL_EVENTSTREAMAPI).build();

        writer.write("msg.Headers.Set($T, $T($S))",
                contentTypeHeader, stringValue, contentType);
        var newEncoder = SymbolUtils.createValueSymbolBuilder("NewEncoder",
                SmithyGoDependency.SMITHY_JSON).build();
        writer.write("jsonEncoder := $T()", newEncoder)
                .openBlock("if err := $L($L, jsonEncoder.Value); err != nil {", "}", functionName, operand,
                        () -> writer.write("return err"))
                .write("msg.Payload = jsonEncoder.Bytes()")
                .write("return nil");
    }

    public static void initializeJsonEventMessageDeserializer(GenerationContext ctx) {
        initializeJsonEventMessageDeserializer(ctx, "");
    }

    public static void initializeJsonEventMessageDeserializer(GenerationContext ctx, String errorReturnExtras) {
        var writer = ctx.getWriter().get();
        writer.write("br := $T(msg.Payload)", SymbolUtils.createValueSymbolBuilder(
                "NewReader", SmithyGoDependency.BYTES).build());
        initializeJsonDecoder(writer, "br");
        AwsProtocolUtils.decodeJsonIntoInterface(writer, errorReturnExtras);
    }

    public static void writeJsonEventStreamUnknownExceptionDeserializer(GenerationContext ctx) {
        var writer = ctx.getWriter().get();
        writer.write("br := $T(msg.Payload)", SymbolUtils.createValueSymbolBuilder("NewReader",
                SmithyGoDependency.BYTES).build());
        AwsProtocolUtils.initializeJsonDecoder(writer, "br");
        writer.write("""
                     code, message, err := $T(decoder)
                     if err != nil {
                         return err
                     }
                     errorCode := "UnknownError"
                     errorMessage := errorCode
                     if ev := exceptionType.String(); len(ev) > 0 {
                         errorCode = ev
                     } else if ev := code; len(ev) > 0 {
                         errorCode = ev
                     }
                     if ev := message; len(ev) > 0 {
                         errorMessage = ev
                     }
                     return &$T{
                         Code: errorCode,
                         Message: errorMessage,
                     }
                     """,
                SymbolUtils.createValueSymbolBuilder("GetErrorInfo",
                        AwsGoDependency.REST_JSON_PROTOCOL).build(),
                SymbolUtils.createValueSymbolBuilder("GenericAPIError", SmithyGoDependency.SMITHY).build());
    }
}
