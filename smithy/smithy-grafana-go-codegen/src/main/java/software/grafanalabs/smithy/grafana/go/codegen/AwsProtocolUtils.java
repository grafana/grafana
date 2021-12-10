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

    public static void writeJsonErrorMessageCodeDeserializer(GenerationContext context) {
        GoWriter writer = context.getWriter().get();
        // The error code could be in the headers, even though for this protocol it should be in the body.
        writer.write("code := response.Header.Get(\"X-Amzn-ErrorType\")");
        writer.write("if len(code) != 0 { errorCode = restjson.SanitizeErrorCode(code) }");
        writer.write("");

        initializeJsonDecoder(writer, "errorBody");
        writer.addUseImports(SdkGoDependency.REST_JSON_PROTOCOL);
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
                SdkGoDependency.SERVICE_INTERNAL_EVENTSTREAM).build();
        var contentTypeHeader = SymbolUtils.createValueSymbolBuilder("ContentTypeHeader",
                SdkGoDependency.SERVICE_INTERNAL_EVENTSTREAMAPI).build();

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
                        SdkGoDependency.REST_JSON_PROTOCOL).build(),
                SymbolUtils.createValueSymbolBuilder("GenericAPIError", SmithyGoDependency.SMITHY).build());
    }
}
