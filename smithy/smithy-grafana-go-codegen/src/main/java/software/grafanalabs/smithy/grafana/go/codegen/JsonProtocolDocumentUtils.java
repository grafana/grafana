package software.grafanalabs.smithy.grafana.go.codegen;

import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.ProtocolDocumentGenerator;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.SymbolUtils;
import software.amazon.smithy.go.codegen.integration.ProtocolGenerator;

public final class JsonProtocolDocumentUtils {
    public static void generateProtocolDocumentMarshalerUnmarshalDocument(ProtocolGenerator.GenerationContext context) {
        GoWriter writer = context.getWriter().get();

        writer.write("mBytes, err := m.$L()", ProtocolDocumentGenerator.MARSHAL_SMITHY_DOCUMENT_METHOD);
        writer.write("if err != nil { return err }").write("");
        writer.write("jDecoder := $T($T(mBytes))", SymbolUtils.createValueSymbolBuilder("NewDecoder",
                SmithyGoDependency.JSON).build(), SymbolUtils.createValueSymbolBuilder("NewReader",
                SmithyGoDependency.BYTES).build());
        writer.write("jDecoder.UseNumber()").write("");

        writer.write("var jv interface{}");
        writer.openBlock("if err := jDecoder.Decode(&v); err != nil {", "}", () -> writer.write("return err"))
                .write("");

        Symbol newUnmarshaler = ProtocolDocumentGenerator.Utilities.getInternalDocumentSymbolBuilder(
                context.getSettings(), ProtocolDocumentGenerator.INTERNAL_NEW_DOCUMENT_UNMARSHALER_FUNC)
                .build();

        writer.write("return $T(v).$L(&jv)", newUnmarshaler,
                ProtocolDocumentGenerator.UNMARSHAL_SMITHY_DOCUMENT_METHOD);
    }

    public static void generateProtocolDocumentMarshalerMarshalDocument(ProtocolGenerator.GenerationContext context) {
        GoWriter writer = context.getWriter().get();

        Symbol newEncoder = SymbolUtils.createValueSymbolBuilder("NewEncoder", SmithyGoDependency.SMITHY_DOCUMENT_JSON)
                .build();

        writer.write("return $T().Encode(m.value)", newEncoder);
    }

    public static void generateProtocolDocumentUnmarshalerUnmarshalDocument(
            ProtocolGenerator.GenerationContext context
    ) {
        GoWriter writer = context.getWriter().get();

        Symbol newDecoder = SymbolUtils.createValueSymbolBuilder("NewDecoder", SmithyGoDependency.SMITHY_DOCUMENT_JSON)
                .build();

        writer.write("decoder := $T()", newDecoder);
        writer.write("return decoder.DecodeJSONInterface(m.value, v)");
    }

    public static void generateProtocolDocumentUnmarshalerMarshalDocument(
            ProtocolGenerator.GenerationContext context
    ) {
        GoWriter writer = context.getWriter().get();
        writer.write("return $T(m.value)",
                SymbolUtils.createValueSymbolBuilder("Marshal", SmithyGoDependency.JSON).build());
    }
}
