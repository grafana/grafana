package software.grafanalabs.smithy.grafana.go.codegen;

import software.amazon.smithy.go.codegen.GoDependency;
import software.amazon.smithy.go.codegen.SmithyGoDependency;

/**
 * A class of constants for dependencies used by this package.
 */
public class AwsGoDependency {
    public static final String AWS_SOURCE_PATH = "github.com/aws/aws-sdk-go-v2";

    public static final GoDependency AWS_REST_JSON_PROTOCOL = aws("aws/protocol/restjson");
    public static final GoDependency AWS_QUERY_PROTOCOL = aws("aws/protocol/query");
    public static final GoDependency AWS_EC2QUERY_PROTOCOL = aws("aws/protocol/ec2query");
    public static final GoDependency AWS_CORE = aws("aws");
    public static final GoDependency AWS_MIDDLEWARE = aws("aws/middleware", "awsmiddleware");
    public static final GoDependency AWS_RETRY = aws("aws/retry");
    public static final GoDependency AWS_SIGNER_V4 = aws("aws/signer/v4");
    public static final GoDependency AWS_XML = aws("aws/protocol/xml", "awsxml");
    public static final GoDependency AWS_HTTP_TRANSPORT = aws("aws/transport/http", "awshttp");
    public static final GoDependency AWSTESTING_UNIT = aws("internal/awstesting/unit");
    public static final GoDependency SERVICE_INTERNAL_EVENTSTREAM = awsModuleDep("aws/protocol/eventstream",
            null, Versions.AWS_PROTOCOL_EVENTSTREAM, "eventstream");
    public static final GoDependency SERVICE_INTERNAL_EVENTSTREAMAPI = awsModuleDep("aws/protocol/eventstream",
            "eventstreamapi", Versions.AWS_PROTOCOL_EVENTSTREAM, "eventstreamapi");

    public static final GoDependency INTERNAL_ENDPOINTS_V2 = awsModuleDep("internal/endpoints/v2", null,
            Versions.INTERNAL_ENDPOINTS_V2, "endpoints");
    public static final GoDependency S3_SHARED_CONFIG = aws("service/internal/s3shared/config", "s3sharedconfig");
    public static final GoDependency SERVICE_INTERNAL_CONFIG = awsModuleDep("internal/configsources",
            null, Versions.SERVICE_INTERNAL_CONFIG, "internalConfig");
    public static final GoDependency SERVICE_INTERNAL_ENDPOINT_DISCOVERY = awsModuleDep("service/internal/endpoint-discovery",
            null, Versions.SERVICE_INTERNAL_ENDPOINT_DISCOVERY, "internalEndpointDiscovery");

    public static final GoDependency REGEXP = SmithyGoDependency.stdlib("regexp");

    protected AwsGoDependency() {
    }

    protected static GoDependency aws(String relativePath) {
        return aws(relativePath, null);
    }

    protected static GoDependency aws(String relativePath, String alias) {
        return module(AWS_SOURCE_PATH, relativePath, Versions.AWS_SDK, alias);
    }

    /**
     * awsModuleDep returns a GoDependency relative to the version of AWS_SDK core.
     *
     * @param moduleImportPath the module path within aws sdk to be added as go mod dependency.
     * @param relativePath     the relative path which will be used as import path relative to aws sdk path.
     * @param version          the version of the aws module dependency to be imported
     * @param alias            the go import alias.
     * @return GoDependency
     */
    protected static GoDependency awsModuleDep(
            String moduleImportPath,
            String relativePath,
            String version,
            String alias
    ) {
        moduleImportPath = AWS_SOURCE_PATH + "/" + moduleImportPath;
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
        private static final String AWS_SDK = "v1.4.0";
        private static final String SERVICE_INTERNAL_CONFIG = "v0.0.0-00010101000000-000000000000";
        private static final String SERVICE_INTERNAL_ENDPOINT_DISCOVERY = "v0.0.0-00010101000000-000000000000";
        private static final String INTERNAL_ENDPOINTS_V2 = "v2.0.0-00010101000000-000000000000";
        private static final String AWS_PROTOCOL_EVENTSTREAM = "v0.0.0-00010101000000-000000000000";
    }
}
