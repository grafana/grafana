package software.grafanalabs.smithy.grafana.go.codegen;

import software.amazon.smithy.go.codegen.GoDependency;
import software.amazon.smithy.go.codegen.SmithyGoDependency;

/**
 * A class of constants for dependencies used by this package.
 */
public class AwsGoDependency {
    public static final String MODULE_PATH = "github.com/grafana/grafana/smithy";

    public static final GoDependency REST_JSON_PROTOCOL = sdk("protocol/restjson");
    public static final GoDependency CORE = sdk("aws");
    public static final GoDependency MIDDLEWARE = sdk("middleware", "sdkmiddleware");
    public static final GoDependency RETRY = sdk("retry");
    public static final GoDependency SIGNER_V4 = sdk("signer/v4");
    // public static final GoDependency XML = sdk("protocol/xml", "awsxml");
    public static final GoDependency HTTP_TRANSPORT = sdk("transport/http", "sdkhttp");
    public static final GoDependency SDKTESTING_UNIT = sdk("internal/sdktesting/unit");
    public static final GoDependency SERVICE_INTERNAL_EVENTSTREAM = sdkModuleDep("protocol/eventstream",
            null, Versions.PROTOCOL_EVENTSTREAM, "eventstream");
    public static final GoDependency SERVICE_INTERNAL_EVENTSTREAMAPI = sdkModuleDep("protocol/eventstream",
            "eventstreamapi", Versions.PROTOCOL_EVENTSTREAM, "eventstreamapi");

    public static final GoDependency INTERNAL_ENDPOINTS_V2 = sdkModuleDep("internal/endpoints/v2", null,
            Versions.INTERNAL_ENDPOINTS_V2, "endpoints");
    public static final GoDependency S3_SHARED_CONFIG = sdk("service/internal/s3shared/config", "s3sharedconfig");
    public static final GoDependency SERVICE_INTERNAL_CONFIG = sdkModuleDep("internal/configsources",
            null, Versions.SERVICE_INTERNAL_CONFIG, "internalConfig");
    public static final GoDependency SERVICE_INTERNAL_ENDPOINT_DISCOVERY = sdkModuleDep("service/internal/endpoint-discovery",
            null, Versions.SERVICE_INTERNAL_ENDPOINT_DISCOVERY, "internalEndpointDiscovery");

    public static final GoDependency REGEXP = SmithyGoDependency.stdlib("regexp");

    protected AwsGoDependency() {
    }

    protected static GoDependency sdk(String relativePath) {
        return sdk(relativePath, null);
    }

    protected static GoDependency sdk(String relativePath, String alias) {
        return module(MODULE_PATH, relativePath, Versions.SDK, alias);
    }

    /**
     * sdkModuleDep returns a GoDependency relative to the version of SDK core.
     *
     * @param moduleImportPath the module path within aws sdk to be added as go mod dependency.
     * @param relativePath     the relative path which will be used as import path relative to aws sdk path.
     * @param version          the version of the aws module dependency to be imported
     * @param alias            the go import alias.
     * @return GoDependency
     */
    protected static GoDependency sdkModuleDep(
            String moduleImportPath,
            String relativePath,
            String version,
            String alias
    ) {
        moduleImportPath = MODULE_PATH + "/" + moduleImportPath;
        return module(moduleImportPath, relativePath, version, alias);
    }

    protected static GoDependency module(
            String moduleImportPath,
            String relativePath,
            String version,
            String alias
    ) {
        String importPath = moduleImportPath;
        if (relativePath != null) {
            importPath = importPath + "/" + relativePath;
        }
        return GoDependency.moduleDependency(moduleImportPath, importPath, version, alias);
    }

    private static final class Versions {
        private static final String SDK = "v0.1.0";
        private static final String SERVICE_INTERNAL_CONFIG = "v0.0.0-00010101000000-000000000000";
        private static final String SERVICE_INTERNAL_ENDPOINT_DISCOVERY = "v0.0.0-00010101000000-000000000000";
        private static final String INTERNAL_ENDPOINTS_V2 = "v2.0.0-00010101000000-000000000000";
        private static final String PROTOCOL_EVENTSTREAM = "v0.0.0-00010101000000-000000000000";
    }
}
