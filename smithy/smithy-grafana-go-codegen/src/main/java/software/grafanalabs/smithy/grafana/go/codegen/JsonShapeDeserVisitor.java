package software.grafanalabs.smithy.grafana.go.codegen;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;
import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.ProtocolDocumentGenerator;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.SymbolUtils;
import software.amazon.smithy.go.codegen.UnionGenerator;
import software.amazon.smithy.go.codegen.integration.DocumentShapeDeserVisitor;
import software.amazon.smithy.go.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.JsonNameTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.utils.FunctionalUtils;

/**
 * Visitor to generate deserialization functions for shapes in AWS JSON protocol
 * document bodies.
 * <p>
 * This class handles function body generation for all types expected by the
 * {@code DocumentShapeDeserVisitor}. No other shape type serialization is overwritten.
 * <p>
 * Timestamps are serialized to {@link Format}.EPOCH_SECONDS by default.
 */
public class JsonShapeDeserVisitor extends DocumentShapeDeserVisitor {
    private static final Format DEFAULT_TIMESTAMP_FORMAT = Format.EPOCH_SECONDS;
    private static final Logger LOGGER = Logger.getLogger(JsonShapeDeserVisitor.class.getName());

    private final Predicate<MemberShape> memberFilter;

    /**
     * @param context The generation context.
     */
    public JsonShapeDeserVisitor(GenerationContext context) {
        this(context, FunctionalUtils.alwaysTrue(), null);
    }

    /**
     * @param context      The generation context.
     * @param memberFilter A filter that is applied to structure members. This is useful for
     *                     members that won't be in the body.
     */
    public JsonShapeDeserVisitor(GenerationContext context, Predicate<MemberShape> memberFilter) {
        this(context, memberFilter, null);
    }

    /**
     * @param context                  The generation context.
     * @param memberFilter             A filter that is applied to structure members. This is useful for
     *                                 members that won't be in the body.
     * @param deserializerNameProvider The deserializer name provider.
     */
    public JsonShapeDeserVisitor(
            GenerationContext context,
            Predicate<MemberShape> memberFilter,
            DeserializerNameProvider deserializerNameProvider
    ) {
        super(context, deserializerNameProvider);
        this.memberFilter = memberFilter;
    }

    private JsonMemberDeserVisitor getMemberDeserVisitor(MemberShape member, String dataDest) {
        // Get the timestamp format to be used, defaulting to epoch seconds.
        Format format = member.getMemberTrait(getContext().getModel(), TimestampFormatTrait.class)
                .map(TimestampFormatTrait::getFormat).orElse(DEFAULT_TIMESTAMP_FORMAT);
        return new JsonMemberDeserVisitor(getContext(), member, dataDest, format);
    }

    @Override
    protected Map<String, String> getAdditionalArguments() {
        return Collections.singletonMap("value", "interface{}");
    }

    @Override
    protected void deserializeCollection(GenerationContext context, CollectionShape shape) {
        GoWriter writer = context.getWriter().get();
        MemberShape member = shape.getMember();
        Shape target = context.getModel().expectShape(member.getTarget());
        writeJsonTypeAssertStub(writer, shape);
        Symbol symbol = context.getSymbolProvider().toSymbol(shape);

        // Initialize the value now that the start stub has verified that there's something there.
        writer.write("var cv $P", symbol);
        writer.openBlock("if *v == nil {", "", () -> {
            writer.write("cv = $P{}", symbol);
            writer.openBlock("} else {", "}", () -> {
                writer.write("cv = *v");
            });
        });

        // Iterate through the decoder. The member visitor will handle popping tokens.
        writer.openBlock("for _, value := range shape {", "}", () -> {
            // We need to write out an intermediate variable to assign the value of the
            // member to so that we can use it in the append function later.
            writer.write("var col $P", context.getSymbolProvider().toSymbol(member));
            target.accept(getMemberDeserVisitor(member, "col"));
            writer.write("cv = append(cv, col)");
            writer.write("");
        });

        writer.write("*v = cv");
        writer.write("return nil");
    }

    @Override
    protected void deserializeDocument(GenerationContext context, DocumentShape shape) {
        GoWriter writer = context.getWriter().get();

        Symbol newUnmarshaler = ProtocolDocumentGenerator.Utilities.getInternalDocumentSymbolBuilder(
                        context.getSettings(), ProtocolDocumentGenerator.INTERNAL_NEW_DOCUMENT_UNMARSHALER_FUNC)
                .build();

        writer.write("*v = $T(value)", newUnmarshaler);

        writer.write("return nil");
    }

    @Override
    protected void deserializeMap(GenerationContext context, MapShape shape) {
        GoWriter writer = context.getWriter().get();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(shape);
        MemberShape member = shape.getValue();
        Symbol targetSymbol = symbolProvider.toSymbol(member);
        writeJsonTypeAssertStub(writer, shape);

        // Initialize the value now that the start stub has verified that there's something there.
        writer.write("var mv $P", symbol);
        writer.openBlock("if *v == nil {", "", () -> {
            writer.write("mv = $P{}", symbol);
            writer.openBlock("} else {", "}", () -> {
                writer.write("mv = *v");
            });
        });

        // Iterate through the decoder. The member visitor will handle popping tokens.
        writer.openBlock("for key, value := range shape {", "}", () -> {
            // Deserialize the value. We need to write out an intermediate variable here
            // since we can't just pass in &mv[key]
            writer.write("var parsedVal $P", context.getSymbolProvider().toSymbol(member));
            context.getModel().expectShape(member.getTarget()).accept(getMemberDeserVisitor(member, "parsedVal"));
            writer.write("mv[key] = parsedVal");
            writer.write("");
        });

        writer.write("*v = mv");
        writer.write("return nil");
    }

    @Override
    protected void deserializeStructure(GenerationContext context, StructureShape shape) {
        GoWriter writer = context.getWriter().get();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(shape);

        writeJsonTypeAssertStub(writer, shape);

        // Initialize the value now that the start stub has verified that there's something there.
        writer.write("var sv $P", symbol);
        writer.openBlock("if *v == nil {", "", () -> {
            writer.write("sv = &$T{}", symbol);
            writer.openBlock("} else {", "}", () -> {
                writer.write("sv = *v");
            });
        });

        // Iterate through the decoder. The member visitor will handle popping tokens.
        writer.openBlock("for key, value := range shape {", "}", () -> {
            writer.openBlock("switch key {", "}", () -> {
                Set<MemberShape> members = new TreeSet<>(shape.members());
                for (MemberShape member : members) {
                    if (!memberFilter.test(member)) {
                        continue;
                    }
                    String memberName = symbolProvider.toMemberName(member);
                    String serializedMemberName = getSerializedMemberName(member);
                    writer.openBlock("case $S:", "", serializedMemberName, () -> {
                        String dest = "sv." + memberName;
                        context.getModel().expectShape(member.getTarget()).accept(getMemberDeserVisitor(member, dest));
                    });
                }

                writer.openBlock("default:", "", () -> {
                    writer.write("_, _ = key, value");
                });
            });
        });

        writer.write("*v = sv");
        writer.write("return nil");
    }

    @Override
    protected void deserializeUnion(GenerationContext context, UnionShape shape) {
        GoWriter writer = context.getWriter().get();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(shape);
        writeJsonTypeAssertStub(writer, shape);

        writer.write("var uv $P", symbol);

        writer.openBlock("loop: for key, value := range shape {", "}", () -> {
            writer.openBlock("if value == nil {", "}", () -> writer.write("continue"));
            writer.openBlock("switch key {", "}", () -> {
                Set<MemberShape> members = new TreeSet<>(shape.members());
                for (MemberShape member : members) {
                    if (!memberFilter.test(member)) {
                        continue;
                    }

                    Shape target = context.getModel().expectShape(member.getTarget());
                    Symbol targetSymbol = symbolProvider.toSymbol(member);

                    Symbol memberSymbol = SymbolUtils.createValueSymbolBuilder(
                            symbolProvider.toMemberName(member),
                            symbol.getNamespace()
                    ).build();

                    writer.openBlock("case $S:", "", member.getMemberName(), () -> {
                        writer.write("var mv $P", targetSymbol);
                        target.accept(getMemberDeserVisitor(member, "mv"));

                        // Union member types are never pointer types.
                        writer.write("uv = &$T{Value: mv}", memberSymbol);
                        writer.write("break loop");
                    });
                }

                writer.openBlock("default:", "", () -> {
                    // This is the function to take a value and convert it to the union type.
                    Symbol unknownMemberSymbol = SymbolUtils.createValueSymbolBuilder(
                            UnionGenerator.UNKNOWN_MEMBER_NAME,
                            symbol.getNamespace()
                    ).build();
                    writer.write("uv = &$T{Tag: key}", unknownMemberSymbol);
                    writer.write("break loop");
                });
            });
        });

        writer.write("*v = uv");
        writer.write("return nil");
    }

    private String getSerializedMemberName(MemberShape memberShape) {
        Optional<JsonNameTrait> jsonNameTrait = memberShape.getTrait(JsonNameTrait.class);
        return jsonNameTrait.isPresent() ? jsonNameTrait.get().getValue() : memberShape.getMemberName();
    }

    /**
     * Writes out a stub to initialize decoding.
     *
     * @param writer The GoWriter to use.
     * @param shape  The shape the stub is intended to start parsing.
     */
    private void writeJsonTypeAssertStub(GoWriter writer, Shape shape) {
        writer.openBlock("if value == nil {", "}", () -> writer.write("return nil"));
        writer.write("");
        writer.addUseImports(SmithyGoDependency.FMT);
        String targetType;
        if (shape instanceof CollectionShape) {
            targetType = "[]interface{}";
        } else if (shape instanceof StructureShape || shape instanceof MapShape || shape instanceof UnionShape) {
            targetType = "map[string]interface{}";
        } else {
            throw new CodegenException("unimplemented JSON type " + shape);
        }
        writer.write("shape, ok := value.($L)", targetType);
        writer.openBlock("if !ok {", "}", () -> writer.write("return fmt.Errorf(\"unexpected JSON type %v\", value)"));
        writer.write("");
    }
}
