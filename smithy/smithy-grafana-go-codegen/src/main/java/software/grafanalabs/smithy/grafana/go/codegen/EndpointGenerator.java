package software.grafanalabs.smithy.grafana.go.codegen;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import software.amazon.smithy.aws.traits.ServiceTrait;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.go.codegen.GoSettings;
import software.amazon.smithy.go.codegen.GoStackStepMiddlewareGenerator;
import software.amazon.smithy.go.codegen.GoWriter;
import software.amazon.smithy.go.codegen.MiddlewareIdentifier;
import software.amazon.smithy.go.codegen.SmithyGoDependency;
import software.amazon.smithy.go.codegen.SymbolUtils;
import software.amazon.smithy.go.codegen.TriConsumer;
import software.amazon.smithy.go.codegen.integration.ConfigField;
import software.amazon.smithy.go.codegen.integration.ProtocolUtils;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.IoUtils;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.SmithyBuilder;

/**
 * Writes out a file that resolves endpoints using endpoints.json, but the
 * created resolver resolves endpoints for a single service.
 */
public final class EndpointGenerator implements Runnable {
    public static final String MIDDLEWARE_NAME = "ResolveEndpoint";
    public static final String ADD_MIDDLEWARE_HELPER_NAME = String.format("add%sMiddleware", MIDDLEWARE_NAME);
    public static final String RESOLVER_INTERFACE_NAME = "EndpointResolver";
    public static final String RESOLVER_FUNC_NAME = "EndpointResolverFunc";
    public static final String RESOLVER_OPTIONS = "EndpointResolverOptions";
    public static final String CLIENT_CONFIG_RESOLVER = "resolveDefaultEndpointConfiguration";
    public static final String RESOLVER_CONSTRUCTOR_NAME = "NewDefaultEndpointResolver";
    public static final String AWS_ENDPOINT_RESOLVER_HELPER = "withEndpointResolver";
    public static final String DUAL_STACK_ENDPOINT_OPTION = "UseDualStackEndpoint";
    public static final String USE_FIPS_ENDPOINT_OPTION = "UseFIPSEndpoint";
    public static final String LOGGER_OPTION = "Logger";
    public static final String LOG_DEPRECATED_OPTION = "LogDeprecated";
    public static final String RESOLVED_REGION = "ResolvedRegion";
    public static final String FINALIZE_CLIENT_ENDPOINT_RESOLVER_OPTIONS = "finalizeClientEndpointResolverOptions";

    private static final String EndpointResolverFromURL = "EndpointResolverFromURL";
    private static final String ENDPOINT_SOURCE_CUSTOM = "EndpointSourceCustom";
    private static final Symbol AWS_ENDPOINT = SymbolUtils.createPointableSymbolBuilder(
            "Endpoint", SdkGoDependency.CORE).build();

    private static final int ENDPOINT_MODEL_VERSION = 3;
    private static final String INTERNAL_ENDPOINT_PACKAGE = "internal/endpoints";
    private static final String INTERNAL_RESOLVER_NAME = "Resolver";
    private static final String INTERNAL_RESOLVER_OPTIONS_NAME = "Options";
    private static final String INTERNAL_ENDPOINTS_DATA_NAME = "defaultPartitions";
    private static final String DISABLE_HTTPS = "DisableHTTPS";

    // dual-stack related constants
    private static final String DUAL_STACK_ENDPOINT_TYPE_NAME = "DualStackEndpointState";

    // fips related constants
    private static final String FIPS_ENDPOINT_TYPE_NAME = "FIPSEndpointState";

    private static final String TRANSFORM_TO_SHARED_OPTIONS = "transformToSharedOptions";
    private static final String AWS_ENDPOINT_RESOLVER_ADAPTOR = "awsEndpointResolverAdaptor";

    private static final String DNS_SUFFIX_KEY = "dnsSuffix";
    private static final String HOSTNAME_KEY = "hostname";
    private static final String VARIANTS_KEY = "variants";
    private static final String VARIANT_TAGS_KEY = "tags";

    private static final List<EndpointOption> ENDPOINT_OPTIONS = ListUtils.of(
            EndpointOption.builder()
                    .name(LOGGER_OPTION)
                    .documentation(String.format("%s is a logging implementation that log events should be sent to.",
                            LOGGER_OPTION))
                    .type(SymbolUtils.createValueSymbolBuilder("Logger", SmithyGoDependency.SMITHY_LOGGING)
                            .build())
                    .shared(true)
                    .build(),
            EndpointOption.builder()
                    .name(LOG_DEPRECATED_OPTION)
                    .documentation(String.format("""
                                                 %s indicates that deprecated endpoints should be logged to the
                                                 provided logger.""", LOG_DEPRECATED_OPTION))
                    .type(SymbolUtils.createValueSymbolBuilder("bool")
                            .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true)
                            .build())
                    .shared(true)
                    .build(),
            EndpointOption.builder()
                    .name(RESOLVED_REGION)
                    .documentation(String.format("""
                                                 %s is used to override the region to be resolved, rather then the
                                                 using the value passed to the ResolveEndpoint method. This value is
                                                 used by the SDK to translate regions like fips-us-east-1 or
                                                 us-east-1-fips to an alternative name. You must not set this value
                                                 directly in your application.""", RESOLVED_REGION))
                    .type(SymbolUtils.createValueSymbolBuilder("string")
                            .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true)
                            .build())
                    .shared(true)
                    .withGetter(true)
                    .build(),
            EndpointOption.builder()
                    .name(DISABLE_HTTPS)
                    .documentation(String.format("""
                                                 %s informs the resolver to return an endpoint that does not use the
                                                 HTTPS scheme.
                                                 """, DISABLE_HTTPS))
                    .type(SymbolUtils.createValueSymbolBuilder("bool")
                            .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true)
                            .build())
                    .shared(true)
                    .withGetter(true)
                    .build(),
            EndpointOption.builder()
                    .name(DUAL_STACK_ENDPOINT_OPTION)
                    .documentation(String.format("""
                                                 %s specifies the resolver must resolve a dual-stack endpoint.
                                                 """, DUAL_STACK_ENDPOINT_OPTION))
                    .type(SymbolUtils.createValueSymbolBuilder(DUAL_STACK_ENDPOINT_TYPE_NAME,
                            SdkGoDependency.CORE).build())
                    .shared(true)
                    .withGetter(true)
                    .build(),
            EndpointOption.builder()
                    .name(USE_FIPS_ENDPOINT_OPTION)
                    .documentation(String.format("""
                                                 %s specifies the resolver must resolve a FIPS endpoint.
                                                 """, USE_FIPS_ENDPOINT_OPTION))
                    .type(SymbolUtils.createValueSymbolBuilder(FIPS_ENDPOINT_TYPE_NAME,
                            SdkGoDependency.CORE).build())
                    .shared(true)
                    .withGetter(true)
                    .build()
    );

    private final GoSettings settings;
    private final Model model;
    private final TriConsumer<String, String, Consumer<GoWriter>> writerFactory;
    private final ServiceShape serviceShape;
    private final ObjectNode endpointData;
    private final String endpointPrefix;
    private final Map<String, Partition> partitions = new TreeMap<>();
    private final boolean isInternalOnly;
    private final boolean isGenerateModelQueryHelpers;
    private final String resolvedSdkID;

    private EndpointGenerator(Builder builder) {
        settings = SmithyBuilder.requiredState("settings", builder.settings);
        model = SmithyBuilder.requiredState("model", builder.model);
        writerFactory = SmithyBuilder.requiredState("writerFactory", builder.writerFactory);
        isInternalOnly = builder.internalOnly;
        serviceShape = settings.getService(model);
        isGenerateModelQueryHelpers = builder.modelQueryHelpers;

        ServiceTrait serviceTrait = serviceShape.expectTrait(ServiceTrait.class);

        if (builder.sdkID != null) {
            resolvedSdkID = builder.sdkID;
        } else {
            resolvedSdkID = serviceTrait.getSdkId();
        }

        String arnNamespace;
        if (builder.arnNamespace != null) {
            arnNamespace = builder.arnNamespace;
        } else {
            arnNamespace = serviceTrait.getArnNamespace();
        }

        endpointPrefix = getEndpointPrefix(resolvedSdkID, arnNamespace);
        endpointData = Node.parse(IoUtils.readUtf8Resource(getClass(), "endpoints.json")).expectObjectNode();

        validateVersion();
        loadPartitions();
    }

    private void validateVersion() {
        int version = endpointData.expectNumberMember("version").getValue().intValue();
        if (version != ENDPOINT_MODEL_VERSION) {
            throw new CodegenException("Invalid endpoints.json version. Expected version 3, found " + version);
        }
    }

    // Get service's endpoint prefix from a known list. If not found, fallback to ArnNamespace
    private String getEndpointPrefix(ServiceShape service) {
        ObjectNode endpointPrefixData = Node.parse(IoUtils.readUtf8Resource(getClass(), "endpoint-prefix.json"))
                .expectObjectNode();
        ServiceTrait serviceTrait = service.getTrait(ServiceTrait.class)
                .orElseThrow(() -> new CodegenException("No service trait found on " + service.getId()));
        return endpointPrefixData.getStringMemberOrDefault(serviceTrait.getSdkId(), serviceTrait.getArnNamespace());
    }

    private String getEndpointPrefix(String sdkId, String arnNamespace) {
        ObjectNode endpointPrefixData = Node.parse(IoUtils.readUtf8Resource(getClass(), "endpoint-prefix.json"))
                .expectObjectNode();
        return endpointPrefixData.getStringMemberOrDefault(sdkId, arnNamespace);
    }

    private void loadPartitions() {
        List<ObjectNode> partitionObjects = endpointData
                .expectArrayMember("partitions")
                .getElementsAs(Node::expectObjectNode);

        for (ObjectNode partition : partitionObjects) {
            String partitionName = partition.expectStringMember("partition").getValue();
            partitions.put(partitionName, new Partition(partition, partitionName));
        }
    }

    @Override
    public void run() {
        if (!this.isInternalOnly) {
            writerFactory.accept("endpoints.go", settings.getModuleName(), writer -> {
                generatePublicResolverTypes(writer);
                generateMiddleware(writer);
                generateAwsEndpointResolverWrapper(writer);
                generateFinalizeClientEndpointResolverOptions(writer);
            });
        }

        String pkgName = isInternalOnly ? INTERNAL_ENDPOINT_PACKAGE + "/" + this.endpointPrefix : INTERNAL_ENDPOINT_PACKAGE;
        writerFactory.accept(pkgName + "/endpoints.go", getInternalEndpointImportPath(), (writer) -> {
            generateInternalResolverImplementation(writer);
            generateInternalEndpointsModel(writer);
            if (isGenerateModelQueryHelpers) {
                generateInternalModelHelpers(writer);
            }
        });

        if (!this.isInternalOnly) {
            writerFactory.accept(INTERNAL_ENDPOINT_PACKAGE + "/endpoints_test.go",
                    getInternalEndpointImportPath(), (writer) -> {
                        writer.addUseImports(SmithyGoDependency.TESTING);
                        writer.openBlock("func TestRegexCompile(t *testing.T) {", "}", () -> {
                            writer.write("_ = $T",
                                    getInternalEndpointsSymbol(INTERNAL_ENDPOINTS_DATA_NAME, false).build());
                        });
                    });
        }
    }

    private void generateFinalizeClientEndpointResolverOptions(GoWriter writer) {
        writer.pushState();

        writer.putContext("logDepOption", LOG_DEPRECATED_OPTION);
        writer.putContext("dualStackOption", DUAL_STACK_ENDPOINT_OPTION);
        writer.putContext("fipsOption", USE_FIPS_ENDPOINT_OPTION);
        writer.putContext("unsetDualStack", DualStackEndpointConstant.UNSET.getSymbol());
        writer.putContext("enableDualStack", DualStackEndpointConstant.ENABLE.getSymbol());
        writer.putContext("disableDualStack", DualStackEndpointConstant.DISABLE.getSymbol());
        writer.putContext("enableFIPS", FIPSEndpointConstant.ENABLE.getSymbol());
        writer.putContext("contains", SymbolUtils.createValueSymbolBuilder("Contains",
                SmithyGoDependency.STRINGS).build());
        writer.putContext("replaceALL", SymbolUtils.createValueSymbolBuilder("ReplaceAll",
                SmithyGoDependency.STRINGS).build());

        writer.openBlock("func $L(options *Options) {", "}",
                FINALIZE_CLIENT_ENDPOINT_RESOLVER_OPTIONS, () -> {
                    writer.write("""
                                 options.EndpointOptions.$logDepOption:L = options.ClientLogMode.IsDeprecatedUsage()

                                 if len(options.EndpointOptions.ResolvedRegion) == 0 {
                                     const fipsInfix = "-fips-"
                                     const fipsPrefix = "fips-"
                                     const fipsSuffix = "-fips"

                                     if ($contains:T(options.Region, fipsInfix) ||
                                         $contains:T(options.Region, fipsPrefix) ||
                                         $contains:T(options.Region, fipsSuffix)) {
                                         options.EndpointOptions.ResolvedRegion = $replaceALL:T($replaceALL:T($replaceALL:T(
                                             options.Region, fipsInfix, "-"), fipsPrefix, ""), fipsSuffix, "")
                                         options.EndpointOptions.$fipsOption:L = $enableFIPS:T
                                     }
                                 }
                                 """);
                }).write("");

        writer.popState();
    }

    private void generateInternalModelHelpers(GoWriter writer) {
        generateDNSSuffixFunction(writer);
    }

    private void generateDNSSuffixFunction(GoWriter writer) {
        Symbol optionsSymbol = getInternalEndpointsSymbol(INTERNAL_RESOLVER_OPTIONS_NAME, false).build();

        writer.addUseImports(SmithyGoDependency.FMT);
        writer.writeDocs("GetDNSSuffix returns the dnsSuffix URL component for the given partition id");
        writer.openBlock("func GetDNSSuffix(id string, options $T) (string, error) {", "}", optionsSymbol, () -> {
            Symbol equalFold = SymbolUtils.createValueSymbolBuilder("EqualFold", SmithyGoDependency.STRINGS)
                    .build();

            writer.write("variant := $L(options).GetEndpointVariant()", TRANSFORM_TO_SHARED_OPTIONS);

            writer.openBlock("switch {", "}", () -> {
                partitions.forEach((s, partition) -> {
                    writer.openBlock("case $T(id, $S):", "", equalFold, partition.id, () -> {
                        writer.openBlock("switch variant {", "}", () -> {
                            partition.getDefaults().forEach((variant, objectNode) -> {
                                writer.writeInline("case ");
                                variant.writeVariantInline(writer);
                                writer.openBlock(":", "", () -> writer
                                        .write("return $S, nil", objectNode.expectStringMember(DNS_SUFFIX_KEY)));
                            });
                            writer.write("""
                                         default:
                                             return "", $T("unsupported endpoint variant %v, in partition %s", variant, id)
                                         """, SymbolUtils.createValueSymbolBuilder("Errorf",
                                    SmithyGoDependency.FMT).build());
                        });
                    });
                });
                writer.openBlock("default:", "", () -> writer.write("return \"\", fmt.Errorf(\"unknown partition\")"));
            });
        });
        writer.write("");
    }

    private void generateAwsEndpointResolverWrapper(GoWriter writer) {
        var endpointResolver = SymbolUtils.createValueSymbolBuilder("EndpointResolver", SdkGoDependency.CORE)
                .build();
        var endpointResolverWithOptions = SymbolUtils.createValueSymbolBuilder("EndpointResolverWithOptions", SdkGoDependency.CORE)
                .build();
        var resolverInterface = SymbolUtils.createValueSymbolBuilder(RESOLVER_INTERFACE_NAME).build();

        var wrappedResolverSymbol = SymbolUtils.createPointableSymbolBuilder("wrappedEndpointResolver").build();

        writer.write("""
                     type $T struct {
                         awsResolver $T
                         resolver $T
                     }
                     """, wrappedResolverSymbol, endpointResolverWithOptions, resolverInterface);

        writeExternalResolveEndpointImplementation(writer, wrappedResolverSymbol, "w", () -> {
            var endpointNotFoundError = SymbolUtils.createValueSymbolBuilder("EndpointNotFoundError",
                    SdkGoDependency.CORE).build();
            var errorf = SymbolUtils.createValueSymbolBuilder("Errorf",
                    SmithyGoDependency.FMT).build();
            writer.write("""
                         if w.awsResolver == nil {
                             goto fallback
                         }
                         endpoint, err = w.awsResolver.ResolveEndpoint(ServiceID, region, options)
                         if err == nil {
                             return endpoint, nil
                         }

                         if nf := (&$T{}); !errors.As(err, &nf) {
                             return endpoint, err
                         }

                         fallback:
                         if w.resolver == nil {
                             return endpoint, $T("default endpoint resolver provided was nil")
                         }
                         return w.resolver.ResolveEndpoint(region, options)""", endpointNotFoundError, errorf);

            writer.addUseImports(SmithyGoDependency.ERRORS);
        });

        var endpoint = SymbolUtils.createValueSymbolBuilder("Endpoint",
                SdkGoDependency.CORE).build();
        writer.write("""
                     type $L func(service, region string) ($T, error)

                     func (a $L) ResolveEndpoint(service, region string, options ...interface{}) ($T, error) {
                         return a(service, region)
                     }

                     var _ $T = $L(nil)
                     """, AWS_ENDPOINT_RESOLVER_ADAPTOR, endpoint, AWS_ENDPOINT_RESOLVER_ADAPTOR,
                endpoint, endpointResolverWithOptions, AWS_ENDPOINT_RESOLVER_ADAPTOR);

        // Generate exported helper for constructing a wrapper around the AWS EndpointResolver type that is compatible
        // with the clients EndpointResolver interface.
        writer.write("""
                     // $L returns an EndpointResolver that first delegates endpoint resolution to the awsResolver.
                     // If awsResolver returns aws.EndpointNotFoundError error, the resolver will use the the provided
                     // fallbackResolver for resolution.
                     //
                     // fallbackResolver must not be nil
                     func $L(awsResolver $T, awsResolverWithOptions $T, fallbackResolver $T) $T {
                         var resolver $T

                         if awsResolverWithOptions != nil {
                             resolver = awsResolverWithOptions
                         } else if awsResolver != nil {
                             resolver = $L(awsResolver.ResolveEndpoint)
                         }

                         return &$T{
                             awsResolver: resolver,
                             resolver: fallbackResolver,
                         }
                     }
                     """, AWS_ENDPOINT_RESOLVER_HELPER, AWS_ENDPOINT_RESOLVER_HELPER,
                endpointResolver, endpointResolverWithOptions, resolverInterface,
                resolverInterface, endpointResolverWithOptions, AWS_ENDPOINT_RESOLVER_ADAPTOR, wrappedResolverSymbol);
    }

    private void generateMiddleware(GoWriter writer) {
        // Generate middleware definition
        GoStackStepMiddlewareGenerator middleware = GoStackStepMiddlewareGenerator.createSerializeStepMiddleware(
                MIDDLEWARE_NAME, MiddlewareIdentifier.string(MIDDLEWARE_NAME));
        middleware.writeMiddleware(writer, this::generateMiddlewareResolverBody,
                this::generateMiddlewareStructureMembers);

        Symbol stackSymbol = SymbolUtils.createPointableSymbolBuilder("Stack", SmithyGoDependency.SMITHY_MIDDLEWARE)
                .build();

        // Generate Middleware Adder Helper
        writer.openBlock("func $L(stack $P, o Options) error {", "}", ADD_MIDDLEWARE_HELPER_NAME, stackSymbol, () -> {
            writer.addUseImports(SmithyGoDependency.SMITHY_MIDDLEWARE);
            String closeBlock = String.format("}, \"%s\", middleware.Before)",
                    ProtocolUtils.OPERATION_SERIALIZER_MIDDLEWARE_ID);
            writer.openBlock("return stack.Serialize.Insert(&$T{", closeBlock,
                    middleware.getMiddlewareSymbol(),
                    () -> {
                        writer.write("Resolver: o.EndpointResolver,");
                        writer.write("Options: o.EndpointOptions,");
                    });
        });
        writer.write("");
        // Generate Middleware Remover Helper
        writer.openBlock("func remove$LMiddleware(stack $P) error {", "}", middleware.getMiddlewareSymbol(),
                stackSymbol, () -> {
                    writer.write("_, err := stack.Serialize.Remove((&$T{}).ID())", middleware.getMiddlewareSymbol());
                    writer.write("return err");
                });
    }

    private void generateMiddlewareResolverBody(GoStackStepMiddlewareGenerator g, GoWriter w) {
        w.addUseImports(SmithyGoDependency.FMT);
        w.addUseImports(SmithyGoDependency.NET_URL);
        w.addUseImports(SdkGoDependency.MIDDLEWARE);
        w.addUseImports(SmithyGoDependency.SMITHY_MIDDLEWARE);
        w.addUseImports(SmithyGoDependency.SMITHY_HTTP_TRANSPORT);

        w.write("req, ok := in.Request.(*smithyhttp.Request)");
        w.openBlock("if !ok {", "}", () -> {
            w.write("return out, metadata, fmt.Errorf(\"unknown transport type %T\", in.Request)");
        });
        w.write("");

        w.openBlock("if m.Resolver == nil {", "}", () -> {
            w.write("return out, metadata, fmt.Errorf(\"expected endpoint resolver to not be nil\")");
        });
        w.write("");

        w.write("""
                eo := m.Options
                eo.$L = $T(ctx)
                """, LOGGER_OPTION, SymbolUtils.createValueSymbolBuilder("GetLogger",
                SmithyGoDependency.SMITHY_MIDDLEWARE).build());

        w.write("var endpoint $T", SymbolUtils.createValueSymbolBuilder("Endpoint", SdkGoDependency.CORE)
                .build());
        w.write("endpoint, err = m.Resolver.ResolveEndpoint(awsmiddleware.GetRegion(ctx), eo)");
        w.openBlock("if err != nil {", "}", () -> {
            w.write("return out, metadata, fmt.Errorf(\"failed to resolve service endpoint, %w\", err)");
        });
        w.write("");

        w.write("req.URL, err = url.Parse(endpoint.URL)");
        w.openBlock("if err != nil {", "}", () -> {
            w.write("return out, metadata, fmt.Errorf(\"failed to parse endpoint URL: %w\", err)");
        });
        w.write("");

        w.openBlock("if len(awsmiddleware.GetSigningName(ctx)) == 0 {", "}", () -> {
            w.write("signingName := endpoint.SigningName");
            w.openBlock("if len(signingName) == 0 {", "}", () -> {
                w.write("signingName = $S", serviceShape.expectTrait(ServiceTrait.class).getArnNamespace());
            });
            w.write("ctx = awsmiddleware.SetSigningName(ctx, signingName)");
        });

        // set endoint source on context
        w.write("ctx = awsmiddleware.SetEndpointSource(ctx, endpoint.Source)");
        // set host-name immutable on context
        w.write("ctx = smithyhttp.SetHostnameImmutable(ctx, endpoint.HostnameImmutable)");
        // set signing region on context
        w.write("ctx = awsmiddleware.SetSigningRegion(ctx, endpoint.SigningRegion)");
        // set partition id on context
        w.write("ctx = awsmiddleware.SetPartitionID(ctx, endpoint.PartitionID)");

        w.insertTrailingNewline();
        w.write("return next.HandleSerialize(ctx, in)");
    }

    private void generateMiddlewareStructureMembers(GoStackStepMiddlewareGenerator g, GoWriter w) {
        w.write("Resolver $L", RESOLVER_INTERFACE_NAME);
        w.write("Options $L", RESOLVER_OPTIONS);
    }

    private Symbol.Builder getInternalEndpointsSymbol(String symbolName, boolean pointable) {
        Symbol.Builder builder;
        if (pointable) {
            builder = SymbolUtils.createPointableSymbolBuilder(symbolName);
        } else {
            builder = SymbolUtils.createValueSymbolBuilder(symbolName);
        }
        return builder.namespace(getInternalEndpointImportPath(), "/")
                .putProperty(SymbolUtils.NAMESPACE_ALIAS, "internalendpoints");
    }

    private String getInternalEndpointImportPath() {
        return settings.getModuleName() + "/" + INTERNAL_ENDPOINT_PACKAGE;
    }

    private void generatePublicResolverTypes(GoWriter writer) {
        Symbol awsEndpointSymbol = SymbolUtils.createValueSymbolBuilder("Endpoint", SdkGoDependency.CORE).build();
        Symbol internalEndpointsSymbol = getInternalEndpointsSymbol(INTERNAL_RESOLVER_NAME, true).build();

        Symbol resolverOptionsSymbol = SymbolUtils.createPointableSymbolBuilder(RESOLVER_OPTIONS).build();
        writer.writeDocs(String.format("%s is the service endpoint resolver options",
                resolverOptionsSymbol.getName()));
        writer.write("type $T = $T", resolverOptionsSymbol, getInternalEndpointsSymbol(INTERNAL_RESOLVER_OPTIONS_NAME,
                false).build());
        writer.write("");

        // Generate Resolver Interface
        writer.writeDocs(String.format("%s interface for resolving service endpoints.", RESOLVER_INTERFACE_NAME));
        writer.openBlock("type $L interface {", "}", RESOLVER_INTERFACE_NAME, () -> {
            writer.write("ResolveEndpoint(region string, options $T) ($T, error)", resolverOptionsSymbol,
                    awsEndpointSymbol);
        });
        writer.write("var _ $L = &$T{}", RESOLVER_INTERFACE_NAME, internalEndpointsSymbol);
        writer.write("");

        // Resolver Constructor
        writer.writeDocs(String.format("%s constructs a new service endpoint resolver", RESOLVER_CONSTRUCTOR_NAME));
        writer.openBlock("func $L() $P {", "}", RESOLVER_CONSTRUCTOR_NAME, internalEndpointsSymbol, () -> {
            writer.write("return $T()", getInternalEndpointsSymbol("New", false)
                    .build());
        });

        Symbol resolverFuncSymbol = SymbolUtils.createValueSymbolBuilder(RESOLVER_FUNC_NAME).build();

        // Generate resolver function creator
        writer.writeDocs(String.format("%s is a helper utility that wraps a function so it satisfies the %s "
                                       + "interface. This is useful when you want to add additional endpoint resolving logic, or stub out "
                                       + "specific endpoints with custom values.", RESOLVER_FUNC_NAME, RESOLVER_INTERFACE_NAME));
        writer.write("type $T func(region string, options $T) ($T, error)",
                resolverFuncSymbol, resolverOptionsSymbol, awsEndpointSymbol);

        writeExternalResolveEndpointImplementation(writer, resolverFuncSymbol, "fn", () -> {
            writer.write("return fn(region, options)");
        });

        // Generate Client Options Configuration Resolver
        writer.openBlock("func $L(o $P) {", "}", CLIENT_CONFIG_RESOLVER,
                SymbolUtils.createPointableSymbolBuilder("Options").build(), () -> {
                    writer.openBlock("if o.EndpointResolver != nil {", "}", () -> writer.write("return"));
                    writer.write("o.EndpointResolver = $L()", RESOLVER_CONSTRUCTOR_NAME);
                });

        // Generate EndpointResolverFromURL helper
        writer.writeDocs(String.format("%s returns an EndpointResolver configured using the provided endpoint url. "
                                       + "By default, the resolved endpoint resolver uses the client region as signing region, and  "
                                       + "the endpoint source is set to EndpointSourceCustom."
                                       + "You can provide functional options to configure endpoint values for the resolved endpoint.",
                EndpointResolverFromURL));
        writer.openBlock("func $L(url string, optFns ...func($P)) EndpointResolver {", "}",
                EndpointResolverFromURL, AWS_ENDPOINT, () -> {
                    Symbol customEndpointSource = SymbolUtils.createValueSymbolBuilder(
                            ENDPOINT_SOURCE_CUSTOM, SdkGoDependency.CORE
                    ).build();
                    writer.write("e := $T{ URL : url, Source : $T }", AWS_ENDPOINT, customEndpointSource);
                    writer.write("for _, fn := range optFns { fn(&e) }");
                    writer.write("");

                    writer.openBlock("return $T(", ")", resolverFuncSymbol, () -> {
                        writer.write("func(region string, options $L) ($T, error) {", RESOLVER_OPTIONS, AWS_ENDPOINT);
                        writer.write("if len(e.SigningRegion) == 0 { e.SigningRegion = region }");
                        writer.write("return e, nil },");
                    });
                });
    }

    private void writeExternalResolveEndpointImplementation(
            GoWriter writer,
            Symbol receiverType,
            String receiverIdentifier,
            Runnable body
    ) {
        Symbol resolverOptionsSymbol = SymbolUtils.createPointableSymbolBuilder(RESOLVER_OPTIONS).build();
        writeResolveEndpointImplementation(writer, receiverType, receiverIdentifier, resolverOptionsSymbol,
                body);
    }

    private void writeInternalResolveEndpointImplementation(
            GoWriter writer,
            Symbol receiverType,
            String receiverIdentifier,
            Runnable body
    ) {
        Symbol resolverOptionsSymbol = SymbolUtils.createPointableSymbolBuilder(INTERNAL_RESOLVER_OPTIONS_NAME).build();
        writeResolveEndpointImplementation(writer, receiverType, receiverIdentifier, resolverOptionsSymbol,
                body);
    }

    /**
     * Writes the ResolveEndpoint function signature to satisfy the EndpointResolver interface.
     *
     * @param writer                the code writer
     * @param receiverType          the receiver symbol type should be can be value or pointer
     * @param receiverIdentifier    the identifier to use for the receiver
     * @param resolverOptionsSymbol the symbol for the options
     * @param body                  a runnable that will populate the function implementation.
     */
    private void writeResolveEndpointImplementation(
            GoWriter writer,
            Symbol receiverType,
            String receiverIdentifier,
            Symbol resolverOptionsSymbol,
            Runnable body
    ) {
        Symbol awsEndpointSymbol = SymbolUtils.createValueSymbolBuilder("Endpoint", SdkGoDependency.CORE).build();
        writer.openBlock("func ($L $P) ResolveEndpoint(region string, options $T) (endpoint $T, err error) {", "}",
                        receiverIdentifier, receiverType, resolverOptionsSymbol, awsEndpointSymbol, body::run)
                .write("");
    }

    private void generateInternalResolverImplementation(GoWriter writer) {
        // Options
        Symbol resolverOptionsSymbol = SymbolUtils.createPointableSymbolBuilder(INTERNAL_RESOLVER_OPTIONS_NAME).build();
        writer.writeDocs(String.format("%s is the endpoint resolver configuration options",
                resolverOptionsSymbol.getName()));
        writer.openBlock("type $T struct {", "}", resolverOptionsSymbol, () -> {
            ENDPOINT_OPTIONS.forEach(field -> {
                field.getDocumentation().ifPresent(s -> {
                    if (s.length() == 0) {
                        return;
                    }
                    writer.writeDocs(s);
                });
                writer.write("$L $P", field.getName(), field.getType()).write("");
            });
        });
        writer.write("");
        ENDPOINT_OPTIONS.forEach(endpointOption -> {
            if (!endpointOption.withGetter) {
                return;
            }
            writer.write("""
                         func (o $T) Get$L() $P {
                             return o.$L
                         }
                         """, resolverOptionsSymbol, endpointOption.getName(), endpointOption.getType(),
                    endpointOption.getName());
        });

        Symbol sharedOptions = SymbolUtils.createPointableSymbolBuilder("Options",
                SdkGoDependency.INTERNAL_ENDPOINTS_V2).build();
        writer.openBlock("func $L(options $T) $T {", "}", TRANSFORM_TO_SHARED_OPTIONS,
                SymbolUtils.createValueSymbolBuilder(INTERNAL_RESOLVER_OPTIONS_NAME).build(), sharedOptions,
                () -> writer
                        .openBlock("return $T{", "}", sharedOptions, () -> {
                            ENDPOINT_OPTIONS.stream().filter(EndpointOption::isShared).forEach(field -> {
                                String internalName = field.getSharedOptionName().orElse(field.getName());
                                Optional<Symbol> resolver = field.getSharedResolver();
                                if (resolver.isPresent()) {
                                    writer.write("$L: $T(options.$L),", internalName, resolver.get(),
                                            field.getName());
                                } else {
                                    writer.write("$L: options.$L,", internalName, field.getName());
                                }
                            });
                        }));

        // Resolver
        Symbol resolverImplSymbol = SymbolUtils.createPointableSymbolBuilder(INTERNAL_RESOLVER_NAME).build();

        writer.writeDocs(String.format("%s %s endpoint resolver", resolverImplSymbol.getName(),
                this.resolvedSdkID));
        writer.openBlock("type $T struct {", "}", resolverImplSymbol, () -> {
            writer.write("partitions $T", SymbolUtils.createValueSymbolBuilder("Partitions",
                    SdkGoDependency.INTERNAL_ENDPOINTS_V2).build());
        });
        writer.write("");
        writer.writeDocs("ResolveEndpoint resolves the service endpoint for the given region and options");
        writeInternalResolveEndpointImplementation(writer, resolverImplSymbol, "r", () -> {
            // Currently, all APIs require a region to derive the endpoint for that API. If there are ever a truly
            // region-less API then this should be gated at codegen.
            writer.addUseImports(SdkGoDependency.CORE);
            writer.write("if len(region) == 0 { return endpoint, &aws.MissingRegionError{} }").write("")
                    .write("opt := $L(options)", TRANSFORM_TO_SHARED_OPTIONS)
                    .write("return r.partitions.ResolveEndpoint(region, opt)");
        });
        writer.write("");
        writer.writeDocs(String.format("New returns a new %s", resolverImplSymbol.getName()));
        writer.openBlock("func New() *$T {", "}", resolverImplSymbol, () -> writer.openBlock("return &$T{", "}",
                resolverImplSymbol, () -> {
                    writer.write("partitions: $L,", INTERNAL_ENDPOINTS_DATA_NAME);
                }));
    }

    private static String getPartitionIDFieldName(String id) {
        StringBuilder builder = new StringBuilder();

        char[] charArray = id.toCharArray();
        boolean capitalize = true;
        for (int i = 0; i < charArray.length; i++) {
            if (!Character.isAlphabetic(charArray[i])) {
                capitalize = true;
                continue;
            }

            if (capitalize) {
                builder.append(Character.toUpperCase(charArray[i]));
                capitalize = false;
            } else {
                builder.append(Character.toLowerCase(charArray[i]));
            }
        }

        return builder.toString();
    }

    private void generateInternalEndpointsModel(GoWriter writer) {
        writer.addUseImports(SdkGoDependency.INTERNAL_ENDPOINTS_V2);

        List<Partition> sortedPartitions = getSortedPartitions();

        writer.openBlock("var partitionRegexp = struct{", "}{", () -> {
            sortedPartitions.forEach(partition -> {
                writer.write("$L $P", getPartitionIDFieldName(partition.getId()),
                        SymbolUtils.createPointableSymbolBuilder("Regexp", SdkGoDependency.REGEXP).build());
            });
        }).openBlock("", "}", () -> {
            sortedPartitions.forEach(partition -> {
                writer.write("$L: regexp.MustCompile($S),", getPartitionIDFieldName(partition.getId()),
                        partition.getConfig().expectStringMember("regionRegex").getValue());
            });
        });
        writer.write("");

        Symbol partitionsSymbol = SymbolUtils.createPointableSymbolBuilder("Partitions",
                SdkGoDependency.INTERNAL_ENDPOINTS_V2).build();
        writer.openBlock("var $L = $T{", "}", INTERNAL_ENDPOINTS_DATA_NAME, partitionsSymbol, () -> {
            sortedPartitions.forEach(entry -> {
                writer.openBlock("{", "},", () -> writePartition(writer, entry));
            });
        });
    }

    private List<Partition> getSortedPartitions() {
        return partitions.entrySet().stream()
                .sorted((x, y) -> {
                    // Always sort standard aws partition first
                    if (x.getKey().equals("aws")) {
                        return -1;
                    }
                    return x.getKey().compareTo(y.getKey());
                }).map(Map.Entry::getValue).collect(Collectors.toList());
    }

    private void writePartition(GoWriter writer, Partition partition) {
        writer.write("ID: $S,", partition.getId());
        var defaultKey = SymbolUtils.createValueSymbolBuilder("DefaultKey",
                SdkGoDependency.INTERNAL_ENDPOINTS_V2).build();
        var endpointSymbol = SymbolUtils.createValueSymbolBuilder("Endpoint",
                SdkGoDependency.INTERNAL_ENDPOINTS_V2).build();
        writer.openBlock("Defaults: map[$T]$P{", "},", defaultKey, endpointSymbol,
                () -> partition.getDefaults().forEach((variant, objectNode) -> {
                    writer.writeInline("""
                                       $T{
                                           Variant:""", defaultKey);
                    variant.writeVariantInline(writer);
                    writer.writeInline(",\n}:");
                    writer.openBlock("{", "},",
                            () -> writeEndpoint(writer, objectNode));
                }));

        writer.addUseImports(SdkGoDependency.REGEXP);
        writer.write("RegionRegex: partitionRegexp.$L,", getPartitionIDFieldName(partition.getId()));

        var optionalPartitionEndpoint = partition.getPartitionEndpoint();
        var isRegionalizedValue = SymbolUtils.createValueSymbolBuilder(optionalPartitionEndpoint.isPresent()
                ? "false" : "true").build();
        writer.write("IsRegionalized: $T,", isRegionalizedValue);
        optionalPartitionEndpoint.ifPresent(s -> writer.write("PartitionEndpoint: $S,", s));

        var endpoints = partition.getEndpoints().getMembers();
        if (endpoints.size() > 0) {
            var endpointKey = SymbolUtils.createPointableSymbolBuilder("EndpointKey",
                            SdkGoDependency.INTERNAL_ENDPOINTS_V2)
                    .build();
            var endpointsSymbol = SymbolUtils.createPointableSymbolBuilder("Endpoints",
                            SdkGoDependency.INTERNAL_ENDPOINTS_V2)
                    .build();
            writer.openBlock("Endpoints: $T{", "},", endpointsSymbol, () -> {
                endpoints.forEach((region, en) -> {
                    var endpointNode = en.expectObjectNode();
                    writer.openBlock("""
                                     $T{
                                         Region: $S,
                                     }: $T{""", "},", endpointKey, region,
                            endpointSymbol, () -> writeEndpoint(writer, endpointNode));
                    endpointNode.getArrayMember(VARIANTS_KEY).orElse(ArrayNode.fromNodes()).forEach(vn -> {
                        writer.writeInline("""
                                           $T{
                                               Region: $S,
                                               Variant:""", endpointKey, region);
                        var variantNode = vn.expectObjectNode();
                        Variant.fromArrayNode(variantNode.expectArrayMember(VARIANT_TAGS_KEY))
                                .writeVariantInline(writer);
                        writer.openBlock(",\n}: {", "},",
                                () -> writeEndpoint(writer, mergeVariantDefinition(endpointNode, variantNode)));
                    });
                });
            });
        }
    }

    private ObjectNode mergeVariantDefinition(ObjectNode endpointNode, ObjectNode variantNode) {
        return endpointNode
                .withoutMember(HOSTNAME_KEY)
                .withoutMember(DNS_SUFFIX_KEY)
                .merge(variantNode);
    }

    private void writeEndpoint(GoWriter writer, ObjectNode node) {
        node.getStringMember(HOSTNAME_KEY).ifPresent(n -> {
            writer.write("Hostname: $S,", n.getValue());
        });
        node.getArrayMember("protocols").ifPresent(nodes -> {
            writer.writeInline("Protocols: []string{");
            nodes.forEach(n -> {
                writer.writeInline("$S, ", n.expectStringNode().getValue());
            });
            writer.write("},");
        });
        node.getArrayMember("signatureVersions").ifPresent(nodes -> {
            writer.writeInline("SignatureVersions: []string{");
            nodes.forEach(n -> writer.writeInline("$S, ", n.expectStringNode().getValue()));
            writer.write("},");
        });
        node.getMember("credentialScope").ifPresent(n -> {
            ObjectNode credentialScope = n.expectObjectNode();
            Symbol credentialScopeSymbol = SymbolUtils.createValueSymbolBuilder("CredentialScope",
                            SdkGoDependency.INTERNAL_ENDPOINTS_V2)
                    .build();
            writer.openBlock("CredentialScope: $T{", "},", credentialScopeSymbol, () -> {
                credentialScope.getStringMember("region").ifPresent(nn -> {
                    writer.write("Region: $S,", nn.getValue());
                });
                credentialScope.getStringMember("service").ifPresent(nn -> {
                    writer.write("Service: $S,", nn.getValue());
                });
            });
        });
        node.getBooleanMember("deprecated").ifPresent(booleanNode -> {
            if (booleanNode.getValue()) {
                writer.write("Deprecated: $T,", SymbolUtils.createValueSymbolBuilder("TrueTernary",
                        SdkGoDependency.CORE).build());
            }
        });
    }

    private static class EndpointOption extends ConfigField {
        private final boolean shared;
        private final String sharedOptionName;
        private final Symbol sharedResolver;
        private final boolean withGetter;

        public EndpointOption(Builder builder) {
            super(builder);
            this.shared = builder.shared;
            this.sharedOptionName = builder.sharedOptionName;
            this.sharedResolver = builder.sharedResolver;
            this.withGetter = builder.withGetter;
        }

        public static Builder builder() {
            return new Builder();
        }

        public boolean isShared() {
            return shared;
        }

        public Optional<String> getSharedOptionName() {
            return Optional.ofNullable(sharedOptionName);
        }

        public Optional<Symbol> getSharedResolver() {
            return Optional.ofNullable(this.sharedResolver);
        }

        public boolean isWithGetter() {
            return withGetter;
        }

        private static class Builder extends ConfigField.Builder {
            private boolean shared;
            private String sharedOptionName;
            private Symbol sharedResolver;
            private boolean withGetter;

            public Builder() {
                super();
            }

            /**
             * Set the resolver config field to be shared common parameter
             *
             * @param shared whether the resolver config field is shared
             * @return the builder
             */
            public Builder shared(boolean shared) {
                this.shared = shared;
                return this;
            }

            public Builder sharedOptionName(String sharedOptionName) {
                this.sharedOptionName = sharedOptionName;
                return this;
            }

            public Builder sharedResolver(Symbol sharedResolver) {
                this.sharedResolver = sharedResolver;
                return this;
            }

            public Builder withGetter(boolean withGetter) {
                this.withGetter = withGetter;
                return this;
            }

            @Override
            public EndpointOption build() {
                return new EndpointOption(this);
            }

            @Override
            public Builder name(String name) {
                super.name(name);
                return this;
            }

            @Override
            public Builder type(Symbol type) {
                super.type(type);
                return this;
            }

            @Override
            public Builder documentation(String documentation) {
                super.documentation(documentation);
                return this;
            }
        }
    }

    private static final class Variant {
        private final boolean fips;
        private final boolean dualstack;
        private final Set<String> unknown;

        private Variant(Builder builder) {
            this.fips = builder.fips;
            this.dualstack = builder.dualstack;
            this.unknown = builder.unknown;
        }

        public boolean isFips() {
            return fips;
        }

        public boolean isDualstack() {
            return dualstack;
        }

        public Set<String> getUnknown() {
            return unknown;
        }

        public void writeVariantInline(GoWriter writer) {
            if (getUnknown().size() > 0) {
                throw new CodegenException("unable to represent variant with unknown tags");
            }

            var symbols = new ArrayList<>();

            if (fips) {
                symbols.add(SymbolUtils.createValueSymbolBuilder("FIPSVariant",
                                SdkGoDependency.INTERNAL_ENDPOINTS_V2)
                        .build());
            }
            if (dualstack) {
                symbols.add(SymbolUtils.createValueSymbolBuilder("DualStackVariant",
                                SdkGoDependency.INTERNAL_ENDPOINTS_V2)
                        .build());
            }

            if (symbols.size() > 0) {
                for (int i = 0; i < symbols.size(); i++) {
                    if (i != 0) {
                        writer.writeInline("|");
                    }
                    writer.writeInline("$T", symbols.get(i));
                }
            } else {
                writer.writeInline("0");
            }
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Variant that = (Variant) o;
            return isFips() == that.isFips() && isDualstack() == that.isDualstack()
                   && getUnknown().equals(that.getUnknown());
        }

        @Override
        public int hashCode() {
            return Objects.hash(isFips(), isDualstack(), getUnknown());
        }

        public static Builder builder() {
            return new Builder();
        }

        public static Variant fromArrayNode(ArrayNode arrayNode) {
            if (arrayNode.size() == 0) {
                throw new CodegenException("expect one or more variant tags");
            }

            var builder = builder();
            arrayNode.getElements().forEach(node -> {
                var value = node.expectStringNode().getValue();
                if (value.equalsIgnoreCase("fips")) {
                    builder.fips(true);
                } else if (value.equalsIgnoreCase("dualstack")) {
                    builder.dualstack(true);
                } else {
                    builder.addUnknownTag(value);
                }
            });
            return builder.build();
        }

        static class Builder implements SmithyBuilder<Variant> {
            private boolean fips;
            private boolean dualstack;
            private Set<String> unknown = new HashSet<>();

            public Builder fips(boolean fips) {
                this.fips = fips;
                return this;
            }

            public Builder dualstack(boolean dualstack) {
                this.dualstack = dualstack;
                return this;
            }

            public Builder addUnknownTag(String tag) {
                this.unknown.add(tag);
                return this;
            }

            @Override
            public Variant build() {
                return new Variant(this);
            }
        }
    }

    private final class Partition {
        private static final String DEFAULTS_KEY = "defaults";

        private final String id;
        private final ObjectNode config;
        private final Map<Variant, ObjectNode> defaults = new HashMap<>();

        private Partition(ObjectNode config, String partition) {
            id = partition;
            this.config = config;

            // Resolve the partition defaults + the service defaults.
            ObjectNode service = getService();

            // Merge service defaults onto partition defaults ignoring variants key
            ObjectNode serviceDefaults = config.expectObjectMember(DEFAULTS_KEY)
                    .withoutMember(VARIANTS_KEY)
                    .merge(service
                            .getObjectMember(DEFAULTS_KEY)
                            .orElse(Node.objectNode())
                            .withMember(DNS_SUFFIX_KEY, config.expectStringMember(DNS_SUFFIX_KEY))
                            .withoutMember(VARIANTS_KEY));

            Stream.concat(
                            getVariants(config.expectObjectMember(DEFAULTS_KEY), serviceDefaults).stream(),
                            getVariants(service.getObjectMember(DEFAULTS_KEY).orElse(Node.objectNode()),
                                    serviceDefaults).stream()
                    )
                    .collect(Collectors.toMap(
                            objectNode -> Variant.fromArrayNode(objectNode.expectArrayMember("tags")),
                            Function.identity(), ObjectNode::merge))
                    .entrySet()
                    .stream()
                    .filter(entry -> entry.getKey().getUnknown().size() == 0)
                    .forEach(entry -> defaults.put(entry.getKey(), entry.getValue()));

            for (Map.Entry<Variant, ObjectNode> variantObjectNodeEntry : defaults.entrySet()) {
                var objectNode = variantObjectNodeEntry.getValue();
                objectNode = objectNode.withMember(HOSTNAME_KEY, templateHostname(
                        objectNode.expectStringMember(HOSTNAME_KEY)
                                .getValue(),
                        endpointPrefix,
                        objectNode.expectStringMember(DNS_SUFFIX_KEY)
                                .getValue()));
                variantObjectNodeEntry.setValue(objectNode);
            }

            serviceDefaults = serviceDefaults.withMember(HOSTNAME_KEY, templateHostname(
                    serviceDefaults.expectStringMember(HOSTNAME_KEY).getValue(),
                    endpointPrefix,
                    serviceDefaults.expectStringMember(DNS_SUFFIX_KEY).getValue()));

            // the default configuration aka no tag variant
            defaults.put(Variant.builder().build(), serviceDefaults);
        }

        private Set<ObjectNode> getVariants(ObjectNode objectNode, ObjectNode defaults) {
            return objectNode.getArrayMember(VARIANTS_KEY)
                    .orElse(ArrayNode.fromNodes())
                    .getElements()
                    .stream()
                    .map(node -> mergeVariantDefinition(defaults, node.expectObjectNode()))
                    .collect(Collectors.toSet());
        }

        private String templateHostname(String hostname, String service, String dnsSuffix) {
            return hostname
                    .replace("{service}", service)
                    .replace("{dnsSuffix}", dnsSuffix);
        }

        ObjectNode getService() {
            ObjectNode services = config.getObjectMember("services").orElse(Node.objectNode());
            return services.getObjectMember(endpointPrefix).orElse(Node.objectNode());
        }

        ObjectNode getEndpoints() {
            return getService().getObjectMember("endpoints").orElse(Node.objectNode());
        }

        Optional<String> getPartitionEndpoint() {
            ObjectNode service = getService();
            // Note: regionalized services always use regionalized endpoints.
            return service.getBooleanMemberOrDefault("isRegionalized", true)
                    ? Optional.empty()
                    : service.getStringMember("partitionEndpoint").map(StringNode::getValue);
        }

        public Map<Variant, ObjectNode> getDefaults() {
            return defaults;
        }

        public String getId() {
            return id;
        }

        public ObjectNode getConfig() {
            return config;
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder implements SmithyBuilder<EndpointGenerator> {
        private GoSettings settings;
        private Model model;
        private TriConsumer<String, String, Consumer<GoWriter>> writerFactory;
        private boolean internalOnly;
        private boolean modelQueryHelpers;
        private String sdkID;
        private String arnNamespace;

        public Builder settings(GoSettings settings) {
            this.settings = settings;
            return this;
        }

        public Builder model(Model model) {
            this.model = model;
            return this;
        }

        public Builder writerFactory(TriConsumer<String, String, Consumer<GoWriter>> writerFactory) {
            this.writerFactory = writerFactory;
            return this;
        }

        public Builder internalOnly(boolean internalOnly) {
            this.internalOnly = internalOnly;
            return this;
        }

        public Builder modelQueryHelpers(boolean modelQueryHelpers) {
            this.modelQueryHelpers = modelQueryHelpers;
            return this;
        }

        public Builder sdkID(String sdkID) {
            this.sdkID = sdkID;
            return this;
        }

        public Builder arnNamespace(String arnNamespace) {
            this.arnNamespace = arnNamespace;
            return this;
        }

        @Override
        public EndpointGenerator build() {
            return new EndpointGenerator(this);
        }
    }

    enum DualStackEndpointConstant {
        UNSET(DUAL_STACK_ENDPOINT_TYPE_NAME + "Unset"),
        ENABLE(DUAL_STACK_ENDPOINT_TYPE_NAME + "Enabled"),
        DISABLE(DUAL_STACK_ENDPOINT_TYPE_NAME + "Disabled");

        private final String constantName;

        DualStackEndpointConstant(String name) {
            this.constantName = name;
        }

        public String getConstantName() {
            return constantName;
        }

        public Symbol getSymbol() {
            return SymbolUtils.createValueSymbolBuilder(getConstantName(), SdkGoDependency.CORE)
                    .build();
        }
    }

    enum FIPSEndpointConstant {
        UNSET(FIPS_ENDPOINT_TYPE_NAME + "Unset"),
        ENABLE(FIPS_ENDPOINT_TYPE_NAME + "Enabled"),
        DISABLE(FIPS_ENDPOINT_TYPE_NAME + "Disabled");

        private final String constantName;

        FIPSEndpointConstant(String name) {
            this.constantName = name;
        }

        public String getConstantName() {
            return constantName;
        }

        public Symbol getSymbol() {
            return SymbolUtils.createValueSymbolBuilder(getConstantName(), SdkGoDependency.CORE)
                    .build();
        }
    }
}
