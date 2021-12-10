package software.grafanalabs.smithy.grafana.go.codegen;

import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.go.codegen.CodegenUtils;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.go.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.go.codegen.integration.ProtocolUtils;
import software.amazon.smithy.go.codegen.knowledge.GoPointableIndex;
import software.amazon.smithy.model.shapes.BigDecimalShape;
import software.amazon.smithy.model.shapes.BigIntegerShape;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.ByteShape;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.DoubleShape;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.IntegerShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.LongShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ResourceShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.ShortShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;

/**
 * Visitor to generate member values for aggregate types deserialized from documents.
 */
public class JsonMemberDeserVisitor implements ShapeVisitor<Void> {
    private final GenerationContext context;
    private final MemberShape member;
    private final String dataDest;
    private final Format timestampFormat;
    private final GoPointableIndex pointableIndex;

    public JsonMemberDeserVisitor(
            GenerationContext context,
            MemberShape member,
            String dataDest,
            Format timestampFormat
    ) {
        this.context = context;
        this.member = member;
        this.dataDest = dataDest;
        this.timestampFormat = timestampFormat;
        this.pointableIndex = GoPointableIndex.of(context.getModel());
    }

    @Override
    public Void blobShape(BlobShape shape) {
        GoWriter writer = context.getWriter().get();
        ServiceShape service = context.getService();
        writer.addUseImports(SmithyGoDependency.FMT);
        writer.addUseImports(SmithyGoDependency.BASE64);
        final String typeError = "return fmt.Errorf(\"expected $L to be []byte, got %T instead\", value)";

        writer.openBlock("if value != nil {", "}", () -> {
            writer.write("jtv, ok := value.(string)");
            writer.openBlock("if !ok {", "}", () -> {
                writer.write(typeError, shape.getId().getName(service));
            });

            writer.write("dv, err := base64.StdEncoding.DecodeString(jtv)");
            writer.openBlock("if err != nil {", "}", () -> {
                writer.write("return fmt.Errorf(\"failed to base64 decode $L, %w\", err)",
                        shape.getId().getName(service));
            });

            writer.write("$L = $L", dataDest, CodegenUtils.getAsPointerIfPointable(context.getModel(),
                    context.getWriter().get(), pointableIndex, member, "dv"));
        });
        return null;
    }

    @Override
    public Void booleanShape(BooleanShape shape) {
        GoWriter writer = context.getWriter().get();
        ServiceShape service = context.getService();
        writer.addUseImports(SmithyGoDependency.FMT);
        writer.openBlock("if value != nil {", "}", () -> {
            writer.write("jtv, ok := value.(bool)");
            writer.openBlock("if !ok {", "}", () -> {
                writer.write("return fmt.Errorf(\"expected $L to be of type *bool, got %T instead\", value)",
                        shape.getId().getName(service));
            });
            writer.write("$L = $L", dataDest, CodegenUtils.getAsPointerIfPointable(context.getModel(),
                    writer, pointableIndex, member, "jtv"));
        });
        return null;
    }

    @Override
    public Void byteShape(ByteShape shape) {
        GoWriter writer = context.getWriter().get();
        // Smithy's byte shape represents a signed 8-bit int, which doesn't line up with Go's unsigned byte
        handleInteger(shape, CodegenUtils.getAsPointerIfPointable(context.getModel(), writer,
                pointableIndex, member, "int8(i64)"));
        return null;
    }

    @Override
    public Void shortShape(ShortShape shape) {
        GoWriter writer = context.getWriter().get();
        handleInteger(shape, CodegenUtils.getAsPointerIfPointable(context.getModel(), writer,
                pointableIndex, member, "int16(i64)"));
        return null;
    }

    @Override
    public Void integerShape(IntegerShape shape) {
        GoWriter writer = context.getWriter().get();
        handleInteger(shape, CodegenUtils.getAsPointerIfPointable(context.getModel(), writer,
                pointableIndex, member, "int32(i64)"));
        return null;
    }

    @Override
    public Void longShape(LongShape shape) {
        handleInteger(shape, CodegenUtils.getAsPointerIfPointable(context.getModel(), context.getWriter().get(),
                pointableIndex, member, "i64"));
        return null;
    }

    /**
     * Deserializes a number without a fractional value.
     * <p>
     * The 64-bit integer representation of the number is stored in the variable {@code i64}.
     *
     * @param shape The shape being deserialized.
     * @param cast  A wrapping of {@code i64} to cast it to the proper type.
     */
    private void handleInteger(Shape shape, String cast) {
        GoWriter writer = context.getWriter().get();
        handleNumber(shape, () -> {
            writer.write("i64, err := jtv.Int64()");
            writer.write("if err != nil { return err }");
            writer.write("$L = $L", dataDest, cast);
        });
    }

    /**
     * Deserializes a json number into a json token.
     * <p>
     * The number token is stored under the variable {@code jtv}.
     *
     * @param shape The shape being deserialized.
     * @param r     A runnable that runs after the value has been parsed, before the scope closes.
     */
    private void handleNumber(Shape shape, Runnable r) {
        GoWriter writer = context.getWriter().get();
        ServiceShape service = context.getService();

        writer.addUseImports(SmithyGoDependency.FMT);
        writer.openBlock("if value != nil {", "}", () -> {
            writer.write("jtv, ok := value.(json.Number)");
            writer.openBlock("if !ok {", "}", () -> {
                writer.write("return fmt.Errorf(\"expected $L to be json.Number, got %T instead\", value)",
                        shape.getId().getName(service));
            });
            r.run();
        });
    }

    /**
     * Deserializes a json arbitrary precision number into a json token.
     * <p>
     * The number token is stored under the variable {@code jtv}.
     *
     * @param shape      The shape being deserialized.
     * @param jsonNumber A runnable that runs after the value has been parsed to a json.Number, before the scope closes.
     * @param jsonString A runnable that runs after the value has been parsed to a string, before the scope closes.
     */
    private void handleDecimal(Shape shape, Runnable jsonNumber, Runnable jsonString) {
        GoWriter writer = context.getWriter().get();
        ServiceShape service = context.getService();

        writer.addUseImports(SmithyGoDependency.FMT);
        writer.openBlock("if value != nil {", "}", () -> {
            writer.openBlock("switch jtv := value.(type) {", "}", () -> {
                writer.openBlock("case json.Number:", "", jsonNumber);
                if (jsonString != null) {
                    writer.openBlock("case string:", "", jsonString);
                }
                writer.openBlock("default:", "", () -> {
                    writer.write("return fmt.Errorf(\"expected $L to be a JSON Number, got %T instead\", value)",
                            shape.getId().getName(service));
                });
            });
        });
    }

    @Override
    public Void floatShape(FloatShape shape) {
        handleFloat(shape, CodegenUtils.getAsPointerIfPointable(context.getModel(), context.getWriter().get(),
                pointableIndex, member, "float32(f64)"), true);
        return null;
    }

    @Override
    public Void doubleShape(DoubleShape shape) {
        handleFloat(shape, CodegenUtils.getAsPointerIfPointable(context.getModel(), context.getWriter().get(),
                pointableIndex, member, "f64"), true);
        return null;
    }

    /**
     * Deserializes a number with a fractional value.
     * <p>
     * The 64-bit float representation of the number is stored in the variable {@code f64}.
     *
     * @param shape The shape being deserialized.
     * @param cast  A wrapping of {@code f64} to cast it to the proper type.
     */
    private void handleFloat(Shape shape, String cast, boolean handleNonNumbers) {
        GoWriter writer = context.getWriter().get();

        Runnable jsonString = null;

        if (handleNonNumbers) {
            jsonString = () -> {
                writer.addUseImports(SmithyGoDependency.STRINGS);
                writer.addUseImports(SmithyGoDependency.MATH);

                writer.write("var f64 float64");
                writer.openBlock("switch {", "}", () -> {
                    writer.openBlock("case strings.EqualFold(jtv, \"NaN\"):", "", () -> {
                        writer.write("f64 = math.NaN()");
                    });
                    writer.openBlock("case strings.EqualFold(jtv, \"Infinity\"):", "", () -> {
                        writer.write("f64 = math.Inf(1)");
                    });
                    writer.openBlock("case strings.EqualFold(jtv, \"-Infinity\"):", "", () -> {
                        writer.write("f64 = math.Inf(-1)");
                    });
                    writer.openBlock("default:", "", () -> {
                        writer.addUseImports(SmithyGoDependency.FMT);
                        writer.write("return fmt.Errorf(\"unknown JSON number value: %s\", jtv)");
                    });
                });
                writer.write("$L = $L", dataDest, cast);
            };
        }

        handleDecimal(shape, () -> {
            writer.write("f64, err := jtv.Float64()");
            writer.write("if err != nil { return err }");
            writer.write("$L = $L", dataDest, cast);
        }, jsonString);
    }

    @Override
    public Void stringShape(StringShape shape) {
        GoWriter writer = context.getWriter().get();
        Symbol symbol = context.getSymbolProvider().toSymbol(shape);

        if (shape.hasTrait(EnumTrait.class)) {
            handleString(shape, () -> writer.write("$L = $P(jtv)", dataDest, symbol));
        } else {
            handleString(shape, () -> writer.write("$L = $L", dataDest, CodegenUtils.getAsPointerIfPointable(
                    context.getModel(), context.getWriter().get(), pointableIndex, member, "jtv")));
        }

        return null;
    }

    /**
     * Deserializes a json string into a json token.
     * <p>
     * The number token is stored under the variable {@code jtv}.
     *
     * @param shape The shape being deserialized.
     * @param r     A runnable that runs after the value has been parsed, before the scope closes.
     */
    private void handleString(Shape shape, Runnable r) {
        GoWriter writer = context.getWriter().get();
        ServiceShape service = context.getService();
        writer.addUseImports(SmithyGoDependency.FMT);

        writer.openBlock("if value != nil {", "}", () -> {
            writer.write("jtv, ok := value.(string)");
            writer.openBlock("if !ok {", "}", () -> {
                writer.write("return fmt.Errorf(\"expected $L to be of type string, got %T instead\", value)",
                        shape.getId().getName(service));
            });
            r.run();
        });
    }

    @Override
    public Void timestampShape(TimestampShape shape) {
        GoWriter writer = context.getWriter().get();
        writer.addUseImports(SmithyGoDependency.SMITHY_TIME);

        switch (timestampFormat) {
            case DATE_TIME:
                handleString(shape, () -> {
                    writer.write("t, err := smithytime.ParseDateTime(jtv)");
                    writer.write("if err != nil { return err }");
                    writer.write("$L = $L", dataDest, CodegenUtils.getAsPointerIfPointable(context.getModel(),
                            context.getWriter().get(), pointableIndex, member, "t"));
                });
                break;
            case HTTP_DATE:
                handleString(shape, () -> {
                    writer.write("t, err := smithytime.ParseHTTPDate(jtv)");
                    writer.write("if err != nil { return err }");
                    writer.write("$L = $L", dataDest, CodegenUtils.getAsPointerIfPointable(context.getModel(),
                            context.getWriter().get(), pointableIndex, member, "t"));
                });
                break;
            case EPOCH_SECONDS:
                writer.addUseImports(SmithyGoDependency.SMITHY_PTR);
                handleFloat(shape, CodegenUtils.getAsPointerIfPointable(context.getModel(), context.getWriter().get(),
                        pointableIndex, member, "smithytime.ParseEpochSeconds(f64)"), false);
                break;
            default:
                throw new CodegenException(String.format("Unknown timestamp format %s", timestampFormat));
        }
        return null;
    }

    @Override
    public Void bigIntegerShape(BigIntegerShape shape) {
        // Fail instead of losing precision through Number.
        unsupportedShape(shape);
        return null;
    }

    @Override
    public Void bigDecimalShape(BigDecimalShape shape) {
        // Fail instead of losing precision through Number.
        unsupportedShape(shape);
        return null;
    }

    private String unsupportedShape(Shape shape) {
        throw new CodegenException(String.format("Cannot deserialize shape type %s on protocol, shape: %s.",
                shape.getType(), shape.getId()));
    }

    @Override
    public Void operationShape(OperationShape shape) {
        throw new CodegenException("Operation shapes cannot be bound to documents.");
    }

    @Override
    public Void resourceShape(ResourceShape shape) {
        throw new CodegenException("Resource shapes cannot be bound to documents.");
    }

    @Override
    public Void serviceShape(ServiceShape shape) {
        throw new CodegenException("Service shapes cannot be bound to documents.");
    }

    @Override
    public Void memberShape(MemberShape shape) {
        throw new CodegenException("Member shapes cannot be bound to documents.");
    }

    @Override
    public Void documentShape(DocumentShape shape) {
        writeDelegateFunction(shape);
        return null;
    }

    @Override
    public Void structureShape(StructureShape shape) {
        writeDelegateFunction(shape);
        return null;
    }

    @Override
    public Void unionShape(UnionShape shape) {
        writeDelegateFunction(shape);
        return null;
    }

    @Override
    public Void listShape(ListShape shape) {
        return collectionShape(shape);
    }

    @Override
    public Void setShape(SetShape shape) {
        return collectionShape(shape);
    }

    private Void collectionShape(CollectionShape shape) {
        writeDelegateFunction(shape);
        return null;
    }

    @Override
    public Void mapShape(MapShape shape) {
        writeDelegateFunction(shape);
        return null;
    }

    private void writeDelegateFunction(Shape shape) {
        String functionName = ProtocolGenerator.getDocumentDeserializerFunctionName(shape, context.getService(), context.getProtocolName());
        GoWriter writer = context.getWriter().get();

        ProtocolUtils.writeDeserDelegateFunction(context, writer, member, dataDest, (destVar) -> {
            writer.openBlock("if err := $L(&$L, value); err != nil {", "}", functionName, destVar, () -> {
                writer.write("return err");
            });
        });
    }
}
