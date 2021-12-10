package software.grafanalabs.smithy.grafana.go.codegen;

import java.util.List;
import java.util.Map;
import software.amazon.smithy.aws.traits.auth.SigV4Trait;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.go.codegen.GoDelegator;
import software.amazon.smithy.go.codegen.GoSettings;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.SymbolUtils;
import software.amazon.smithy.go.codegen.integration.ConfigField;
import software.amazon.smithy.go.codegen.integration.ConfigFieldResolver;
import software.amazon.smithy.go.codegen.integration.GoIntegration;
import software.amazon.smithy.go.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.OptionalAuthTrait;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.utils.ListUtils;

/**
 * Generates Client Configuration, Middleware, and Config Resolvers for AWS Signature Version 4 support.
 */
public final class AwsSignatureVersion4 implements GoIntegration {
    public static final String REGISTER_MIDDLEWARE_FUNCTION = "addHTTPSignerV4Middleware";
    public static final String SIGNER_INTERFACE_NAME = "HTTPSignerV4";
    public static final String SIGNER_CONFIG_FIELD_NAME = SIGNER_INTERFACE_NAME;
    public static final String NEW_SIGNER_FUNC_NAME = "newDefaultV4Signer";
    public static final String NEW_SIGNER_V4A_FUNC_NAME = "newDefaultV4aSigner";
    public static final String SIGNER_RESOLVER = "resolve" + SIGNER_CONFIG_FIELD_NAME;

    private static final List<String> DISABLE_URI_PATH_ESCAPE = ListUtils.of("com.amazonaws.s3#AmazonS3");

    @Override
    public byte getOrder() {
        return -48;
    }

    @Override
    public void writeAdditionalFiles(
            GoSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            GoDelegator goDelegator
    ) {
        ServiceShape serviceShape = settings.getService(model);
        if (isSupportedAuthentication(model, serviceShape)) {
            goDelegator.useShapeWriter(serviceShape, writer -> {
                writeMiddlewareRegister(model, writer, serviceShape);
                writerSignerInterface(writer);
                writerConfigFieldResolver(writer, serviceShape);
                writeNewV4SignerFunc(writer, serviceShape);
            });
        }
    }

    private void writerSignerInterface(GoWriter writer) {
        writer.openBlock("type $L interface {", "}", SIGNER_INTERFACE_NAME, () -> {
            writer.addUseImports(SmithyGoDependency.CONTEXT);
            writer.addUseImports(SdkGoDependency.CORE);
            writer.addUseImports(SdkGoDependency.SIGNER_V4);
            writer.addUseImports(SmithyGoDependency.NET_HTTP);
            writer.addUseImports(SmithyGoDependency.TIME);
            writer.write("SignHTTP(ctx context.Context, credentials aws.Credentials, r *http.Request, "
                    + "payloadHash string, service string, region string, signingTime time.Time, "
                    + "optFns ...func(*v4.SignerOptions)) error");
        });
    }

    private void writerConfigFieldResolver(GoWriter writer, ServiceShape serviceShape) {
        writer.openBlock("func $L(o *Options) {", "}", SIGNER_RESOLVER, () -> {
            writer.openBlock("if o.$L != nil {", "}", SIGNER_CONFIG_FIELD_NAME, () -> writer.write("return"));
            writer.write("o.$L = $L(*o)", SIGNER_CONFIG_FIELD_NAME, NEW_SIGNER_FUNC_NAME);
        });
        writer.write("");
    }

    private void writeNewV4SignerFunc(GoWriter writer, ServiceShape serviceShape) {
        Symbol signerSymbol = SymbolUtils.createValueSymbolBuilder("Signer",
                SdkGoDependency.SIGNER_V4).build();
        Symbol newSignerSymbol = SymbolUtils.createValueSymbolBuilder("NewSigner",
                SdkGoDependency.SIGNER_V4).build();
        Symbol signerOptionsSymbol = SymbolUtils.createPointableSymbolBuilder("SignerOptions",
                SdkGoDependency.SIGNER_V4).build();

        writer.openBlock("func $L(o Options) *$T {", "}", NEW_SIGNER_FUNC_NAME, signerSymbol, () -> {
            writer.openBlock("return $T(func(so $P) {", "})", newSignerSymbol, signerOptionsSymbol, () -> {
                writer.write("so.Logger = o.$L", AddAwsConfigFields.LOGGER_CONFIG_NAME);
                writer.write("so.LogSigning = o.$L.IsSigning()", AddAwsConfigFields.LOG_MODE_CONFIG_NAME);
                if (DISABLE_URI_PATH_ESCAPE.contains(serviceShape.getId().toString())) {
                    writer.write("so.DisableURIPathEscaping = true");
                }
            });
        });
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return ListUtils.of(RuntimeClientPlugin.builder()
                .servicePredicate(AwsSignatureVersion4::isSupportedAuthentication)
                .addConfigField(ConfigField.builder()
                        .name(SIGNER_INTERFACE_NAME)
                        .type(SymbolUtils.createValueSymbolBuilder(SIGNER_INTERFACE_NAME).build())
                        .documentation("Signature Version 4 (SigV4) Signer")
                        .build())
                .addConfigFieldResolver(
                        ConfigFieldResolver.builder()
                                .location(ConfigFieldResolver.Location.CLIENT)
                                .target(ConfigFieldResolver.Target.INITIALIZATION)
                                .resolver(SymbolUtils.createValueSymbolBuilder(SIGNER_RESOLVER).build())
                                .build())
                .build());
    }

    private void writeMiddlewareRegister(Model model, GoWriter writer, ServiceShape serviceShape) {
        writer.addUseImports(SmithyGoDependency.SMITHY_MIDDLEWARE);
        writer.openBlock("func $L(stack $P, o Options) error {", "}", REGISTER_MIDDLEWARE_FUNCTION,
                SymbolUtils.createPointableSymbolBuilder("Stack", SmithyGoDependency.SMITHY_MIDDLEWARE).build(), () -> {
                    Symbol newMiddlewareSymbol = SymbolUtils.createValueSymbolBuilder(
                            "NewSignHTTPRequestMiddleware", SdkGoDependency.SIGNER_V4).build();
                    Symbol middlewareOptionsSymbol = SymbolUtils.createValueSymbolBuilder(
                            "SignHTTPRequestMiddlewareOptions", SdkGoDependency.SIGNER_V4).build();

                    writer.openBlock("mw := $T($T{", "})", newMiddlewareSymbol, middlewareOptionsSymbol, () -> {
                        writer.write("CredentialsProvider: o.$L,", AddAwsConfigFields.CREDENTIALS_CONFIG_NAME);
                        writer.write("Signer: o.$L,", SIGNER_CONFIG_FIELD_NAME);
                        writer.write("LogSigning: o.$L.IsSigning(),", AddAwsConfigFields.LOG_MODE_CONFIG_NAME);
                    });
                    writer.write("return stack.Finalize.Add(mw, middleware.After)");
                });
        writer.write("");
    }

    /**
     * Returns if the SigV4Trait is a auth scheme supported by the service.
     *
     * @param model        model definition
     * @param serviceShape service shape for the API
     * @return if the SigV4 trait is used by the service.
     */
    public static boolean isSupportedAuthentication(Model model, ServiceShape serviceShape) {
        return ServiceIndex.of(model).getAuthSchemes(serviceShape).values().stream().anyMatch(trait -> trait.getClass()
                .equals(SigV4Trait.class));
    }

    /**
     * Returns if the SigV4Trait is a auth scheme for the service and operation.
     *
     * @param model     model definition
     * @param service   service shape for the API
     * @param operation operation shape
     * @return if SigV4Trait is an auth scheme for the operation and service.
     */
    public static boolean hasSigV4AuthScheme(Model model, ServiceShape service, OperationShape operation) {
        Map<ShapeId, Trait> auth = ServiceIndex.of(model).getEffectiveAuthSchemes(service.getId(), operation.getId());
        return auth.containsKey(SigV4Trait.ID) && !operation.hasTrait(OptionalAuthTrait.class);
    }
}
