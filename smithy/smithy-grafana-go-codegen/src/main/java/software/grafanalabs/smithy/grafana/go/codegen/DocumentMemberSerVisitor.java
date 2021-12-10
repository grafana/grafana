package software.grafanalabs.smithy.grafana.go.codegen;

import software.amazon.smithy.codegen.core.CodegenException;
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
 * Visitor to generate member values for aggregate types serialized in documents.
 */
public class DocumentMemberSerVisitor implements ShapeVisitor<Void> {
    private final GenerationContext context;
    private final String dataSource;
    private final String dataDest;
    private final Format timestampFormat;
    private final MemberShape member;
    private final GoPointableIndex pointableIndex;

    public DocumentMemberSerVisitor(
            GenerationContext context,
            MemberShape member,
            String dataSource,
            String dataDest,
            Format timestampFormat
    ) {
        this.context = context;
        this.member = member;
        this.dataSource = dataSource;
        this.dataDest = dataDest;
        this.timestampFormat = timestampFormat;
        this.pointableIndex = GoPointableIndex.of(context.getModel());
    }

    @Override
    public Void blobShape(BlobShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        context.getWriter().get().write("$L.Base64EncodeBytes($L)", dataDest, source);
        return null;
    }

    @Override
    public Void booleanShape(BooleanShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        context.getWriter().get().write("$L.Boolean($L)", dataDest, source);
        return null;
    }

    @Override
    public Void byteShape(ByteShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        context.getWriter().get().write("$L.Byte($L)", dataDest, source);
        return null;
    }

    @Override
    public Void shortShape(ShortShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        context.getWriter().get().write("$L.Short($L)", dataDest, source);
        return null;
    }

    @Override
    public Void integerShape(IntegerShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        context.getWriter().get().write("$L.Integer($L)", dataDest, source);
        return null;
    }

    @Override
    public Void longShape(LongShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        context.getWriter().get().write("$L.Long($L)", dataDest, source);
        return null;
    }

    @Override
    public Void floatShape(FloatShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        GoWriter writer = context.getWriter().get();
        handleDecimal(writer, dataDest, "float64(" + source + ")",
                () -> writer.write("$L.Float($L)", dataDest, source));
        return null;
    }

    @Override
    public Void doubleShape(DoubleShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        GoWriter writer = context.getWriter().get();
        handleDecimal(writer, dataDest, source, () -> writer.write("$L.Double($L)", dataDest, source));
        return null;
    }

    private void handleDecimal(GoWriter writer, String dataDest, String source, Runnable defaultCase) {
        writer.addUseImports(SmithyGoDependency.MATH);
        writer.openBlock("switch {", "}", () -> {
            writer.openBlock("case math.IsNaN($L):", "", source, () -> {
                writer.write("$L.String(\"NaN\")", dataDest);
            });
            writer.openBlock("case math.IsInf($L, 1):", "", source, () -> {
                writer.write("$L.String(\"Infinity\")", dataDest);
            });
            writer.openBlock("case math.IsInf($L, -1):", "", source, () -> {
                writer.write("$L.String(\"-Infinity\")", dataDest);
            });
            writer.openBlock("default:", "", defaultCase);
        });
    }

    @Override
    public Void timestampShape(TimestampShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        GoWriter writer = context.getWriter().get();
        writer.addUseImports(SmithyGoDependency.SMITHY_TIME);

        switch (timestampFormat) {
            case DATE_TIME:
                writer.write("$L.String(smithytime.FormatDateTime($L))", dataDest, source);
                break;
            case HTTP_DATE:
                writer.write("$L.String(smithytime.FormatHTTPDate($L))", dataDest, source);
                break;
            case EPOCH_SECONDS:
                writer.write("$L.Double(smithytime.FormatEpochSeconds($L))", dataDest, source);
                break;
            case UNKNOWN:
                throw new CodegenException("Unknown timestamp format");
        }
        return null;
    }

    @Override
    public Void stringShape(StringShape shape) {
        String source = CodegenUtils.getAsValueIfDereferencable(pointableIndex, member, dataSource);
        if (shape.hasTrait(EnumTrait.class)) {
            source = String.format("string(%s)", source);
        }
        context.getWriter().get().write("$L.String($L)", dataDest, source);
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

    private void unsupportedShape(Shape shape) {
        throw new CodegenException(String.format("Cannot serialize shape type %s on protocol, shape: %s.",
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
        writeDelegateFunction(shape);
        return null;
    }

    @Override
    public Void setShape(SetShape shape) {
        writeDelegateFunction(shape);
        return null;
    }

    @Override
    public Void mapShape(MapShape shape) {
        writeDelegateFunction(shape);
        return null;
    }

    private void writeDelegateFunction(Shape shape) {
        String serFunctionName = ProtocolGenerator.getDocumentSerializerFunctionName(shape, context.getService(), context.getProtocolName());
        GoWriter writer = context.getWriter().get();

        ProtocolUtils.writeSerDelegateFunction(context, writer, member, dataSource, (srcVar) -> {
            writer.openBlock("if err := $L($L, $L); err != nil {", "}", serFunctionName, srcVar, dataDest,
                    () -> writer.write("return err"));
        });
    }
}
