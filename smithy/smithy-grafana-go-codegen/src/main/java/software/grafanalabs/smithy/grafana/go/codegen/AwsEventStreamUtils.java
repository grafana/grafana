package software.grafanalabs.smithy.grafana.go.codegen;

import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.go.codegen.CodegenUtils;
import software.amazon.smithy.go.codegen.EventStreamGenerator;
import software.amazon.smithy.go.codegen.GoDependency;
import software.amazon.smithy.go.codegen.GoEventStreamIndex;
import software.amazon.smithy.go.codegen.GoSettings;
import software.amazon.smithy.go.codegen.GoStackStepMiddlewareGenerator;
import software.amazon.smithy.go.codegen.GoValueAccessUtils;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.MiddlewareIdentifier;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.SymbolUtils;
import software.amazon.smithy.go.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.go.codegen.knowledge.GoPointableIndex;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.EventStreamIndex;
import software.amazon.smithy.model.knowledge.EventStreamInfo;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.ByteShape;
import software.amazon.smithy.model.shapes.IntegerShape;
import software.amazon.smithy.model.shapes.LongShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.ShortShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.ToShapeId;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.utils.StringUtils;

public final class AwsEventStreamUtils {
    private static final String EVENT_STREAM_SIGNER_INTERFACE = "eventStreamSigner";

    private AwsEventStreamUtils() {
    }

    public static void generateEventStreamComponents(GenerationContext context) {
        Model model = context.getModel();
        GoWriter writer = context.getWriter().get();
        ServiceShape serviceShape = context.getService();
        GoSettings settings = context.getSettings();

        boolean isHttpBindingProto = model.getOperationShapesWithTrait(HttpTrait.class).size() > 0;

        EventStreamIndex streamIndex = EventStreamIndex.of(model);

        var inputEventStreams = GoEventStreamIndex.of(model).getInputEventStreams(serviceShape);
        var outputEventStreams = GoEventStreamIndex.of(model).getOutputEventStreams(serviceShape);

        if (inputEventStreams.isEmpty() && outputEventStreams.isEmpty()) {
            return;
        }

        final var operationShapes = new TreeSet<OperationShape>();

        if (inputEventStreams.isPresent()) {
            generateEventSignerInterface(settings, writer);
            inputEventStreams.get().forEach((shapeId, eventStreamInfos) -> {
                generateEventStreamWriter(context, model.expectShape(shapeId, UnionShape.class), eventStreamInfos,
                        !isHttpBindingProto);
                eventStreamInfos.forEach(info -> operationShapes.add(info.getOperation()));
            });
        }

        if (outputEventStreams.isPresent()) {
            outputEventStreams.get().forEach((shapeId, eventStreamInfos) -> {
                generateEventStreamReader(context, model.expectShape(shapeId, UnionShape.class), eventStreamInfos,
                        !isHttpBindingProto);
                eventStreamInfos.forEach(info -> operationShapes.add(info.getOperation()));
            });
        }

        for (OperationShape operationShape : operationShapes) {
            if (streamIndex.getInputInfo(operationShape).isEmpty()
                && streamIndex.getOutputInfo(operationShape).isEmpty()) {
                continue;
            }
            generateEventStreamMiddleware(context, operationShape, !isHttpBindingProto);
        }

        generateUnknownEventMessageError(context);

        generateEventStreamClientLogModeFinalizer(context, operationShapes);
        generateToggleClientLogModeFinalizer(context);
    }

    private static void generateUnknownEventMessageError(GenerationContext context) {
        var writer = context.getWriter().get();

        var symbol = getUnknownEventMessageErrorSymbol();
        var message = getEventStreamSymbol("Message");

        writer.write("""
                     // $T provides an error when a message is received from the stream,
                     // but the reader is unable to determine what kind of message it is.
                     type $T struct {
                         Type string
                         Message $P
                     }

                     // Error retruns the error message string.
                     func (e $P) Error() string {
                         return "unknown event stream message type, " + e.Type
                     }
                     """, symbol, symbol, message, symbol);
    }

    private static Symbol getUnknownEventMessageErrorSymbol() {
        return SymbolUtils.createPointableSymbolBuilder("UnknownEventMessageError").build();
    }

    private static void generateEventStreamClientLogModeFinalizer(
            GenerationContext context,
            Set<OperationShape> operationShapes
    ) {
        var writer = context.getWriter().get();

        var streamIndex = EventStreamIndex.of(context.getModel());

        writer.openBlock("func $T(o *Options, operation string) {", "}",
                getEventStreamClientLogModeFinalizerSymbol(), () -> {
                    writer.openBlock("switch operation {", "}", () -> {
                        operationShapes.forEach(operationShape -> {
                            var requestStream = streamIndex
                                    .getInputInfo(operationShape).isPresent();
                            var responseStream = streamIndex
                                    .getOutputInfo(operationShape).isPresent();
                            writer.write("""
                                         case $S:
                                            $T(o, $L, $L)
                                            return
                                         """, operationShape.getId().getName(),
                                    getToggleEventStreamClientLogModeSymbol(), requestStream,
                                    responseStream);
                        });
                        writer.write("""
                                     default:
                                         return
                                     """);
                    });
                });
    }

    private static void generateToggleClientLogModeFinalizer(GenerationContext context) {
        var writer = context.getWriter().get();

        var logRequest = SymbolUtils.createValueSymbolBuilder("LogRequest",
                AwsGoDependency.CORE).build();
        var logResponse = SymbolUtils.createValueSymbolBuilder("LogResponse",
                AwsGoDependency.CORE).build();

        writer.openBlock("func $T(o *Options, request, response bool) {", "}",
                getToggleEventStreamClientLogModeSymbol(), () -> {
                    writer.write("""
                                 mode := o.ClientLogMode

                                 if request && mode.IsRequestWithBody() {
                                     mode.ClearRequestWithBody()
                                     mode |= $T
                                 }

                                 if response && mode.IsResponseWithBody() {
                                     mode.ClearResponseWithBody()
                                     mode |= $T
                                 }

                                 o.ClientLogMode = mode
                                 """, logRequest, logResponse
                    );
                }).write("");
    }

    public static Symbol getEventStreamClientLogModeFinalizerSymbol() {
        return SymbolUtils.createValueSymbolBuilder("setSafeEventStreamClientLogMode")
                .build();
    }

    private static Symbol getToggleEventStreamClientLogModeSymbol() {
        return SymbolUtils.createValueSymbolBuilder("toggleEventStreamClientLogMode")
                .build();
    }

    public static Symbol getAddEventStreamOperationMiddlewareSymbol(OperationShape operationShape) {
        return SymbolUtils.createValueSymbolBuilder(String.format("addEventStream%sMiddleware",
                        StringUtils.capitalize(operationShape.getId().getName())))
                .build();
    }

    private static void generateEventStreamMiddleware(
            GenerationContext context,
            OperationShape operationShape,
            boolean withInitialMessages
    ) {

        var serviceShape = context.getService();
        var middlewareName = getSerDeName(operationShape, serviceShape, context.getProtocolName(),
                "_deserializeOpEventStream");

        var errorf = getSymbol("Errorf", SmithyGoDependency.FMT, false);
        var getSignedRequestSignature = getSymbol("GetSignedRequestSignature", AwsGoDependency.SIGNER_V4, false);
        var symbolProvider = context.getSymbolProvider();
        var model = context.getModel();
        var outputShape = model.expectShape(operationShape.getOutput().get());

        var inputInfo = EventStreamIndex.of(model).getInputInfo(operationShape);
        var outputInfo = EventStreamIndex.of(model).getOutputInfo(operationShape);

        var writer = context.getWriter().get();

        var middleware = GoStackStepMiddlewareGenerator.createDeserializeStepMiddleware(middlewareName, MiddlewareIdentifier.builder()
                .name("OperationEventStreamDeserializer")
                .build());

        middleware.writeMiddleware(writer,
                (mg, w) -> {
                    w.write("""
                            defer func() {
                                if err == nil {
                                    return
                                }
                                m.closeResponseBody(out)
                            }()

                            logger := $T(ctx)
                            """, getSymbol("GetLogger",
                            SmithyGoDependency.SMITHY_MIDDLEWARE, false));

                    w.write("""
                            request, ok := in.Request.($P)
                            if !ok {
                                return out, metadata, $T("unknown transport type: %T", in.Request)
                            }
                            _ = request
                            """, getSymbol("Request", SmithyGoDependency.SMITHY_HTTP_TRANSPORT), errorf);

                    if (inputInfo.isPresent()) {
                        w.write("""
                                if err := $T(request); err != nil {
                                    return out, metadata, err
                                }
                                """, getEventStreamApiSymbol("ApplyHTTPTransportFixes"))
                                .write("");

                        w.write("""
                                 requestSignature, err := $T(request.Request)
                                 if err != nil {
                                    return out, metadata, $T("failed to get event stream seed signature: %v", err)
                                }
                                 """, getSignedRequestSignature, errorf).write("")
                                .openBlock("signer := $T(", ")", getSymbol("NewStreamSigner",
                                        AwsGoDependency.SIGNER_V4, false), () -> w
                                        .write("""
                                               $T(ctx),
                                               $T(ctx),
                                               $T(ctx),
                                               requestSignature,
                                               """, getSymbol("GetSigningCredentials",
                                                        AwsGoDependency.MIDDLEWARE, false),
                                                getSymbol("GetSigningName",
                                                        AwsGoDependency.MIDDLEWARE, false),
                                                getSymbol("GetSigningRegion",
                                                        AwsGoDependency.MIDDLEWARE, false)
                                        )).write("");

                        var events = inputInfo.get().getEventStreamTarget().asUnionShape()
                                .get();
                        var constructorName = getEventStreamWriterImplConstructorName(events,
                                serviceShape);
                        var newEncoder = getEventStreamSymbol("NewEncoder", false);
                        var encoderOptions = getEventStreamSymbol("EncoderOptions");
                        w.openBlock("eventWriter := $L(", ")", constructorName, () -> {
                                    w.write("$T(ctx),", getEventStreamApiSymbol("GetInputStreamWriter",
                                                    false))
                                            .openBlock("$T(func(options $P) {", "}),", newEncoder,
                                                    encoderOptions, () -> w
                                                            .write("""
                                                                   options.Logger = logger
                                                                   options.LogMessages = m.LogEventStreamWrites
                                                                   """))
                                            .write("signer,");
                                    if (withInitialMessages) {
                                        w.write("$L,", getEventStreamMessageRequestSerializerName(
                                                operationShape.getInput().get(), serviceShape,
                                                context.getProtocolName()));
                                    }
                                })
                                .write("""
                                       defer func() {
                                           if err == nil {
                                               return
                                           }
                                           _ = eventWriter.Close()
                                       }()
                                       """);

                        if (withInitialMessages) {
                            w.write("""
                                    reqSend := make(chan error, 1)
                                    go func() {
                                        defer close(reqSend)
                                        reqSend <- eventWriter.send(ctx, &$T{Value: request})
                                    }()
                                    """, getWriterEventWrapperInitialRequestType(symbolProvider,
                                    inputInfo.get().getEventStreamTarget().asUnionShape().get(), serviceShape));
                        }
                    }

                    var outputSymbol = symbolProvider.toSymbol(outputShape);
                    w.write("out, metadata, err = next.HandleDeserialize(ctx, in)");

                    writer.openBlock("if err != nil {", "}", () -> {
                        writer.write("return out, metadata, err");
                    }).write("");

                    if (withInitialMessages && inputInfo.isPresent()) {
                        w.write("""
                                if err := <-reqSend; err != nil {
                                    return out, metadata, err
                                }
                                """);
                    }

                    w.write("""
                            deserializeOutput, ok := out.RawResponse.($P)
                            if !ok {
                                return out, metadata, $T("unknown transport type: %T", out.RawResponse)
                            }
                            _ = deserializeOutput

                            output, ok := out.Result.($P)
                            if out.Result != nil && !ok {
                                return out, metadata, $T("unexpected output result type: %T", out.Result)
                            } else if out.Result == nil {
                                output = &$T{}
                                out.Result = output
                            }
                            """, getSymbol("Response", SmithyGoDependency.SMITHY_HTTP_TRANSPORT), errorf,
                            outputSymbol, errorf, outputSymbol
                    );

                    if (outputInfo.isPresent()) {
                        var events = outputInfo.get().getEventStreamTarget().asUnionShape()
                                .get();
                        var constructorName = getEventStreamReaderImplConstructorName(events,
                                serviceShape);
                        var newDecoder = getEventStreamSymbol("NewDecoder", false);
                        var decoderOptions = getEventStreamSymbol("DecoderOptions");
                        w.openBlock("eventReader := $L(", ")", constructorName, () -> {
                                    w.write("deserializeOutput.Body,")
                                            .openBlock("$T(func(options $P) {", "}),", newDecoder,
                                                    decoderOptions, () -> w
                                                            .write("""
                                                                   options.Logger = logger
                                                                   options.LogMessages = m.LogEventStreamReads
                                                                   """));
                                    if (withInitialMessages) {
                                        w.write("$L,", getEventStreamMessageResponseDeserializerName(
                                                operationShape.getOutput().get(), serviceShape,
                                                context.getProtocolName()));
                                    }
                                })
                                .write("""
                                       defer func() {
                                           if err == nil {
                                               return
                                           }
                                           _ = eventReader.Close()
                                       }()
                                       """);

                        if (withInitialMessages) {
                            w.write("""
                                    ir := <-eventReader.initialResponse
                                    irv, ok := ir.($P)
                                    if !ok {
                                        return out, metadata, $T("unexpected output result type: %T", ir)
                                    }
                                    *output = *irv
                                    """, outputSymbol, errorf);
                        }
                    }

                    var streamConstructor = EventStreamGenerator.getEventStreamOperationStructureConstructor(
                            serviceShape, operationShape);
                    var operationStream = EventStreamGenerator.getEventStreamOperationStructureSymbol(
                            serviceShape, operationShape);

                    w.openBlock("output.eventStream = $T(func(stream $P) {", "})", streamConstructor,
                                    operationStream, () -> {
                                        inputInfo.ifPresent(eventStreamInfo -> {
                                            w.write("stream.Writer = eventWriter");
                                        });
                                        outputInfo.ifPresent(eventStreamInfo -> {
                                            w.write("stream.Reader = eventReader");
                                        });
                                    }).write("")
                            .write("go output.eventStream.waitStreamClose()").write("")
                            .write("return out, metadata, nil");
                },
                (mg, w) -> w.write("""
                                   LogEventStreamWrites bool
                                   LogEventStreamReads  bool
                                   """));

        var deserializeOutput = getSymbol("DeserializeOutput", SmithyGoDependency.SMITHY_MIDDLEWARE);
        var httpResponse = getSymbol("Response", SmithyGoDependency.SMITHY_HTTP_TRANSPORT);
        var copy = getSymbol("Copy", SmithyGoDependency.IO);
        var discard = getSymbol("Discard", SmithyGoDependency.IOUTIL);
        writer.write("""

                     func ($P) closeResponseBody(out $T) {
                         if resp, ok := out.RawResponse.($P); ok && resp != nil && resp.Body != nil {
                             _, _ = $T($T, resp.Body)
                             _ = resp.Body.Close()
                         }
                     }
                     """, middleware.getMiddlewareSymbol(), deserializeOutput, httpResponse, copy, discard);

        var stack = getSymbol("Stack", SmithyGoDependency.SMITHY_MIDDLEWARE);
        var before = getSymbol("Before", SmithyGoDependency.SMITHY_MIDDLEWARE);

        writer.write("""
                     func $T(stack $P, options Options) error {
                         return stack.Deserialize.Insert(&$T{
                             LogEventStreamWrites: options.ClientLogMode.IsRequestEventMessage(),
                             LogEventStreamReads:  options.ClientLogMode.IsResponseEventMessage(),
                         }, "OperationDeserializer", $T)
                     }
                     """, getAddEventStreamOperationMiddlewareSymbol(operationShape),
                stack, middleware.getMiddlewareSymbol(), before);
    }

    private static void generateEventSignerInterface(GoSettings settings, GoWriter writer) {
        writer.openBlock("type $T interface {", "}", getModuleSymbol(settings, EVENT_STREAM_SIGNER_INTERFACE),
                () -> {
                    writer.write("GetSignature(ctx context.Context, headers, payload []byte, signingTime time.Time, "
                                 + "optFns ...func($P)) ([]byte, error)",
                            SymbolUtils.createPointableSymbolBuilder("StreamSignerOptions",
                                            AwsGoDependency.SIGNER_V4)
                                    .build());
                }).write("");
    }

    private static void generateEventStreamReader(
            GenerationContext context,
            UnionShape eventStream,
            Set<EventStreamInfo> operationShapes,
            boolean withInitialMessages
    ) {
        var settings = context.getSettings();
        var service = context.getService();
        var symbolProvider = context.getSymbolProvider();
        var writer = context.getWriter().get();

        var eventUnionSymbol = symbolProvider.toSymbol(eventStream);

        var eventSymbol = withInitialMessages ? getReaderEventWrapperInterface(symbolProvider,
                eventStream, service) : eventUnionSymbol;

        var readerImplName = getEventStreamReaderImplName(eventStream, service);
        var readerSymbol = getModuleSymbol(settings, readerImplName);

        var decoderSymbol = getEventStreamSymbol("Decoder");

        var messageSymbol = SymbolUtils.createPointableSymbolBuilder("Message",
                AwsGoDependency.SERVICE_INTERNAL_EVENTSTREAM).build();

        var readCloser = getSymbol("ReadCloser", SmithyGoDependency.IO, false);

        if (withInitialMessages) {
            generateEventStreamReaderMessageWrapper(eventStream, service, symbolProvider, writer, eventUnionSymbol);
        }

        writer.openBlock("type $T struct {", "}", readerSymbol, () -> {
            var onceErr = getSymbol("OnceErr", SmithyGoDependency.SMITHY_SYNC);
            var syncOnce = getSymbol("Once", SmithyGoDependency.SYNC, false);

            writer.write("""
                         stream chan $T
                         decoder $P
                         eventStream $T
                         err $P
                         payloadBuf []byte
                         done chan struct{}
                         closeOnce $T""", eventUnionSymbol, decoderSymbol, readCloser, onceErr, syncOnce);
            if (withInitialMessages) {
                writer.write("initialResponseDeserializer func($P) (interface{}, error)", messageSymbol);
                writer.write("initialResponse chan interface{}");
            }
        }).write("");

        writer.writeInline("func $L(readCloser $T, decoder $P",
                getEventStreamReaderImplConstructorName(eventStream, service), readCloser,
                getSymbol("Decoder", AwsGoDependency.SERVICE_INTERNAL_EVENTSTREAM));
        if (withInitialMessages) {
            writer.writeInline(", ird func($P) (interface{}, error)", messageSymbol);
        }
        writer.openBlock(") $P {", "}",
                readerSymbol, () -> {
                    var newOnceErr = getSymbol("NewOnceErr", SmithyGoDependency.SMITHY_SYNC, false);
                    writer.openBlock("w := &$T{", "}", readerSymbol, () -> {
                        writer.write("""
                                     stream: make(chan $T),
                                     decoder: decoder,
                                     eventStream: readCloser,
                                     err: $T(),
                                     done: make(chan struct{}),
                                     payloadBuf:  make([]byte, 10*1024),""", eventUnionSymbol, newOnceErr);
                        if (withInitialMessages) {
                            writer.write("initialResponseDeserializer: ird,");
                            writer.write("initialResponse: make(chan interface{}, 1),");
                        }
                    }).write("");

                    writer.write("""
                                 go w.readEventStream()

                                 return w""");
                }).write("");

        writer.openBlock("func (r $P) Events() <-chan $T {", "}", readerSymbol, eventUnionSymbol, () -> writer
                .write("return r.stream")).write("");

        writer.openBlock("func (r $P) readEventStream() {", "}", readerSymbol, () -> {
                    writer.write("""
                                 defer r.Close()
                                 defer close(r.stream)
                                 """);

                    if (withInitialMessages) {
                        writer.write("""
                                     defer close(r.initialResponse)
                                     """);
                    }

                    writer.openBlock("for {", "}", () -> {
                        writer.write("""
                                     r.payloadBuf = r.payloadBuf[0:0]
                                     decodedMessage, err := r.decoder.Decode(r.eventStream, r.payloadBuf)
                                     if err != nil {
                                         if err == $T {
                                             return
                                         }
                                         select {
                                         case <-r.done:
                                             return
                                         default:
                                             r.err.SetError(err)
                                             return
                                         }
                                     }

                                     event, err := r.deserializeEventMessage(&decodedMessage)
                                     if err != nil {
                                         r.err.SetError(err)
                                         return
                                     }
                                     """, SymbolUtils.createValueSymbolBuilder("EOF",
                                SmithyGoDependency.IO).build());

                        if (withInitialMessages) {
                            writer.write("""
                                         switch ev := event.(type) {
                                         case $P:
                                             select {
                                             case r.initialResponse <- ev.Value:
                                             case <-r.done:
                                                 return
                                             default:
                                             }
                                         case $P:
                                             select {
                                             case r.stream <- ev.Value:
                                             case <-r.done:
                                                 return
                                             }
                                         default:
                                             r.err.SetError($T("unexpected event wrapper: %T", event))
                                             return
                                         }
                                         """,
                                    getReaderEventWrapperInitialResponseType(symbolProvider, eventStream, service),
                                    getReaderEventWrapperMessageType(symbolProvider, eventStream, service),
                                    getSymbol("Errorf", SmithyGoDependency.FMT, false));
                        } else {
                            writer.write("""
                                         select {
                                         case r.stream <- event:
                                         case <-r.done:
                                             return
                                         }
                                         """);
                        }
                    });
                }
        ).write("");

        var errorf = SymbolUtils.createValueSymbolBuilder("Errorf", SmithyGoDependency.FMT).build();
        writer.openBlock("func (r $P) deserializeEventMessage(msg $P) ($T, error) {", "}", readerSymbol, messageSymbol,
                eventSymbol, () -> {
                    var messageTypeHeader = getEventStreamApiSymbol("MessageTypeHeader", false);
                    var eventMessageType = getEventStreamApiSymbol("EventMessageType", false);
                    var exceptionMessageType = getEventStreamApiSymbol("ExceptionMessageType", false);
                    var errorMessageType = getEventStreamApiSymbol("ErrorMessageType", false);

                    writer.write("""
                                 messageType := msg.Headers.Get($T)
                                 if messageType == nil {
                                     return nil, $T("%s event header not present", $T)
                                 }
                                 """, messageTypeHeader, errorf, messageTypeHeader)
                            .openBlock("switch messageType.String() {", "}", () -> writer
                                    .openBlock("case $T:", "", eventMessageType, () -> {
                                        if (withInitialMessages) {
                                            var eventTypeHeader = getEventStreamApiSymbol("EventTypeHeader",
                                                    false);
                                            writer.write("""
                                                         eventType := msg.Headers.Get($T)
                                                         if eventType == nil {
                                                             return nil, $T("%s event header not present", $T)
                                                         }

                                                         if eventType.String() == "initial-response" {
                                                             v, err := r.initialResponseDeserializer(msg)
                                                             if err != nil {
                                                                 return nil, err
                                                             }
                                                             return &$T{Value: v}, nil
                                                         }
                                                         """, eventTypeHeader, errorf, eventTypeHeader,
                                                    getReaderEventWrapperInitialResponseType(symbolProvider,
                                                            eventStream, service));
                                        }
                                        writer.write("""
                                                     var v $T
                                                     if err := $L(&v, msg); err != nil {
                                                         return nil, err
                                                     }""",
                                                eventUnionSymbol, getEventStreamDeserializerName(eventStream,
                                                        service, context.getProtocolName()));
                                        if (withInitialMessages) {
                                            writer.write("return &$T{Value: v}, nil",
                                                    getReaderEventWrapperMessageType(symbolProvider,
                                                            eventStream, service));
                                        } else {
                                            writer.write("return v, nil");
                                        }
                                    })
                                    .openBlock("case $T:", "", exceptionMessageType, () -> writer
                                            .write("return nil, $L(msg)",
                                                    getEventStreamExceptionDeserializerName(eventStream, service,
                                                            context.getProtocolName())))
                                    .openBlock("case $T:", "", errorMessageType, () -> writer
                                            .write("""
                                                   errorCode := "UnknownError"
                                                   errorMessage := errorCode
                                                   if header :=  msg.Headers.Get($T); header != nil {
                                                       errorCode = header.String()
                                                   }
                                                   if header :=  msg.Headers.Get($T); header != nil {
                                                       errorMessage = header.String()
                                                   }
                                                   return nil, &$T{
                                                       Code: errorCode,
                                                       Message: errorMessage,
                                                   }
                                                   """, getEventStreamApiSymbol("ErrorCodeHeader", false),
                                                    getEventStreamApiSymbol("ErrorMessageHeader", false),
                                                    getSymbol("GenericAPIError", SmithyGoDependency.SMITHY, false)))
                                    .write("""
                                           default:
                                               mc := msg.Clone()
                                               return nil, &$T{
                                                   Type: messageType.String(),
                                                   Message: &mc,
                                               }
                                           """, getUnknownEventMessageErrorSymbol()));
                }).write("");

        writer.openBlock("func (r $P) ErrorSet() <-chan struct{} {", "}", readerSymbol, () -> writer
                .write("return r.err.ErrorSet()")).write("");

        writer.openBlock("func (r $P) Close() error {", "}", readerSymbol, () -> writer
                .write("r.closeOnce.Do(r.safeClose)")
                .write("return r.Err()")).write("");

        writer.openBlock("func (r $P) safeClose() {", "}", readerSymbol, () -> writer
                .write("""
                       close(r.done)
                       r.eventStream.Close()
                       """)).write("");

        writer.openBlock("func (r $P) Err() error {", "}", readerSymbol, () -> writer
                .write("return r.err.Err()")).write("");

        writer.openBlock("func (r $P) Closed() <-chan struct{} {", "}", readerSymbol,
                () -> writer.write("return r.done")).write("");
    }

    private static void generateEventStreamReaderMessageWrapper(
            UnionShape eventStream,
            ServiceShape service,
            SymbolProvider symbolProvider,
            GoWriter writer,
            Symbol eventUnionSymbol
    ) {
        var readerEventWrapperInterface = getReaderEventWrapperInterface(symbolProvider, eventStream, service);
        var interfaceMethod = "is" + StringUtils.capitalize(readerEventWrapperInterface.getName());

        writer.write("""
                     type $T interface {
                         $L()
                     }
                     """, readerEventWrapperInterface, interfaceMethod);

        var readerEventWrapperMessageType = getReaderEventWrapperMessageType(symbolProvider, eventStream, service);
        writer.write("""
                     type $T struct {
                         Value $P
                     }

                     func ($P) $L() {}
                     """, readerEventWrapperMessageType, eventUnionSymbol, readerEventWrapperMessageType,
                interfaceMethod);

        var readerEventWrapperInitialResponseType = getReaderEventWrapperInitialResponseType(symbolProvider,
                eventStream, service);
        writer.write("""
                     type $T struct {
                         Value interface{}
                     }

                     func ($P) $L() {}
                     """, readerEventWrapperInitialResponseType, readerEventWrapperInitialResponseType,
                interfaceMethod);
    }

    private static void generateEventStreamWriter(
            GenerationContext context,
            UnionShape eventStream,
            Set<EventStreamInfo> eventStreamInfos,
            boolean withInitialMessages
    ) {
        var settings = context.getSettings();
        var service = context.getService();
        var symbolProvider = context.getSymbolProvider();
        var writer = context.getWriter().get();

        var eventUnionSymbol = symbolProvider.toSymbol(eventStream);
        var asyncEventSymbol = getModuleSymbol(settings, getAsyncWriteReporterName(eventStream,
                service));


        var eventSymbol = withInitialMessages ? getWriterEventWrapperInterface(symbolProvider,
                eventStream, service) : eventUnionSymbol;

        generateAsyncWriteReporter(writer, eventSymbol, asyncEventSymbol);

        var writerImplName = getEventStreamWriterImplName(eventStream, service);

        var writerSymbol = getModuleSymbol(settings, writerImplName);
        var encoderSymbol = getSymbol("Encoder", AwsGoDependency.SERVICE_INTERNAL_EVENTSTREAM);
        var writeCloser = getSymbol("WriteCloser", SmithyGoDependency.IO);
        var signerInterface = getModuleSymbol(settings, EVENT_STREAM_SIGNER_INTERFACE);

        var messageSymbol = getEventStreamSymbol("Message", false);

        if (withInitialMessages) {
            generateEventStreamWriterMessageWrapper(eventStream, service, symbolProvider, writer, eventUnionSymbol);
        }

        writer.openBlock("type $T struct {", "}", writerSymbol, () -> {
            var bytesBufferSymbol = SymbolUtils.createPointableSymbolBuilder("Buffer",
                    SmithyGoDependency.BYTES).build();

            var syncOnce = getSymbol("Once", SmithyGoDependency.SYNC);
            var onceErr = getSymbol("OnceErr", SmithyGoDependency.SMITHY_SYNC);

            writer.write("""
                         encoder $P
                         signer $T
                         stream chan $T
                         serializationBuffer $P
                         signingBuffer $P
                         eventStream $T
                         done chan struct{}
                         closeOnce $T
                         err $P
                         """, encoderSymbol, signerInterface, asyncEventSymbol, bytesBufferSymbol, bytesBufferSymbol,
                    writeCloser, syncOnce, onceErr);

            if (withInitialMessages) {
                writer.write("initialRequestSerializer func(interface{}, $P) error", messageSymbol);
            }
        }).write("");

        Symbol bytesNewBuffer = SymbolUtils.createValueSymbolBuilder("NewBuffer",
                SmithyGoDependency.BYTES).build();

        writer.writeInline("func $L(stream $T, encoder $P, signer $T",
                getEventStreamWriterImplConstructorName(eventStream, service), writeCloser, encoderSymbol,
                signerInterface);
        if (withInitialMessages) {
            writer.writeInline(", irs func(interface{}, $P) error", messageSymbol);
        }
        writer.openBlock(") $P {", "}", writerSymbol, () -> writer
                .openBlock("w := &$T{", "}", writerSymbol, () -> {
                    var onceErr = SymbolUtils.createValueSymbolBuilder("NewOnceErr",
                            SmithyGoDependency.SMITHY_SYNC).build();
                    writer.write("""
                                 encoder: encoder,
                                 signer: signer,
                                 stream: make(chan $T),
                                 eventStream: stream,
                                 done: make(chan struct{}),
                                 err: $T(),
                                 serializationBuffer: $T(nil),
                                 signingBuffer: $T(nil),
                                 """, asyncEventSymbol, onceErr, bytesNewBuffer, bytesNewBuffer);
                    if (withInitialMessages) {
                        writer.write("initialRequestSerializer: irs,");
                    }
                }).write("")
                .write("""
                       go w.writeStream()

                       return w
                       """)).write("");

        Symbol contextSymbol = SymbolUtils.createValueSymbolBuilder("Context", SmithyGoDependency.CONTEXT).build();

        writer.openBlock("func (w $P) Send(ctx $P, event $P) error {", "}", writerSymbol, contextSymbol,
                eventUnionSymbol, () -> {
                    if (withInitialMessages) {
                        writer.write("return w.send(ctx, &$T{Value: event})",
                                getWriterEventWrapperMessageType(symbolProvider, eventStream, service));
                    } else {
                        writer.write("return w.send(ctx, event)");
                    }
                }).write("");

        writer.openBlock("func (w $P) send(ctx $P, event $P) error {", "}", writerSymbol, contextSymbol,
                eventSymbol, () -> {
                    writer.write("""
                                 if err := w.err.Err(); err != nil {
                                     return err
                                 }

                                 resultCh := make(chan error)

                                 wrapped := $T{
                                     Event: event,
                                     Result: resultCh,
                                 }
                                 """, asyncEventSymbol);

                    Symbol errorfSymbol = SymbolUtils.createValueSymbolBuilder("Errorf", SmithyGoDependency.FMT)
                            .build();
                    final String streamClosedError = "stream closed, unable to send event";

                    writer.openBlock("select {", "}", () -> writer
                            .write("""
                                   case w.stream <- wrapped:
                                   case <-ctx.Done():
                                       return ctx.Err()
                                   case <-w.done:
                                       return $T($S)
                                   """, errorfSymbol, streamClosedError)).write("");

                    writer.openBlock("select {", "}", () -> writer
                            .write("""
                                   case err := <-resultCh:
                                       return err
                                   case <-ctx.Done():
                                       return ctx.Err()
                                   case <-w.done:
                                       return $T($S)
                                   """, errorfSymbol, streamClosedError)).write("");
                }).write("");

        writer.openBlock("func (w $P) writeStream() {", "}", writerSymbol, () -> writer
                .write("defer w.Close()").write("")
                .openBlock("for {", "}", () -> writer
                        .openBlock("select {", "}", () -> writer
                                .openBlock("case wrapper := <-w.stream:", "", () -> writer
                                        .write("err := w.writeEvent(wrapper.Event)")
                                        .write("wrapper.ReportResult(w.done, err)")
                                        .openBlock("if err != nil {", "}", () -> writer
                                                .write("w.err.SetError(err)")
                                                .write("return")))
                                .openBlock("case <-w.done:", "", () -> writer
                                        .openBlock("if err := w.closeStream(); err != nil {", "}",
                                                () -> writer.write("w.err.SetError(err)"))
                                        .write("return"))))).write("");

        writer.openBlock("func (w $P) writeEvent(event $P) error {", "}", writerSymbol, eventSymbol, () -> {
            Runnable returnErr = () -> writer.openBlock("if err != nil {", "}", () -> writer.write("return err"))
                    .write("");
            writer.writeDocs("""
                             serializedEvent returned bytes refers to an underlying byte buffer and must not escape
                             this writeEvent scope without first copying. Any previous bytes stored in the buffer
                             are cleared by this call.
                             """);
            writer.write("serializedEvent, err := w.serializeEvent(event)");
            returnErr.run();
            writer.writeDocs("""
                             signedEvent returned bytes refers to an underlying byte buffer and must not escape
                             this writeEvent scope without first copying. Any previous bytes stored in the buffer
                             are cleared by this call.
                             """);
            writer.write("signedEvent, err := w.signEvent(serializedEvent)");
            returnErr.run();
            writer.writeDocs("bytes are now copied to the underlying stream writer");
            writer.write("_, err = io.Copy(w.eventStream, bytes.NewReader(signedEvent))")
                    .write("return err");
        }).write("");

        writer.openBlock("func (w $P) serializeEvent(event $P) ([]byte, error) {", "}", writerSymbol, eventSymbol,
                () -> {
                    writer.write("w.serializationBuffer.Reset()").write("")
                            .write("eventMessage := $T{}", messageSymbol).write("");

                    if (withInitialMessages) {
                        var initialRequestType = getWriterEventWrapperInitialRequestType(symbolProvider, eventStream,
                                service);
                        var messageEventType = getWriterEventWrapperMessageType(symbolProvider, eventStream,
                                service);
                        var errorf = getSymbol("Errorf", SmithyGoDependency.FMT, false);
                        writer.write("""
                                     switch ev := event.(type) {
                                     case $P:
                                         if err := w.initialRequestSerializer(ev.Value, &eventMessage); err != nil {
                                             return nil, err
                                         }
                                     case $P:
                                         if err := $L(ev.Value, &eventMessage); err != nil {
                                             return nil, err
                                         }
                                     default:
                                         return nil, $T("unknown event wrapper type: %v", event)
                                     }
                                     """, initialRequestType, messageEventType, errorf);
                    } else {
                        writer.write("""
                                     if err := $L(event, &eventMessage); err != nil {
                                         return nil, err
                                     }
                                     """,
                                getEventStreamSerializerName(eventStream, service, context.getProtocolName()));
                    }

                    writer.write("""
                                 if err := w.encoder.Encode(w.serializationBuffer, eventMessage); err != nil {
                                     return nil, err
                                 }

                                 return w.serializationBuffer.Bytes(), nil""");
                }).write("");

        writer.openBlock("func (w $P) signEvent(payload []byte) ([]byte, error) {", "}", writerSymbol, () -> {
            var timestampValue = getEventStreamSymbol("TimestampValue", false);
            var dateHeader = getEventStreamApiSymbol("DateHeader", false);
            var chunkSignatureHeader = getEventStreamApiSymbol("ChunkSignatureHeader", false);
            var bytesValue = getEventStreamSymbol("BytesValue", false);

            writer.addUseImports(SmithyGoDependency.TIME);
            writer.write("w.signingBuffer.Reset()").write("")
                    .write("date := time.Now().UTC()").write("")
                    .write("var msg $T", messageSymbol)
                    .write("msg.Headers.Set($T, $T(date))", dateHeader, timestampValue)
                    .write("msg.Payload = payload").write("")
                    .write("var headers bytes.Buffer")
                    .openBlock("if err := $T(&headers, msg.Headers); err != nil {", "}",
                            getEventStreamSymbol("EncodeHeaders", false),
                            () -> writer.write("return nil, err")).write("")
                    .write("sig, err := w.signer.GetSignature(context.Background(), headers.Bytes(), "
                           + "msg.Payload, date)")
                    .openBlock("if err != nil {", "}", () -> writer
                            .write("return nil, err")).write("")
                    .write("msg.Headers.Set($T, $T(sig))", chunkSignatureHeader, bytesValue).write("")
                    .openBlock("if err := w.encoder.Encode(w.signingBuffer, msg); err != nil {", "}", () -> writer
                            .write("return nil, err")).write("")
                    .write("return w.signingBuffer.Bytes(), nil");
        }).write("");

        writer.openBlock("func (w $P) closeStream() (err error) {", "}", writerSymbol, () -> writer
                .openBlock("defer func() {", "}()", () -> writer
                        .openBlock("if cErr := w.eventStream.Close(); cErr != nil && err == nil {", "}",
                                () -> writer.write("err = cErr"))).write("")
                .write("""
                       // Per the protocol, a signed empty message is used to indicate the end of the stream,
                       // and that no subsequent events will be sent.
                       signedEvent, err := w.signEvent([]byte{})""")
                .openBlock("if err != nil {", "}", () -> writer.write("return err")).write("")
                .write("_, err = io.Copy(w.eventStream, bytes.NewReader(signedEvent))")
                .write("return err")).write("");

        writer.openBlock("func (w $P) ErrorSet() <-chan struct{} {", "}", writerSymbol, () -> writer
                .write("return w.err.ErrorSet()")).write("");

        writer.openBlock("func (w $P) Close() error {", "}", writerSymbol, () -> writer
                .write("w.closeOnce.Do(w.safeClose)")
                .write("return w.Err()")).write("");

        writer.openBlock("func (w $P) safeClose() {", "}", writerSymbol, () -> writer
                .write("close(w.done)")).write("");

        writer.openBlock("func (w $P) Err() error {", "}", writerSymbol, () -> writer
                .write("return w.err.Err()")).write("");
    }

    private static void generateEventStreamWriterMessageWrapper(
            UnionShape eventStream,
            ServiceShape service,
            SymbolProvider symbolProvider,
            GoWriter writer,
            Symbol eventUnionSymbol
    ) {
        var writerEventWrapperInterface = getWriterEventWrapperInterface(symbolProvider, eventStream, service);
        var interfaceMethod = "is" + StringUtils.capitalize(writerEventWrapperInterface.getName());
        writer.write("""
                     type $T interface {
                         $L()
                     }
                     """, writerEventWrapperInterface, interfaceMethod);

        var writerEventWrapperMessageType = getWriterEventWrapperMessageType(symbolProvider, eventStream, service);
        writer.write("""
                     type $T struct {
                         Value $P
                     }

                     func ($P) $L() {}
                     """, writerEventWrapperMessageType, eventUnionSymbol, writerEventWrapperMessageType,
                interfaceMethod);

        var writerEventWrapperInitialRequestType = getWriterEventWrapperInitialRequestType(symbolProvider, eventStream,
                service);
        writer.write("""
                     type $T struct {
                         Value interface{}
                     }

                     func ($P) $L() {}
                     """, writerEventWrapperInitialRequestType, writerEventWrapperInitialRequestType, interfaceMethod);
    }

    private static Symbol getWriterEventWrapperInterface(
            SymbolProvider symbolProvider,
            UnionShape eventStream,
            ServiceShape service
    ) {
        var name = StringUtils.uncapitalize(eventStream.toShapeId().getName(service)) + "WriteEvent";
        return SymbolUtils.createValueSymbolBuilder(name, symbolProvider.toSymbol(service).getNamespace()).build();
    }

    private static Symbol getWriterEventWrapperMessageType(
            SymbolProvider symbolProvider,
            UnionShape eventStream,
            ServiceShape service
    ) {
        var interfaceSymbol = getWriterEventWrapperInterface(symbolProvider, eventStream, service);
        var name = interfaceSymbol.getName() + "Message";
        return SymbolUtils.createPointableSymbolBuilder(name, symbolProvider.toSymbol(service).getNamespace())
                .build();
    }

    private static Symbol getWriterEventWrapperInitialRequestType(
            SymbolProvider symbolProvider,
            UnionShape eventStream,
            ServiceShape service
    ) {
        var interfaceSymbol = getWriterEventWrapperInterface(symbolProvider, eventStream, service);
        var name = interfaceSymbol.getName() + "InitialRequest";
        return SymbolUtils.createPointableSymbolBuilder(name, symbolProvider.toSymbol(service).getNamespace())
                .build();
    }

    private static Symbol getReaderEventWrapperInterface(
            SymbolProvider symbolProvider,
            UnionShape eventStream,
            ServiceShape service
    ) {
        var name = StringUtils.uncapitalize(eventStream.toShapeId().getName(service)) + "ReadEvent";
        return SymbolUtils.createValueSymbolBuilder(name, symbolProvider.toSymbol(service).getNamespace()).build();
    }

    private static Symbol getReaderEventWrapperMessageType(
            SymbolProvider symbolProvider,
            UnionShape eventStream,
            ServiceShape service
    ) {
        var interfaceSymbol = getReaderEventWrapperInterface(symbolProvider, eventStream, service);
        var name = interfaceSymbol.getName() + "Message";
        return SymbolUtils.createPointableSymbolBuilder(name, symbolProvider.toSymbol(service).getNamespace())
                .build();
    }

    private static Symbol getReaderEventWrapperInitialResponseType(
            SymbolProvider symbolProvider,
            UnionShape eventStream,
            ServiceShape service
    ) {
        var interfaceSymbol = getReaderEventWrapperInterface(symbolProvider, eventStream, service);
        var name = interfaceSymbol.getName() + "InitialResponse";
        return SymbolUtils.createPointableSymbolBuilder(name, symbolProvider.toSymbol(service).getNamespace())
                .build();
    }

    public static void generateEventStreamSerializer(
            GenerationContext context,
            UnionShape eventUnion
    ) {
        GoWriter writer = context.getWriter().get();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        ServiceShape serviceShape = context.getService();
        Symbol eventUnionSymbol = symbolProvider.toSymbol(eventUnion);
        Model model = context.getModel();
        GoPointableIndex pointableIndex = GoPointableIndex.of(model);

        var eventTypeHeader = getEventStreamApiSymbol("EventTypeHeader", false);
        var stringValue = getEventStreamSymbol("StringValue", false);

        writer.openBlock("func $L(v $P, msg $P) error {", "}", getEventStreamSerializerName(eventUnion,
                        serviceShape, context.getProtocolName()), eventUnionSymbol,
                getEventStreamSymbol("Message"), () -> {
                    Symbol errof = getSymbol("Errorf", SmithyGoDependency.FMT, false);
                    writer.write("""
                                 if v == nil {
                                    return $T("unexpected serialization of nil %T", v)
                                 }
                                 """, errof)
                            .write("")
                            .openBlock("switch vv := v.(type) {", "}", () -> {
                                for (MemberShape member : eventUnion.members()) {
                                    Symbol memberSymbol = SymbolUtils.createPointableSymbolBuilder(
                                                    symbolProvider.toMemberName(member),
                                                    eventUnionSymbol.getNamespace())
                                            .build();

                                    writer.openBlock("case $P:", "", memberSymbol, () -> writer
                                            .write("msg.Headers.Set($T, $T($S))", eventTypeHeader, stringValue,
                                                    member.getMemberName())
                                            .write("return $L($L, msg)",
                                                    getEventStreamMessageSerializerName(member.getTarget(),
                                                            serviceShape, context.getProtocolName()),
                                                    CodegenUtils.getAsPointerIfPointable(model, writer, pointableIndex,
                                                            model.expectShape(member.getTarget()), "vv.Value")));
                                }
                                writer.write("""
                                             default:
                                                return $T("unexpected event message type: %v", v)
                                             """, errof);
                            });
                });
    }

    public static void generateEventMessageSerializer(
            GenerationContext context,
            Shape targetShape,
            MessageSerDelegator messageSerDelegator
    ) {
        var writer = context.getWriter().get();
        var model = context.getModel();

        var serviceShape = context.getService();
        var serializerName = getEventStreamMessageSerializerName(targetShape, serviceShape,
                context.getProtocolName());

        var errorf = getSymbol("Errorf", SmithyGoDependency.FMT, false);
        var messageTypeHeader = getEventStreamApiSymbol("MessageTypeHeader");
        var stringValue = getEventStreamSymbol("StringValue", false);
        var eventMessageType = getEventStreamApiSymbol("EventMessageType", false);
        var contentTypeHeader = getEventStreamApiSymbol("ContentTypeHeader", false);

        var symbolProvider = context.getSymbolProvider();

        writer.openBlock("func $L(v $P, msg $P) error {", "}", serializerName, symbolProvider.toSymbol(targetShape),
                getEventStreamSymbol("Message"), () -> {
                    writer.write("""
                                 if v == nil {
                                  return $T("unexpected serialization of nil %T", v)
                                 }
                                 """, errorf).write("")
                            .write("msg.Headers.Set($T, $T($T))", messageTypeHeader, stringValue, eventMessageType);

                    var headerBindings = targetShape.members().stream()
                            .filter(memberShape -> memberShape.hasTrait(EventHeaderTrait.class))
                            .collect(Collectors.toSet());

                    var payloadBinding = targetShape.members().stream()
                            .filter(memberShape -> memberShape.hasTrait(EventPayloadTrait.class))
                            .reduce((memberShape, memberShape2) -> {
                                throw new CodegenException("expect only one EventPayloadTrait targetShape");
                            });

                    if (!headerBindings.isEmpty() || payloadBinding.isPresent()) {
                        for (var headerBinding : headerBindings) {
                            new HeaderShapeSerVisitor(writer, model, headerBinding, "msg",
                                    headerBinding.getMemberName(), symbolProvider.toMemberName(headerBinding))
                                    .writeHeaderSerializer();
                        }
                        if (payloadBinding.isPresent()) {
                            var memberShape = payloadBinding.get();
                            var payloadTarget = model.expectShape(memberShape.getTarget());
                            switch (payloadTarget.getType()) {
                                case STRUCTURE:
                                case UNION:
                                    messageSerDelegator.writeSerPayloadDelegation(context, payloadTarget,
                                            "v." + symbolProvider.toMemberName(memberShape));
                                    break;
                                case STRING:
                                    GoValueAccessUtils.writeIfNonZeroValueMember(model, symbolProvider, writer,
                                            memberShape, "v", operand -> {
                                                writer.write("msg.Headers.Set($T, $T(\"text/plain\"))",
                                                        contentTypeHeader, stringValue);
                                                writer.write("msg.Payload = []byte($L)", operand);
                                            });
                                    writer.write("return nil");
                                    break;
                                case BLOB:
                                    GoValueAccessUtils.writeIfNonZeroValueMember(model, symbolProvider, writer,
                                            memberShape, "v", operand -> {
                                                writer.write("msg.Headers.Set($T, $T(\"application/octet-stream\"))",
                                                        contentTypeHeader, stringValue);
                                                writer.write("msg.Payload = $L", operand);
                                            });
                                    writer.write("return nil");
                                    break;
                                default:
                                    throw new CodegenException("unexpected event payload shape: "
                                                               + payloadTarget.getType());
                            }
                        }
                    } else {
                        messageSerDelegator.writeSerPayloadDelegation(context, targetShape, "v");
                    }
                }).write("");
    }

    public static void generateEventStreamDeserializer(GenerationContext context, UnionShape eventUnion) {
        var writer = context.getWriter().get();
        var symbolProvider = context.getSymbolProvider();
        var serviceShape = context.getService();
        var eventUnionSymbol = symbolProvider.toSymbol(eventUnion);
        var model = context.getModel();

        var deserializerName = getEventStreamDeserializerName(eventUnion,
                serviceShape, context.getProtocolName());
        writer.openBlock("func $L(v *$T, msg $P) error {", "}", deserializerName, eventUnionSymbol,
                getEventStreamSymbol("Message"), () -> {
                    var errof = getSymbol("Errorf", SmithyGoDependency.FMT, false);
                    var eventTypeHeader = getEventStreamApiSymbol("EventTypeHeader", false);
                    var equalFold = SymbolUtils.createValueSymbolBuilder("EqualFold",
                            SmithyGoDependency.STRINGS).build();
                    writer.write("""
                                 if v == nil {
                                    return $T("unexpected serialization of nil %T", v)
                                 }
                                 """, errof)
                            .write("")
                            .write("""
                                   eventType := msg.Headers.Get($T)
                                   if eventType == nil {
                                       return $T("%s event header not present", $T)
                                   }
                                   """, eventTypeHeader, errof, eventTypeHeader).write("")
                            .openBlock("switch {", "}", () -> {
                                var members = eventUnion.members().stream()
                                        .filter(ms -> ms.getMemberTrait(model, ErrorTrait.class).isEmpty())
                                        .collect(Collectors.toCollection(TreeSet::new));
                                for (var member : members) {
                                    writer.openBlock("case $T($S, eventType.String()):", "", equalFold,
                                            member.getMemberName(), () -> {
                                                var messageDeserializerName =
                                                        getEventStreamMessageDeserializerName(
                                                                model.expectShape(member.getTarget()), serviceShape,
                                                                context.getProtocolName());
                                                var memberSymbol = SymbolUtils.createValueSymbolBuilder(
                                                                symbolProvider.toMemberName(member),
                                                                eventUnionSymbol.getNamespace())
                                                        .build();
                                                writer.write("""
                                                             vv := &$T{}
                                                             if err := $L(&vv.Value, msg); err != nil {
                                                              return err
                                                             }
                                                             *v = vv
                                                             return nil
                                                             """, memberSymbol, messageDeserializerName);
                                            });
                                }
                                var newBuffer = getSymbol("NewBuffer", SmithyGoDependency.BYTES);
                                var newEncoder = getEventStreamSymbol("NewEncoder");
                                writer.write("""
                                             default:
                                                 buffer := $T(nil)
                                                 $T().Encode(buffer, *msg)
                                                 *v = &$T{
                                                     Tag: eventType.String(),
                                                     Value: buffer.Bytes(),
                                                 }
                                                 return nil
                                             """, newBuffer, newEncoder, SymbolUtils.
                                        createValueSymbolBuilder("UnknownUnionMember",
                                                eventUnionSymbol.getNamespace()).build());
                            });
                }).write("");
    }

    public static void generateEventStreamExceptionDeserializer(
            GenerationContext context,
            UnionShape eventUnion,
            UnknownExceptionDeserDelegator unknownExceptionDeserDelegator
    ) {
        var writer = context.getWriter().get();
        var model = context.getModel();

        var serviceShape = context.getService();
        var protocolName = context.getProtocolName();
        var deserializerName = getEventStreamExceptionDeserializerName(eventUnion, serviceShape,
                protocolName);

        var errorf = getSymbol("Errorf", SmithyGoDependency.FMT, false);
        var exceptionTypeHeader = getEventStreamApiSymbol("ExceptionTypeHeader", false);

        var equalFold = SymbolUtils.createValueSymbolBuilder("EqualFold", SmithyGoDependency.STRINGS).build();

        writer.openBlock("func $L(msg $P) error {", "}", deserializerName, getEventStreamSymbol("Message"), () -> {
            writer.write("""
                         exceptionType := msg.Headers.Get($T)
                         if exceptionType == nil {
                             return $T("%s event header not present", $T)
                         }
                         """, exceptionTypeHeader, errorf, exceptionTypeHeader).write("");

            var errorMemberShapes = eventUnion.members().stream()
                    .filter(ms -> ms.getMemberTrait(model, ErrorTrait.class).isPresent())
                    .collect(Collectors.toCollection(TreeSet::new));

            writer.openBlock("switch {", "}", () -> {
                for (MemberShape memberShape : errorMemberShapes) {
                    writer.openBlock("case $T($S, exceptionType.String()):", "", equalFold,
                            memberShape.getMemberName(), () -> {
                                writer.write("return $L(msg)",
                                        getEventMessageExceptionDeserializerName(memberShape.getTarget(),
                                                serviceShape, protocolName));
                            });
                }
                writer.openBlock("default:", "", () -> {
                    unknownExceptionDeserDelegator.writeUnknownExceptionDelegator(context);
                });
            });
        }).write("");
    }

    private static String getEventMessageExceptionDeserializerName(
            ToShapeId toShapeId,
            ServiceShape serviceShape,
            String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_deserializeEventMessageException");
    }

    private static String getEventStreamExceptionDeserializerName(
            ToShapeId toShapeId,
            ServiceShape serviceShape,
            String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_deserializeEventStreamException");
    }

    private static String getEventStreamMessageDeserializerName(
            ToShapeId toShapeId,
            ServiceShape serviceShape,
            String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_deserializeEventMessage");
    }

    private static String getEventStreamDeserializerName(
            ToShapeId toShapeId,
            ServiceShape serviceShape,
            String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_deserializeEventStream");
    }

    public static void generateEventMessageDeserializer(
            GenerationContext context,
            Shape targetShape,
            MessageDeserDelegator messageDeserDelegator
    ) {
        var writer = context.getWriter().get();
        var model = context.getModel();

        var serviceShape = context.getService();
        var deserializerName = getEventStreamMessageDeserializerName(targetShape, serviceShape,
                context.getProtocolName());

        var errorf = getSymbol("Errorf", SmithyGoDependency.FMT, false);
        var pointableIndex = GoPointableIndex.of(model);

        var symbolProvider = context.getSymbolProvider();

        writer.openBlock("func $L(v $P, msg $P) error {", "}", deserializerName, symbolProvider.toSymbol(targetShape),
                getEventStreamSymbol("Message"), () -> {
                    writer.write("""
                                 if v == nil {
                                  return $T("unexpected serialization of nil %T", v)
                                 }
                                 """, errorf).write("");

                    var headerBindings = targetShape.members().stream()
                            .filter(memberShape -> memberShape.hasTrait(EventHeaderTrait.class))
                            .collect(Collectors.toSet());

                    var payloadBinding = targetShape.members().stream()
                            .filter(memberShape -> memberShape.hasTrait(EventPayloadTrait.class))
                            .reduce((memberShape, memberShape2) -> {
                                throw new CodegenException("expect only one EventPayloadTrait targetShape");
                            });

                    if (!headerBindings.isEmpty() || payloadBinding.isPresent()) {
                        for (var headerBinding : headerBindings) {
                            var dest = String.format("v.%s",
                                    symbolProvider.toMemberName(headerBinding));
                            new HeaderShapeDeserVisitor(writer, model, headerBinding, dest,
                                    headerBinding.getMemberName(), "msg").writeDeserializer();
                        }
                        if (payloadBinding.isPresent()) {
                            var memberShape = payloadBinding.get();
                            var payloadTarget = model.expectShape(memberShape.getTarget());
                            switch (payloadTarget.getType()) {
                                case STRUCTURE:
                                case UNION:
                                    messageDeserDelegator.writeDeserPayloadDelegation(context, payloadTarget,
                                            "v." + symbolProvider.toMemberName(memberShape));
                                    break;
                                case STRING:
                                    writer.openBlock("if msg.Payload != nil {", "}", () -> {
                                        var pointable = CodegenUtils.getAsPointerIfPointable(model, writer,
                                                pointableIndex, memberShape, "string(msg.Payload)");
                                        writer.write("$L = $L", String.format("v.%s",
                                                symbolProvider.toMemberName(memberShape)), pointable);
                                    });
                                    writer.write("return nil");
                                    break;
                                case BLOB:
                                    writer.openBlock("if msg.Payload != nil {", "}", () -> {
                                        writer.write("""
                                                     bsv := make([]byte, len(msg.Payload))
                                                     copy(bsv, msg.Payload)
                                                     """);
                                        var pointable = CodegenUtils.getAsPointerIfPointable(model, writer,
                                                pointableIndex, memberShape, "bsv");
                                        writer.write("$L = $L", String.format("v.%s",
                                                symbolProvider.toMemberName(memberShape)), pointable);
                                    });
                                    writer.write("return nil");
                                    break;
                                default:
                                    throw new CodegenException("unexpected event payload shape: "
                                                               + payloadTarget.getType());
                            }
                        }
                    } else {
                        messageDeserDelegator.writeDeserPayloadDelegation(context, targetShape, "v");
                    }
                }).write("");
    }

    public static void generateEventMessageExceptionDeserializer(
            GenerationContext context,
            Shape exceptionShape,
            ExceptionDeserDelegator exceptionDeserDelegator
    ) {
        var writer = context.getWriter().get();
        var serviceShape = context.getService();
        var protocolName = context.getProtocolName();
        var deserializerName = getEventMessageExceptionDeserializerName(exceptionShape, serviceShape,
                protocolName);

        writer.openBlock("func $L(msg $P) error {", "}", deserializerName, getEventStreamSymbol("Message"), () -> {
            exceptionDeserDelegator.writeDeserExceptionDelegator(context, exceptionShape);
        }).write("");
    }

    private static String getEventStreamSerializerName(
            ToShapeId toShapeId,
            ServiceShape serviceShape,
            String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_serializeEventStream");
    }

    private static String getEventStreamMessageSerializerName(
            ToShapeId toShapeId,
            ServiceShape serviceShape,
            String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_serializeEventMessage");
    }

    private static String getEventStreamWriterImplConstructorName(UnionShape unionShape, ServiceShape serviceShape) {
        return "new" + StringUtils.capitalize(getEventStreamReaderImplName(unionShape, serviceShape));
    }

    private static String getEventStreamReaderImplConstructorName(UnionShape unionShape, ServiceShape serviceShape) {
        return "new" + StringUtils.capitalize(getEventStreamWriterImplName(unionShape, serviceShape));
    }

    private static void generateAsyncWriteReporter(GoWriter writer, Symbol eventSymbol, Symbol asyncEventSymbol) {
        writer.openBlock("type $T struct {", "}", asyncEventSymbol, () -> {
            writer.write("Event $T", eventSymbol);
            writer.write("Result chan<- error");
        }).write("");

        writer.openBlock("func (e $T) ReportResult(cancel <-chan struct{}, err error) bool {", "}", asyncEventSymbol,
                () -> writer.openBlock("select {", "}", () -> writer
                        .openBlock("case e.Result <- err:", "", () -> writer.write("return true"))
                        .openBlock("case <-cancel:", "", () -> writer.write("return false"))
                )).write("");
    }

    public static String getAsyncWriteReporterName(Shape shape, ServiceShape serviceShape) {
        var name = shape.getId().getName(serviceShape);
        return "async" + StringUtils.capitalize(name);
    }

    public static String getEventStreamWriterImplName(Shape shape, ServiceShape serviceShape) {
        var name = shape.getId().getName(serviceShape);
        return StringUtils.uncapitalize(name);
    }

    public static String getEventStreamReaderImplName(Shape shape, ServiceShape serviceShape) {
        var name = shape.getId().getName(serviceShape);
        return StringUtils.uncapitalize(name);
    }

    private static Symbol getEventStreamSymbol(String name) {
        return getEventStreamSymbol(name, true);
    }

    private static Symbol getEventStreamSymbol(String name, boolean pointable) {
        return getSymbol(name, AwsGoDependency.SERVICE_INTERNAL_EVENTSTREAM, pointable);
    }

    private static Symbol getEventStreamApiSymbol(String name) {
        return getEventStreamApiSymbol(name, true);
    }

    private static Symbol getEventStreamApiSymbol(String name, boolean pointable) {
        return getSymbol(name, AwsGoDependency.SERVICE_INTERNAL_EVENTSTREAMAPI, pointable);
    }

    private static Symbol getSymbol(String name, GoDependency dependency) {
        return getSymbol(name, dependency, true);
    }

    private static Symbol getSymbol(String name, GoDependency dependency, boolean pointable) {
        if (pointable) {
            return SymbolUtils.createPointableSymbolBuilder(name, dependency).build();
        }
        return SymbolUtils.createValueSymbolBuilder(name, dependency).build();
    }

    private static Symbol getModuleSymbol(GoSettings settings, String name) {
        return getModuleSymbol(settings, name, true);
    }

    private static Symbol getModuleSymbol(GoSettings settings, String name, boolean pointable) {
        if (pointable) {
            return SymbolUtils.createPointableSymbolBuilder(name, settings.getModuleName()).build();
        }
        return SymbolUtils.createValueSymbolBuilder(name, settings.getModuleName()).build();
    }

    public static void generateEventMessageRequestSerializer(
            GenerationContext context,
            Shape inputShape,
            MessageSerDelegator messageSerDelegator
    ) {
        var writer = context.getWriter().get();
        var model = context.getModel();

        var serviceShape = context.getService();
        var serializerName = getEventStreamMessageRequestSerializerName(inputShape, serviceShape,
                context.getProtocolName());

        var errorf = getSymbol("Errorf", SmithyGoDependency.FMT, false);
        var messageTypeHeader = getEventStreamApiSymbol("MessageTypeHeader");
        var stringValue = getEventStreamSymbol("StringValue", false);
        var eventMessageType = getEventStreamApiSymbol("EventMessageType", false);
        var eventTypeHeader = getEventStreamApiSymbol("EventTypeHeader", false);

        var symbolProvider = context.getSymbolProvider();

        writer.openBlock("func $L(i interface{}, msg $P) error {", "}", serializerName, getEventStreamSymbol("Message"),
                () -> {
                    var inputSymbol = symbolProvider.toSymbol(inputShape);
                    writer.write("""
                                 if i == nil {
                                     return $T("event message serializer expects non-nil %T", ($P)(nil))
                                 }

                                 v, ok := i.($P)
                                 if !ok {
                                     return $T("unexpected serialization of %T", i)
                                 }
                                 """, errorf, inputSymbol, inputSymbol, errorf).write("")
                            .write("""
                                   msg.Headers.Set($T, $T($T))
                                   msg.Headers.Set($T, $T($S))
                                   """,
                                    messageTypeHeader, stringValue, eventMessageType,
                                    eventTypeHeader, stringValue, "initial-request"
                            ).write("");
                    messageSerDelegator.writeSerPayloadDelegation(context, inputShape, "v");
                }).write("");
    }

    public static void generateEventMessageRequestDeserializer(
            GenerationContext context,
            Shape inputShape,
            MessageSerDelegator messageSerDelegator
    ) {
        var writer = context.getWriter().get();
        var model = context.getModel();

        var serviceShape = context.getService();
        var serializerName = getEventStreamMessageResponseDeserializerName(inputShape, serviceShape,
                context.getProtocolName());

        var errorf = getSymbol("Errorf", SmithyGoDependency.FMT, false);

        var symbolProvider = context.getSymbolProvider();

        writer.openBlock("func $L(msg $P) (interface{}, error) {", "}", serializerName, getEventStreamSymbol("Message"),
                () -> {
                    var inputSymbol = symbolProvider.toSymbol(inputShape);
                    writer.write("v := &$T{}", inputSymbol).write("");
                    messageSerDelegator.writeSerPayloadDelegation(context, inputShape, "v");
                }).write("");
    }

    private static String getEventStreamMessageRequestSerializerName(
            ToShapeId toShapeId,
            ServiceShape serviceShape,
            String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_serializeEventMessageRequest");
    }

    private static String getEventStreamMessageResponseDeserializerName(
            ToShapeId toShapeId, ServiceShape serviceShape, String protocolName
    ) {
        return getSerDeName(toShapeId, serviceShape, protocolName, "_deserializeEventMessageResponse");
    }

    private static String getSerDeName(
            ToShapeId toShapeId, ServiceShape serviceShape, String protocolName, String name
    ) {
        return StringUtils.uncapitalize(protocolName) + name
               + toShapeId.toShapeId().getName(serviceShape);
    }

    public static void writeOperationSerializerMiddlewareEventStreamSetup(
            GenerationContext context,
            EventStreamInfo info
    ) {
        context.getWriter().get()
                .write("restEncoder.SetHeader(\"Content-Type\").String($S)", "application/vnd.amazon.eventstream")
                .write("");
    }

    interface MessageSerDelegator {
        void writeSerPayloadDelegation(GenerationContext context, Shape payloadTarget, String operand);
    }

    interface MessageDeserDelegator {
        void writeDeserPayloadDelegation(GenerationContext context, Shape payloadTarget, String operand);
    }

    interface ExceptionDeserDelegator {
        void writeDeserExceptionDelegator(GenerationContext context, Shape payloadTarget);
    }

    interface UnknownExceptionDeserDelegator {
        void writeUnknownExceptionDelegator(GenerationContext context);
    }

    private static class HeaderShapeSerVisitor extends ShapeVisitor.Default<Void> {
        private final GoWriter writer;
        private final Model model;
        private final MemberShape memberShape;
        private final String target;
        private final String headerName;
        private final String dataSource;
        private final GoPointableIndex pointableIndex;

        public HeaderShapeSerVisitor(
                GoWriter writer,
                Model model,
                MemberShape memberShape,
                String target,
                String headerName,
                String dataSource
        ) {
            this.writer = writer;
            this.model = model;
            this.memberShape = memberShape;
            this.target = target;
            this.headerName = headerName;
            this.dataSource = dataSource;
            this.pointableIndex = GoPointableIndex.of(this.model);
        }

        @Override
        public Void blobShape(BlobShape shape) {
            writeSetter("BytesValue");
            return null;
        }

        @Override
        public Void booleanShape(BooleanShape shape) {
            writeSetter("BoolValue");
            return null;
        }

        @Override
        public Void byteShape(ByteShape shape) {
            writeSetter("Int8Value");
            return null;
        }

        @Override
        public Void shortShape(ShortShape shape) {
            writeSetter("Int16Value");
            return null;
        }

        @Override
        public Void integerShape(IntegerShape shape) {
            writeSetter("Int32Value");
            return null;
        }

        @Override
        public Void longShape(LongShape shape) {
            writeSetter("Int64Value");
            return null;
        }

        @Override
        public Void stringShape(StringShape shape) {
            writeSetter("StringValue");
            return null;
        }

        @Override
        public Void timestampShape(TimestampShape shape) {
            writeSetter("TimestampValue");
            return null;
        }

        @Override
        protected Void getDefault(Shape shape) {
            throw new CodegenException("unsupported event stream header shape: " + shape.getType().toString());
        }

        private void writeSetter(String valueTypeSymbolName) {
            var ds = CodegenUtils.getAsValueIfDereferencable(pointableIndex, memberShape, dataSource);
            writer.write("$L.Set($S, $T($L))", target, headerName,
                    getEventStreamSymbol(valueTypeSymbolName, false), ds);
        }

        public void writeHeaderSerializer() {
            GoValueAccessUtils.writeIfNonZeroValue(model, writer, memberShape, dataSource,
                    () -> model.expectShape(memberShape.getTarget()).accept(this));
        }
    }

    private static class HeaderShapeDeserVisitor extends ShapeVisitor.Default<Void> {
        private final GoWriter writer;
        private final Model model;
        private final MemberShape memberShape;
        private final String dest;
        private final String headerName;
        private final String dataSource;
        private final GoPointableIndex pointableIndex;

        public HeaderShapeDeserVisitor(
                GoWriter writer,
                Model model,
                MemberShape memberShape,
                String dest,
                String headerName,
                String dataSource
        ) {
            this.writer = writer;
            this.model = model;
            this.memberShape = memberShape;
            this.dest = dest;
            this.headerName = headerName;
            this.dataSource = dataSource;
            this.pointableIndex = GoPointableIndex.of(this.model);
        }

        @Override
        public Void blobShape(BlobShape shape) {
            var sliceSymbol = SymbolUtils.createValueSymbolBuilder("[]byte")
                    .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
            writeTypeDeserializer(getEventStreamSymbol("BytesValue", false), sliceSymbol);
            return null;
        }

        @Override
        public Void booleanShape(BooleanShape shape) {
            var boolSymbol = SymbolUtils.createValueSymbolBuilder("bool")
                    .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
            writeTypeDeserializer(getEventStreamSymbol("BoolValue"), boolSymbol);
            return null;
        }

        @Override
        public Void byteShape(ByteShape shape) {
            var int8Symbol = SymbolUtils.createValueSymbolBuilder("int8")
                    .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
            writeTypeDeserializer(getEventStreamSymbol("Int8Value"), int8Symbol);
            return null;
        }

        @Override
        public Void shortShape(ShortShape shape) {
            var int16Symbol = SymbolUtils.createValueSymbolBuilder("int16")
                    .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
            writeTypeDeserializer(getEventStreamSymbol("Int16Value"), int16Symbol);
            return null;
        }

        @Override
        public Void integerShape(IntegerShape shape) {
            var int32Symbol = SymbolUtils.createValueSymbolBuilder("int32")
                    .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
            writeTypeDeserializer(getEventStreamSymbol("Int32Value"), int32Symbol);
            return null;
        }

        @Override
        public Void longShape(LongShape shape) {
            var int64Symbol = SymbolUtils.createValueSymbolBuilder("int64")
                    .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
            writeTypeDeserializer(getEventStreamSymbol("Int64Value"), int64Symbol);
            return null;
        }

        @Override
        public Void stringShape(StringShape shape) {
            var stringSymbol = SymbolUtils.createValueSymbolBuilder("string")
                    .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
            writeTypeDeserializer(getEventStreamSymbol("StringValue"), stringSymbol);
            return null;
        }

        @Override
        public Void timestampShape(TimestampShape shape) {
            var timeSymbol = SymbolUtils.createValueSymbolBuilder("Time", SmithyGoDependency.TIME).build();
            writeTypeDeserializer(getEventStreamSymbol("TimestampValue"), timeSymbol);
            return null;
        }

        @Override
        protected Void getDefault(Shape shape) {
            throw new CodegenException("unsupported event stream header shape: " + shape.getType().toString());
        }

        private void writeTypeDeserializer(Symbol apiHeaderType, Symbol concreteType) {
            writeTypeDeserializer(apiHeaderType, concreteType, () -> {
                var pointable = CodegenUtils.getAsPointerIfPointable(model, writer, pointableIndex, memberShape,
                        "ihv");
                writer.write("$L = $L", dest, pointable);
            });
        }

        private void writeTypeDeserializer(Symbol apiHeaderType, Symbol concreteType, Runnable setter) {
            writer.openBlock("{", "}", () -> {
                var errorf = SymbolUtils.createValueSymbolBuilder("Errorf", SmithyGoDependency.FMT).build();
                writer.write("headerValue := $L.Get($S)", dest, headerName)
                        .openBlock("if headerValue != nil {", "}", () -> {
                            writer.write("hv, ok := headerValue.($P)", apiHeaderType)
                                    .write("""
                                           if !ok {
                                            return $T("unexpected event header %s with type %T:", $S, headerValue)
                                           }
                                           """, errorf, headerName).write("")
                                    .write("ihv := headerValue.Get().($P)", concreteType);
                            setter.run();
                        });
            }).write("");
        }

        public void writeDeserializer() {
            model.expectShape(memberShape.getTarget()).accept(this);
        }
    }
}
