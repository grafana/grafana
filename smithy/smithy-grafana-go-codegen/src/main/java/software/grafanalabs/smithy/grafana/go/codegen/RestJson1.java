package software.grafanalabs.smithy.grafana.go.codegen;

import static software.amazon.smithy.go.codegen.integration.HttpProtocolGeneratorUtils.isShapeWithResponseBindings;
import static software.grafanalabs.smithy.grafana.go.codegen.AwsProtocolUtils.handleDecodeError;
import static software.grafanalabs.smithy.grafana.go.codegen.AwsProtocolUtils.initializeJsonDecoder;
import static software.grafanalabs.smithy.grafana.go.codegen.AwsProtocolUtils.writeJsonErrorMessageCodeDeserializer;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.go.codegen.GoStackStepMiddlewareGenerator;
import software.amazon.smithy.go.codegen.GoValueAccessUtils;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.SyntheticClone;
import software.amazon.smithy.go.codegen.integration.HttpBindingProtocolGenerator;
import software.amazon.smithy.go.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.go.codegen.integration.ProtocolUtils;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.EventStreamInfo;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.knowledge.HttpBinding.Location;
import software.amazon.smithy.model.knowledge.HttpBindingIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.ShapeType;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.aws.traits.protocols.RestJson1Trait;

/**
 * Handles generating the REST/JSON protocol for services.
 *
 * It handles reading and writing from document bodies, including generating any
 * functions needed for performing serde.
 *
 * @see <a href="https://awslabs.github.io/smithy/spec/http.html">Smithy HTTP protocol bindings.</a>
 */
public final class RestJson1 extends HttpBindingProtocolGenerator {
    private final Set<ShapeId> generatedDocumentBodyShapeSerializers = new HashSet<>();
    private final Set<ShapeId> generatedEventMessageSerializers = new HashSet<>();
    private final Set<ShapeId> generatedDocumentBodyShapeDeserializers = new HashSet<>();
    private final Set<ShapeId> generatedEventMessageDeserializers = new HashSet<>();

    RestJson1() {
        super(true);
    }

    @Override
    protected String getDocumentContentType() {
        return "application/json";
    }

    @Override
    public ShapeId getProtocol() {
        return RestJson1Trait.ID;
    }

    @Override
    protected TimestampFormatTrait.Format getDocumentTimestampFormat() {
        return TimestampFormatTrait.Format.EPOCH_SECONDS;
    }

    @Override
    protected void generateOperationDocumentSerializer(
            GenerationContext context,
            OperationShape operation
    ) {
        Model model = context.getModel();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(model);
        Set<MemberShape> documentBindings = bindingIndex.getRequestBindings(operation, HttpBinding.Location.DOCUMENT)
                .stream()
                .map(HttpBinding::getMember)
                .collect(Collectors.toSet());

        if (documentBindings.size() == 0) {
            return;
        }

        Shape inputShape = ProtocolUtils.expectInput(model, operation);
        inputShape.accept(new JsonShapeSerVisitor(context, documentBindings::contains));
    }

    @Override
    protected void writeMiddlewarePayloadAsDocumentSerializerDelegator(
            GenerationContext context,
            MemberShape memberShape,
            String operand
    ) {
        GoWriter writer = context.getWriter().get();
        Model model = context.getModel();
        Shape payloadShape = model.expectShape(memberShape.getTarget());

        String functionName;
        if (payloadShape.hasTrait(SyntheticClone.class)) {
            functionName = ProtocolGenerator.getDocumentSerializerFunctionName(
                    payloadShape, context.getService(), context.getProtocolName());
        } else {
            functionName = ProtocolGenerator.getDocumentSerializerFunctionName(
                    payloadShape, context.getService(), context.getProtocolName());
        }

        writeSetPayloadShapeHeader(writer, payloadShape);

        GoValueAccessUtils.writeIfNonZeroValueMember(context.getModel(), context.getSymbolProvider(), writer,
                memberShape, operand, (s) -> {
                    writer.addUseImports(SmithyGoDependency.SMITHY_JSON);
                    writer.addUseImports(SmithyGoDependency.BYTES);
                    writer.write("""
                                 jsonEncoder := smithyjson.NewEncoder()
                                 if err := $L($L, jsonEncoder.Value); err != nil {
                                     return out, metadata, &smithy.SerializationError{Err: err}
                                 }
                                 payload := bytes.NewReader(jsonEncoder.Bytes())""", functionName, s);
                    writeSetStream(writer, "payload");
                    if (payloadShape.getType() == ShapeType.STRUCTURE) {
                        writer.openBlock("} else {", "", () -> {
                            writer.write("""
                                         jsonEncoder := smithyjson.NewEncoder()
                                         jsonEncoder.Value.Object().Close()
                                         payload := bytes.NewReader(jsonEncoder.Bytes())""");
                            writeSetStream(writer, "payload");
                        });
                    }
                });
    }

    /**
     * Retruns the MediaType for the payload shape derived from the MediaTypeTrait, shape type, or document content type.
     *
     * @param payloadShape shape bound to the payload.
     * @return string for media type.
     */
    private String getPayloadShapeMediaType(Shape payloadShape) {
        Optional<MediaTypeTrait> mediaTypeTrait = payloadShape.getTrait(MediaTypeTrait.class);

        if (mediaTypeTrait.isPresent()) {
            return mediaTypeTrait.get().getValue();
        }

        if (payloadShape.isBlobShape()) {
            return "application/octet-stream";
        }

        if (payloadShape.isStringShape()) {
            return "text/plain";
        }

        return getDocumentContentType();
    }

    @Override
    protected void writeMiddlewareDocumentSerializerDelegator(
            GenerationContext context,
            OperationShape operation,
            GoStackStepMiddlewareGenerator generator
    ) {
        GoWriter writer = context.getWriter().get();
        writer.addUseImports(SmithyGoDependency.SMITHY);
        writer.addUseImports(SmithyGoDependency.SMITHY_JSON);

        writer.write("restEncoder.SetHeader(\"Content-Type\").String($S)", getDocumentContentType());
        writer.write("");

        Shape inputShape = ProtocolUtils.expectInput(context.getModel(), operation);
        String functionName = ProtocolGenerator.getDocumentSerializerFunctionName(inputShape, context.getService(), getProtocolName());

        writer.addUseImports(SmithyGoDependency.SMITHY_JSON);
        writer.write("jsonEncoder := smithyjson.NewEncoder()");
        writer.openBlock("if err := $L(input, jsonEncoder.Value); err != nil {", "}", functionName, () -> {
            writer.write("return out, metadata, &smithy.SerializationError{Err: err}");
        });
        writer.write("");

        writer.addUseImports(SmithyGoDependency.BYTES);
        writer.openBlock("if request, err = request.SetStream(bytes.NewReader(jsonEncoder.Bytes())); err != nil {", "}",
                () -> {
                    writer.write("return out, metadata, &smithy.SerializationError{Err: err}");
                });
    }

    @Override
    protected void generateDocumentBodyShapeSerializers(GenerationContext context, Set<Shape> shapes) {
        JsonShapeSerVisitor visitor = new JsonShapeSerVisitor(context);
        shapes.forEach(shape -> {
            if (generatedDocumentBodyShapeSerializers.contains(shape.toShapeId())) {
                return;
            }
            shape.accept(visitor);
            generatedDocumentBodyShapeSerializers.add(shape.toShapeId());
        });
    }

    @Override
    protected void writeMiddlewareDocumentDeserializerDelegator(
            GenerationContext context,
            OperationShape operation,
            GoStackStepMiddlewareGenerator generator
    ) {
        Model model = context.getModel();
        GoWriter writer = context.getWriter().get();
        Shape targetShape = ProtocolUtils.expectOutput(model, operation);
        String operand = "output";

        boolean isShapeWithPayloadBinding = isShapeWithResponseBindings(model, operation, HttpBinding.Location.PAYLOAD);
        if (isShapeWithPayloadBinding) {
            // since payload trait can only be applied to a single member in a output shape
            MemberShape memberShape = HttpBindingIndex.of(model)
                    .getResponseBindings(operation, HttpBinding.Location.PAYLOAD).stream()
                    .findFirst()
                    .orElseThrow(() -> new CodegenException("Expected payload binding member"))
                    .getMember();

            Shape payloadShape = model.expectShape(memberShape.getTarget());

            // if target shape is of type String or type Blob, then delegate deserializers for explicit payload shapes
            if (payloadShape.isStringShape() || payloadShape.isBlobShape()) {
                writeMiddlewarePayloadBindingDeserializerDelegator(writer, context.getService(), targetShape);
                return;
            }
            // for other payload target types we should deserialize using the appropriate document deserializer
            targetShape = payloadShape;
            operand += "." + context.getSymbolProvider().toMemberName(memberShape);
        }

        writer.addUseImports(SmithyGoDependency.SMITHY_IO);
        writer.write("var buff [1024]byte");
        writer.write("ringBuffer := smithyio.NewRingBuffer(buff[:])");
        writer.write("");

        writer.addUseImports(SmithyGoDependency.IO);
        writer.write("body := io.TeeReader(response.Body, ringBuffer)");
        writer.write("");

        writer.addUseImports(SmithyGoDependency.JSON);
        writer.write("decoder := json.NewDecoder(body)");
        writer.write("decoder.UseNumber()");
        AwsProtocolUtils.decodeJsonIntoInterface(writer, "out, metadata, ");
        writer.write("");

        writeMiddlewareDocumentBindingDeserializerDelegator(context, writer, targetShape, operand);
    }

    // Writes middleware that delegates to deserializers for shapes that have explicit payload.
    private void writeMiddlewarePayloadBindingDeserializerDelegator(
            GoWriter writer, ServiceShape service, Shape shape
    ) {
        String deserFuncName = ProtocolGenerator.getDocumentDeserializerFunctionName(shape, service, getProtocolName());
        writer.write("err = $L(output, response.Body)", deserFuncName);
        writer.openBlock("if err != nil {", "}", () -> {
            writer.addUseImports(SmithyGoDependency.SMITHY);
            writer.write(String.format("return out, metadata, &smithy.DeserializationError{Err:%s}",
                    "fmt.Errorf(\"failed to deserialize response payload, %w\", err)"));
        });
    }


    // Write middleware that delegates to deserializers for shapes that have implicit payload and deserializer
    private void writeMiddlewareDocumentBindingDeserializerDelegator(
            GenerationContext context,
            GoWriter writer,
            Shape shape,
            String operand
    ) {
        String functionName = ProtocolGenerator.getDocumentDeserializerFunctionName(
                shape, context.getService(), context.getProtocolName());

        writer.write("err = $L(&$L, shape)", functionName, operand);
        writer.openBlock("if err != nil {", "}", () -> {
            writer.addUseImports(SmithyGoDependency.BYTES);
            writer.addUseImports(SmithyGoDependency.SMITHY);
            writer.write("var snapshot bytes.Buffer");
            writer.write("io.Copy(&snapshot, ringBuffer)");
            writer.openBlock("return out, metadata, &smithy.DeserializationError {", "}", () -> {
                writer.write("Err: fmt.Errorf(\"failed to decode response body with invalid JSON, %w\", err),");
                writer.write("Snapshot: snapshot.Bytes(),");
            });
        });
    }

    @Override
    protected void generateOperationDocumentDeserializer(
            GenerationContext context,
            OperationShape operation
    ) {
        Model model = context.getModel();
        HttpBindingIndex bindingIndex = HttpBindingIndex.of(model);
        Set<MemberShape> documentBindings = bindingIndex.getResponseBindings(operation, HttpBinding.Location.DOCUMENT)
                .stream()
                .map(HttpBinding::getMember)
                .collect(Collectors.toSet());

        Shape outputShape = ProtocolUtils.expectOutput(model, operation);
        GoWriter writer = context.getWriter().get();

        if (documentBindings.size() != 0) {
            outputShape.accept(new JsonShapeDeserVisitor(context, documentBindings::contains));
        }

        Set<MemberShape> payloadBindings = bindingIndex.getResponseBindings(operation, HttpBinding.Location.PAYLOAD)
                .stream()
                .map(HttpBinding::getMember)
                .collect(Collectors.toSet());

        if (payloadBindings.size() == 0) {
            return;
        }

        writePayloadBindingDeserializer(context, outputShape, payloadBindings::contains);
        writer.write("");
    }

    @Override
    protected void writeErrorMessageCodeDeserializer(GenerationContext context) {
        writeJsonErrorMessageCodeDeserializer(context);
    }

    @Override
    protected void deserializeError(GenerationContext context, StructureShape shape) {
        GoWriter writer = context.getWriter().get();
        Symbol symbol = context.getSymbolProvider().toSymbol(shape);
        ServiceShape service = context.getService();

        writer.write("output := &$T{}", symbol);
        writer.insertTrailingNewline();

        // TODO: filter on error document body contains
        if (isShapeWithResponseBindings(context.getModel(), shape, Location.DOCUMENT)) {
            String documentDeserFunctionName = ProtocolGenerator.getDocumentDeserializerFunctionName(
                    shape, service, getProtocolName());
            initializeJsonDecoder(writer, "errorBody");
            AwsProtocolUtils.decodeJsonIntoInterface(writer, "");
            writer.write("err := $L(&output, shape)", documentDeserFunctionName);
            writer.write("");
            handleDecodeError(writer);
            writer.write("errorBody.Seek(0, io.SeekStart)");
            writer.write("");
        }

        if (isShapeWithRestResponseBindings(context.getModel(), shape)) {
            String bindingDeserFunctionName = ProtocolGenerator.getOperationHttpBindingsDeserFunctionName(
                    shape, service, getProtocolName());
            writer.openBlock("if err := $L(output, response); err != nil {", "}", bindingDeserFunctionName, () -> {
                writer.addUseImports(SmithyGoDependency.SMITHY);
                writer.write(String.format("return &smithy.DeserializationError{Err: %s}",
                        "fmt.Errorf(\"failed to decode response error with invalid HTTP bindings, %w\", err)"));
            });
            writer.write("");
        }

        writer.write("return output");
    }

    @Override
    protected void generateDocumentBodyShapeDeserializers(GenerationContext context, Set<Shape> shapes) {
        JsonShapeDeserVisitor visitor = new JsonShapeDeserVisitor(context);
        shapes.forEach(shape -> {
            if (generatedDocumentBodyShapeDeserializers.contains(shape.toShapeId())) {
                return;
            }
            shape.accept(visitor);
            generatedDocumentBodyShapeDeserializers.add(shape.toShapeId());
        });
    }

    // Generate deserializers for shapes with payload binding
    private void writePayloadBindingDeserializer(
            GenerationContext context,
            Shape shape,
            Predicate<MemberShape> filterMemberShapes
    ) {
        var writer = context.getWriter().get();
        var symbolProvider = context.getSymbolProvider();
        var shapeSymbol = symbolProvider.toSymbol(shape);
        var funcName = ProtocolGenerator.getDocumentDeserializerFunctionName(shape, context.getService(), getProtocolName());

        for (var memberShape : new TreeSet<>(shape.members())) {
            if (!filterMemberShapes.test(memberShape)) {
                continue;
            }

            var memberName = symbolProvider.toMemberName(memberShape);
            var targetShape = context.getModel().expectShape(memberShape.getTarget());
            if (targetShape.isStringShape() || targetShape.isBlobShape()) {
                writer.openBlock("func $L(v $P, body io.ReadCloser) error {", "}",
                        funcName, shapeSymbol, () -> {
                            writer.openBlock("if v == nil {", "}", () -> {
                                writer.write("return fmt.Errorf(\"unsupported deserialization of nil %T\", v)");
                            });
                            writer.write("");

                            if (!targetShape.hasTrait(StreamingTrait.class)) {
                                writer.addUseImports(SmithyGoDependency.IOUTIL);
                                writer.write("bs, err := ioutil.ReadAll(body)");
                                writer.write("if err != nil { return err }");
                                writer.openBlock("if len(bs) > 0 {", "}", () -> {
                                    if (targetShape.isBlobShape()) {
                                        writer.write("v.$L = bs", memberName);
                                    } else { // string
                                        writer.addUseImports(SmithyGoDependency.SMITHY_PTR);
                                        if (targetShape.hasTrait(EnumTrait.class)) {
                                            writer.write("v.$L = $T(bs)", memberName, symbolProvider.toSymbol(targetShape));
                                        } else {
                                            writer.write("v.$L = ptr.String(string(bs))", memberName);
                                        }
                                    }
                                });
                            } else {
                                writer.write("v.$L = body", memberName);
                            }

                            writer.write("return nil");
                        });
            } else {
                shape.accept(new JsonShapeDeserVisitor(context, filterMemberShapes));
            }
        }
    }

    @Override
    public void generateSharedDeserializerComponents(GenerationContext context) {
        super.generateSharedDeserializerComponents(context);
    }

    /*
    @Override
    public void generateProtocolTests(GenerationContext context) {
        AwsProtocolUtils.generateHttpProtocolTests(context);
    }
    */

    @Override
    public void generateProtocolDocumentMarshalerUnmarshalDocument(GenerationContext context) {
        JsonProtocolDocumentUtils.generateProtocolDocumentMarshalerUnmarshalDocument(context);
    }

    @Override
    public void generateProtocolDocumentMarshalerMarshalDocument(GenerationContext context) {
        JsonProtocolDocumentUtils.generateProtocolDocumentMarshalerMarshalDocument(context);
    }

    @Override
    public void generateProtocolDocumentUnmarshalerUnmarshalDocument(GenerationContext context) {
        JsonProtocolDocumentUtils.generateProtocolDocumentUnmarshalerUnmarshalDocument(context);
    }

    @Override
    public void generateProtocolDocumentUnmarshalerMarshalDocument(GenerationContext context) {
        JsonProtocolDocumentUtils.generateProtocolDocumentUnmarshalerMarshalDocument(context);
    }

    @Override
    public void generateEventStreamComponents(GenerationContext context) {
        AwsEventStreamUtils.generateEventStreamComponents(context);
    }

    @Override
    protected void writeOperationSerializerMiddlewareEventStreamSetup(GenerationContext context, EventStreamInfo info) {
        AwsEventStreamUtils.writeOperationSerializerMiddlewareEventStreamSetup(context, info);
    }

    @Override
    protected void generateEventStreamSerializers(
            GenerationContext context,
            UnionShape eventUnion,
            Set<EventStreamInfo> eventStreamInfos
    ) {
        Model model = context.getModel();

        AwsEventStreamUtils.generateEventStreamSerializer(context, eventUnion);
        var memberShapes = eventUnion.members().stream()
                .filter(ms -> ms.getMemberTrait(model, ErrorTrait.class).isEmpty())
                .collect(Collectors.toCollection(TreeSet::new));

        final var eventDocumentShapes = new TreeSet<Shape>();
        for (MemberShape member : memberShapes) {
            var targetShape = model.expectShape(member.getTarget());
            if (generatedEventMessageSerializers.contains(targetShape.toShapeId())) {
                continue;
            }

            AwsEventStreamUtils.generateEventMessageSerializer(context, targetShape, (ctx, payloadTarget, operand) -> {
                var functionName = ProtocolGenerator.getDocumentSerializerFunctionName(payloadTarget,
                        ctx.getService(), ctx.getProtocolName());
                AwsProtocolUtils.writeJsonEventMessageSerializerDelegator(ctx, functionName, operand,
                        getDocumentContentType());
            });

            generatedEventMessageSerializers.add(targetShape.toShapeId());

            var hasBindings = targetShape.members().stream()
                    .filter(ms -> ms.getTrait(EventHeaderTrait.class).isPresent()
                                  || ms.getTrait(EventPayloadTrait.class).isPresent())
                    .findAny();
            if (hasBindings.isPresent()) {
                var payload = targetShape.members().stream()
                        .filter(ms -> ms.getTrait(EventPayloadTrait.class).isPresent())
                        .map(ms -> model.expectShape(ms.getTarget()))
                        .filter(ProtocolUtils::requiresDocumentSerdeFunction)
                        .findAny();
                payload.ifPresent(eventDocumentShapes::add);
                continue;
            }
            eventDocumentShapes.add(targetShape);
        }

        eventDocumentShapes.addAll(ProtocolUtils.resolveRequiredDocumentShapeSerde(model, eventDocumentShapes));
        generateDocumentBodyShapeSerializers(context, eventDocumentShapes);
    }

    @Override
    protected void generateEventStreamDeserializers(
            GenerationContext context,
            UnionShape eventUnion,
            Set<EventStreamInfo> eventStreamInfos
    ) {
        var model = context.getModel();

        AwsEventStreamUtils.generateEventStreamDeserializer(context, eventUnion);
        AwsEventStreamUtils.generateEventStreamExceptionDeserializer(context, eventUnion,
                AwsProtocolUtils::writeJsonEventStreamUnknownExceptionDeserializer);

        final var eventDocumentShapes = new TreeSet<Shape>();

        for (MemberShape shape : eventUnion.members()) {
            var targetShape = model.expectShape(shape.getTarget());
            if (generatedEventMessageDeserializers.contains(targetShape.toShapeId())) {
                continue;
            }
            generatedEventMessageDeserializers.add(targetShape.toShapeId());
            if (shape.getMemberTrait(model, ErrorTrait.class).isPresent()) {
                AwsEventStreamUtils.generateEventMessageExceptionDeserializer(context, targetShape,
                        (ctx, payloadTarget) -> {
                            AwsProtocolUtils.initializeJsonEventMessageDeserializer(ctx);
                            var functionName = ProtocolGenerator.getDocumentDeserializerFunctionName(
                                    payloadTarget, ctx.getService(), getProtocolName());
                            var ctxWriter = ctx.getWriter().get();
                            ctxWriter.write("v := &$T{}", ctx.getSymbolProvider().toSymbol(payloadTarget))
                                    .openBlock("if err := $L(&v, shape); err != nil {", "}", functionName,
                                            () -> handleDecodeError(ctxWriter))
                                    .write("return v");
                        });

                eventDocumentShapes.add(targetShape);
            } else {
                AwsEventStreamUtils.generateEventMessageDeserializer(context, targetShape,
                        (ctx, payloadTarget, operand) -> {
                            AwsProtocolUtils.initializeJsonEventMessageDeserializer(ctx);
                            var functionName = ProtocolGenerator.getDocumentDeserializerFunctionName(
                                    payloadTarget, ctx.getService(), ctx.getProtocolName());
                            var ctxWriter = ctx.getWriter().get();
                            ctxWriter.openBlock("if err := $L(&$L, shape); err != nil {", "}", functionName, operand,
                                            () -> handleDecodeError(ctxWriter))
                                    .write("return nil");
                        });

                var hasBindings = targetShape.members().stream()
                        .filter(ms -> ms.getTrait(EventHeaderTrait.class).isPresent()
                                      || ms.getTrait(EventPayloadTrait.class).isPresent())
                        .findAny();
                if (hasBindings.isPresent()) {
                    var payload = targetShape.members().stream()
                            .filter(ms -> ms.getTrait(EventPayloadTrait.class).isPresent())
                            .map(ms -> model.expectShape(ms.getTarget()))
                            .filter(ProtocolUtils::requiresDocumentSerdeFunction)
                            .findAny();
                    payload.ifPresent(eventDocumentShapes::add);
                    continue;
                }
                eventDocumentShapes.add(targetShape);
            }
        }

        eventDocumentShapes.addAll(ProtocolUtils.resolveRequiredDocumentShapeSerde(model, eventDocumentShapes));
        generateDocumentBodyShapeDeserializers(context, eventDocumentShapes);
    }
}
