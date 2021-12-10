package software.grafanalabs.smithy.grafana.go.codegen;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.logging.Logger;

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
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.ListUtils;

/**
 * Registers additional AWS specific client configuration fields
 */
public class AddAwsConfigFields implements GoIntegration {
    private static final Logger LOGGER = Logger.getLogger(AddAwsConfigFields.class.getName());

    public static final String REGION_CONFIG_NAME = "Region";
    public static final String CREDENTIALS_CONFIG_NAME = "Credentials";
    public static final String ENDPOINT_RESOLVER_CONFIG_NAME = "EndpointResolver";
    public static final String AWS_ENDPOINT_RESOLVER_WITH_OPTIONS = "EndpointResolverWithOptions";
    public static final String HTTP_CLIENT_CONFIG_NAME = "HTTPClient";
    public static final String RETRYER_CONFIG_NAME = "Retryer";
    public static final String API_OPTIONS_CONFIG_NAME = "APIOptions";
    public static final String LOGGER_CONFIG_NAME = "Logger";
    public static final String LOG_MODE_CONFIG_NAME = "ClientLogMode";

    private static final String RESOLVE_HTTP_CLIENT = "resolveHTTPClient";
    private static final String RESOLVE_RETRYER = "resolveRetryer";
    private static final String RESOLVE_AWS_CONFIG_ENDPOINT_RESOLVER = "resolveAWSEndpointResolver";
    private static final String RESOLVE_AWS_CONFIG_RETRYER_PROVIDER = "resolveAWSRetryerProvider";

    private static final List<AwsConfigField> AWS_CONFIG_FIELDS = ListUtils.of(
            AwsConfigField.builder()
                    .name(REGION_CONFIG_NAME)
                    .type(getUniversalSymbol("string"))
                    .documentation("The region to send requests to. (Required)")
                    .build(),
            AwsConfigField.builder()
                    .name(RETRYER_CONFIG_NAME)
                    .type(getAwsCoreSymbol("Retryer"))
                    .documentation("Retryer guides how HTTP requests should be retried in case of\n"
                                   + "recoverable failures. When nil the API client will use a default\n"
                                   + "retryer.")
                    .addConfigFieldResolvers(getClientInitializationResolver(
                            SymbolUtils.createValueSymbolBuilder(RESOLVE_RETRYER).build())
                            .build()
                    )
                    .awsResolveFunction(SymbolUtils.createValueSymbolBuilder(RESOLVE_AWS_CONFIG_RETRYER_PROVIDER)
                            .build())
                    .build(),
            AwsConfigField.builder()
                    .name(HTTP_CLIENT_CONFIG_NAME)
                    .type(SymbolUtils.createValueSymbolBuilder("HTTPClient").build())
                    .generatedOnClient(false)
                    .addConfigFieldResolvers(getClientInitializationResolver(
                            SymbolUtils.createValueSymbolBuilder(RESOLVE_HTTP_CLIENT).build())
                            .build())
                    .build(),
            AwsConfigField.builder()
                    .name(CREDENTIALS_CONFIG_NAME)
                    .type(getAwsCoreSymbol("CredentialsProvider"))
                    .documentation("The credentials object to use when signing requests.")
                    .servicePredicate(AwsSignatureVersion4::isSupportedAuthentication)
                    .build(),
            AwsConfigField.builder()
                    .name(API_OPTIONS_CONFIG_NAME)
                    .type(SymbolUtils.createValueSymbolBuilder("[]func(*middleware.Stack) error")
                            .addDependency(SmithyGoDependency.SMITHY_MIDDLEWARE).build())
                    .documentation("API stack mutators")
                    .generatedOnClient(false)
                    .build(),
            AwsConfigField.builder()
                    .name(ENDPOINT_RESOLVER_CONFIG_NAME)
                    .type(getAwsCoreSymbol("EndpointResolver"))
                    .generatedOnClient(false)
                    .awsResolveFunction(SymbolUtils.createValueSymbolBuilder(RESOLVE_AWS_CONFIG_ENDPOINT_RESOLVER)
                            .build())
                    .build(),
            AwsConfigField.builder()
                    .name(LOGGER_CONFIG_NAME)
                    .type(getAwsCoreSymbol("Logger"))
                    .generatedOnClient(false)
                    .build(),
            AwsConfigField.builder()
                    .name(LOG_MODE_CONFIG_NAME)
                    .type(getAwsCoreSymbol("ClientLogMode"))
                    .documentation("Configures the events that will be sent to the configured logger.")
                    .build()
    );

    private static Symbol getAwsCoreSymbol(String symbolName) {
        return SymbolUtils.createValueSymbolBuilder(symbolName,
                AwsGoDependency.AWS_CORE).build();
    }

    private static Symbol getAwsSignerV4Symbol(String symbolName) {
        return SymbolUtils.createValueSymbolBuilder(symbolName,
                AwsGoDependency.AWS_SIGNER_V4).build();
    }

    private static Symbol getUniversalSymbol(String symbolName) {
        return SymbolUtils.createValueSymbolBuilder(symbolName)
                .putProperty(SymbolUtils.GO_UNIVERSE_TYPE, true).build();
    }

    private static Symbol getAwsRetrySymbol(String symbolName) {
        return SymbolUtils.createValueSymbolBuilder(symbolName,
                AwsGoDependency.AWS_RETRY).build();
    }

    /**
     * Gets the sort order of the customization from -128 to 127, with lowest
     * executed first.
     *
     * @return Returns the sort order, defaults to -50.
     */
    @Override
    public byte getOrder() {
        return -50;
    }

    @Override
    public void writeAdditionalFiles(
            GoSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            GoDelegator goDelegator
    ) {
        LOGGER.info("generating aws.Config based client constructor");
        ServiceShape serviceShape = settings.getService(model);
        goDelegator.useShapeWriter(serviceShape, w -> {
            writeAwsConfigConstructor(model, serviceShape, w);
            writeAwsDefaultResolvers(w);
        });
    }

    private static ConfigFieldResolver.Builder getClientInitializationResolver(Symbol resolver) {
        return ConfigFieldResolver.builder()
                .location(ConfigFieldResolver.Location.CLIENT)
                .target(ConfigFieldResolver.Target.INITIALIZATION)
                .resolver(resolver);
    }

    private void writeAwsDefaultResolvers(GoWriter writer) {
        writeHttpClientResolver(writer);
        writeRetryerResolvers(writer);
        writeAwsConfigEndpointResolver(writer);
    }

    private void writeRetryerResolvers(GoWriter writer) {
        writer.openBlock("func $L(o *Options) {", "}", RESOLVE_RETRYER, () -> {
            writer.openBlock("if o.$L != nil {", "}", RETRYER_CONFIG_NAME, () -> writer.write("return"));
            writer.write("o.$L = $T()", RETRYER_CONFIG_NAME, SymbolUtils.createValueSymbolBuilder("NewStandard",
                    AwsGoDependency.AWS_RETRY).build());
        });
        writer.write("");
        writer.openBlock("func $L(cfg aws.Config, o *Options) {", "}", RESOLVE_AWS_CONFIG_RETRYER_PROVIDER, () -> {
            writer.openBlock("if cfg.$L == nil {", "}", RETRYER_CONFIG_NAME, () -> writer.write("return"));
            writer.write("o.$L = cfg.$L()", RETRYER_CONFIG_NAME, RETRYER_CONFIG_NAME);
        });
        writer.write("");
    }

    private void writeHttpClientResolver(GoWriter writer) {
        writer.openBlock("func $L(o *Options) {", "}", RESOLVE_HTTP_CLIENT, () -> {
            writer.openBlock("if o.$L != nil {", "}", HTTP_CLIENT_CONFIG_NAME, () -> writer.write("return"));
            writer.write("o.$L = $T()", HTTP_CLIENT_CONFIG_NAME,
                    SymbolUtils.createValueSymbolBuilder("NewBuildableClient",
                            AwsGoDependency.AWS_HTTP_TRANSPORT).build());
        });
        writer.write("");
    }

    private void writeAwsConfigEndpointResolver(GoWriter writer) {
        writer.pushState();
        writer.putContext("resolverName", RESOLVE_AWS_CONFIG_ENDPOINT_RESOLVER);
        writer.putContext("clientOption", ENDPOINT_RESOLVER_CONFIG_NAME);
        writer.putContext("wrapperHelper", EndpointGenerator.AWS_ENDPOINT_RESOLVER_HELPER);
        writer.putContext("awsResolver", ENDPOINT_RESOLVER_CONFIG_NAME);
        writer.putContext("awsResolverWithOptions", AWS_ENDPOINT_RESOLVER_WITH_OPTIONS);
        writer.putContext("newResolver", EndpointGenerator.RESOLVER_CONSTRUCTOR_NAME);
        writer.write("""
                     func $resolverName:L(cfg aws.Config, o *Options) {
                         if cfg.$awsResolver:L == nil && cfg.$awsResolverWithOptions:L == nil {
                             return
                         }
                         o.$clientOption:L = $wrapperHelper:L(cfg.$awsResolver:L, cfg.$awsResolverWithOptions:L, $newResolver:L())
                     }
                     """);
        writer.popState();
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        List<RuntimeClientPlugin> plugins = new ArrayList<>();

        AWS_CONFIG_FIELDS.forEach(awsConfigField -> {
            RuntimeClientPlugin.Builder builder = RuntimeClientPlugin.builder();
            awsConfigField.getServicePredicate().ifPresent(
                    builder::servicePredicate);
            if (awsConfigField.isGeneratedOnClient()) {
                builder.addConfigField(awsConfigField);
            }
            builder.configFieldResolvers(awsConfigField.getConfigFieldResolvers());
            plugins.add(builder.build());
        });

        return plugins;
    }

    private void writeAwsConfigConstructor(Model model, ServiceShape service, GoWriter writer) {
        writer.writeDocs("NewFromConfig returns a new client from the provided config.");
        writer.openBlock("func NewFromConfig(cfg $T, optFns ... func(*Options)) *Client {", "}",
                getAwsCoreSymbol("Config"), () -> {
                    writer.openBlock("opts := Options{", "}", () -> {
                        for (AwsConfigField field : AWS_CONFIG_FIELDS) {
                            if (field.getServicePredicate().isPresent()) {
                                if (!field.getServicePredicate().get().test(model, service)) {
                                    continue;
                                }
                            }
                            if (field.getAwsResolverFunction().isPresent()) {
                                continue;
                            }
                            writer.write("$L: cfg.$L,", field.getName(), field.getName());
                        }
                    });


                    List<AwsConfigField> configFields = new ArrayList<>(AWS_CONFIG_FIELDS);

                    for (AwsConfigField field : configFields) {
                        Optional<Symbol> awsResolverFunction = field.getAwsResolverFunction();
                        if (!awsResolverFunction.isPresent()) {
                            continue;
                        }
                        if (field.getServicePredicate().isPresent()) {
                            if (!field.getServicePredicate().get().test(model, service)) {
                                continue;
                            }
                        }
                        writer.write("$L(cfg, &opts)", awsResolverFunction.get());
                    }

                    writer.write("return New(opts, optFns...)");
                });
        writer.write("");
    }

    /**
     * Provides configuration field for AWS client.
     */
    public static class AwsConfigField extends ConfigField {
        private final boolean generatedOnClient;
        private final BiPredicate<Model, ServiceShape> servicePredicate;
        private final Set<ConfigFieldResolver> configFieldResolvers;
        private final Symbol awsResolveFunction;

        private AwsConfigField(Builder builder) {
            super(builder);
            this.generatedOnClient = builder.generatedOnClient;
            this.servicePredicate = builder.servicePredicate;
            this.configFieldResolvers = builder.configFieldResolvers;
            this.awsResolveFunction = builder.awsResolveFunction;
        }

        public boolean isGeneratedOnClient() {
            return generatedOnClient;
        }

        public Optional<BiPredicate<Model, ServiceShape>> getServicePredicate() {
            return Optional.ofNullable(servicePredicate);
        }

        public Set<ConfigFieldResolver> getConfigFieldResolvers() {
            return this.configFieldResolvers;
        }

        public Optional<Symbol> getAwsResolverFunction() {
            return Optional.ofNullable(awsResolveFunction);
        }

        public static Builder builder() {
            return new Builder();
        }

        /**
         * Provides builder for AWSConfigFile values.
         */
        public static class Builder extends ConfigField.Builder {
            private boolean generatedOnClient = true;
            private BiPredicate<Model, ServiceShape> servicePredicate = null;
            private Set<ConfigFieldResolver> configFieldResolvers = new HashSet<>();
            private Symbol awsResolveFunction = null;

            private Builder() {
                super();
            }

            /**
             * This sets the Config field on Client Options structure. By default this is true.
             * If set to false, this field won't be generated on the Client options, but will be used by
             * the NewFromConfig (to copy values from the aws config to client options).
             *
             * @param generatedOnClient bool indicating config field generation on client option structure
             * @return
             */
            public Builder generatedOnClient(boolean generatedOnClient) {
                this.generatedOnClient = generatedOnClient;
                return this;
            }

            public Builder servicePredicate(BiPredicate<Model, ServiceShape> servicePredicate) {
                this.servicePredicate = servicePredicate;
                return this;
            }

            public Builder configFieldResolvers(Collection<ConfigFieldResolver> configFieldResolvers) {
                this.configFieldResolvers = new HashSet<>(configFieldResolvers);
                return this;
            }

            public Builder addConfigFieldResolvers(ConfigFieldResolver configFieldResolver) {
                this.configFieldResolvers.add(configFieldResolver);
                return this;
            }

            public Builder awsResolveFunction(Symbol awsResolveFunction) {
                this.awsResolveFunction = awsResolveFunction;
                return this;
            }

            @Override
            public AwsConfigField build() {
                return new AwsConfigField(this);
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

            @Override
            public Builder withHelper(Boolean withHelper) {
                super.withHelper(withHelper);
                return this;
            }

            @Override
            public Builder withHelper() {
                super.withHelper();
                return this;
            }
        }
    }
}
