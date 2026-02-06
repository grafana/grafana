package mock

// Code generated; DO NOT EDIT.

var GetSlash EndpointPattern = EndpointPattern{
	Pattern: "/",
	Method:  "GET",
}

var GetAdvisories EndpointPattern = EndpointPattern{
	Pattern: "/advisories",
	Method:  "GET",
}

var GetAdvisoriesByGhsaId EndpointPattern = EndpointPattern{
	Pattern: "/advisories/{ghsa_id}",
	Method:  "GET",
}

var GetApp EndpointPattern = EndpointPattern{
	Pattern: "/app",
	Method:  "GET",
}

var PostAppManifestsConversionsByCode EndpointPattern = EndpointPattern{
	Pattern: "/app-manifests/{code}/conversions",
	Method:  "POST",
}

var GetAppHookConfig EndpointPattern = EndpointPattern{
	Pattern: "/app/hook/config",
	Method:  "GET",
}

var PatchAppHookConfig EndpointPattern = EndpointPattern{
	Pattern: "/app/hook/config",
	Method:  "PATCH",
}

var GetAppHookDeliveries EndpointPattern = EndpointPattern{
	Pattern: "/app/hook/deliveries",
	Method:  "GET",
}

var GetAppHookDeliveriesByDeliveryId EndpointPattern = EndpointPattern{
	Pattern: "/app/hook/deliveries/{delivery_id}",
	Method:  "GET",
}

var PostAppHookDeliveriesAttemptsByDeliveryId EndpointPattern = EndpointPattern{
	Pattern: "/app/hook/deliveries/{delivery_id}/attempts",
	Method:  "POST",
}

var GetAppInstallationRequests EndpointPattern = EndpointPattern{
	Pattern: "/app/installation-requests",
	Method:  "GET",
}

var GetAppInstallations EndpointPattern = EndpointPattern{
	Pattern: "/app/installations",
	Method:  "GET",
}

var GetAppInstallationsByInstallationId EndpointPattern = EndpointPattern{
	Pattern: "/app/installations/{installation_id}",
	Method:  "GET",
}

var DeleteAppInstallationsByInstallationId EndpointPattern = EndpointPattern{
	Pattern: "/app/installations/{installation_id}",
	Method:  "DELETE",
}

var PostAppInstallationsAccessTokensByInstallationId EndpointPattern = EndpointPattern{
	Pattern: "/app/installations/{installation_id}/access_tokens",
	Method:  "POST",
}

var PutAppInstallationsSuspendedByInstallationId EndpointPattern = EndpointPattern{
	Pattern: "/app/installations/{installation_id}/suspended",
	Method:  "PUT",
}

var DeleteAppInstallationsSuspendedByInstallationId EndpointPattern = EndpointPattern{
	Pattern: "/app/installations/{installation_id}/suspended",
	Method:  "DELETE",
}

var DeleteApplicationsGrantByClientId EndpointPattern = EndpointPattern{
	Pattern: "/applications/{client_id}/grant",
	Method:  "DELETE",
}

var PostApplicationsTokenByClientId EndpointPattern = EndpointPattern{
	Pattern: "/applications/{client_id}/token",
	Method:  "POST",
}

var PatchApplicationsTokenByClientId EndpointPattern = EndpointPattern{
	Pattern: "/applications/{client_id}/token",
	Method:  "PATCH",
}

var DeleteApplicationsTokenByClientId EndpointPattern = EndpointPattern{
	Pattern: "/applications/{client_id}/token",
	Method:  "DELETE",
}

var PostApplicationsTokenScopedByClientId EndpointPattern = EndpointPattern{
	Pattern: "/applications/{client_id}/token/scoped",
	Method:  "POST",
}

var GetAppsByAppSlug EndpointPattern = EndpointPattern{
	Pattern: "/apps/{app_slug}",
	Method:  "GET",
}

var GetAssignmentsByAssignmentId EndpointPattern = EndpointPattern{
	Pattern: "/assignments/{assignment_id}",
	Method:  "GET",
}

var GetAssignmentsAcceptedAssignmentsByAssignmentId EndpointPattern = EndpointPattern{
	Pattern: "/assignments/{assignment_id}/accepted_assignments",
	Method:  "GET",
}

var GetAssignmentsGradesByAssignmentId EndpointPattern = EndpointPattern{
	Pattern: "/assignments/{assignment_id}/grades",
	Method:  "GET",
}

var GetClassrooms EndpointPattern = EndpointPattern{
	Pattern: "/classrooms",
	Method:  "GET",
}

var GetClassroomsByClassroomId EndpointPattern = EndpointPattern{
	Pattern: "/classrooms/{classroom_id}",
	Method:  "GET",
}

var GetClassroomsAssignmentsByClassroomId EndpointPattern = EndpointPattern{
	Pattern: "/classrooms/{classroom_id}/assignments",
	Method:  "GET",
}

var GetCodesOfConduct EndpointPattern = EndpointPattern{
	Pattern: "/codes_of_conduct",
	Method:  "GET",
}

var GetCodesOfConductByKey EndpointPattern = EndpointPattern{
	Pattern: "/codes_of_conduct/{key}",
	Method:  "GET",
}

var PostCredentialsRevoke EndpointPattern = EndpointPattern{
	Pattern: "/credentials/revoke",
	Method:  "POST",
}

var GetEmojis EndpointPattern = EndpointPattern{
	Pattern: "/emojis",
	Method:  "GET",
}

var GetEnterprisesCodeSecurityConfigurationsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations",
	Method:  "GET",
}

var PostEnterprisesCodeSecurityConfigurationsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations",
	Method:  "POST",
}

var GetEnterprisesCodeSecurityConfigurationsDefaultsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations/defaults",
	Method:  "GET",
}

var GetEnterprisesCodeSecurityConfigurationsByEnterpriseByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations/{configuration_id}",
	Method:  "GET",
}

var PatchEnterprisesCodeSecurityConfigurationsByEnterpriseByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations/{configuration_id}",
	Method:  "PATCH",
}

var DeleteEnterprisesCodeSecurityConfigurationsByEnterpriseByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations/{configuration_id}",
	Method:  "DELETE",
}

var PostEnterprisesCodeSecurityConfigurationsAttachByEnterpriseByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations/{configuration_id}/attach",
	Method:  "POST",
}

var PutEnterprisesCodeSecurityConfigurationsDefaultsByEnterpriseByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations/{configuration_id}/defaults",
	Method:  "PUT",
}

var GetEnterprisesCodeSecurityConfigurationsRepositoriesByEnterpriseByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-security/configurations/{configuration_id}/repositories",
	Method:  "GET",
}

var GetEnterprisesDependabotAlertsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/dependabot/alerts",
	Method:  "GET",
}

var GetEnterprisesSecretScanningAlertsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/secret-scanning/alerts",
	Method:  "GET",
}

var GetEvents EndpointPattern = EndpointPattern{
	Pattern: "/events",
	Method:  "GET",
}

var GetFeeds EndpointPattern = EndpointPattern{
	Pattern: "/feeds",
	Method:  "GET",
}

var GetGists EndpointPattern = EndpointPattern{
	Pattern: "/gists",
	Method:  "GET",
}

var PostGists EndpointPattern = EndpointPattern{
	Pattern: "/gists",
	Method:  "POST",
}

var GetGistsPublic EndpointPattern = EndpointPattern{
	Pattern: "/gists/public",
	Method:  "GET",
}

var GetGistsStarred EndpointPattern = EndpointPattern{
	Pattern: "/gists/starred",
	Method:  "GET",
}

var GetGistsByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}",
	Method:  "GET",
}

var PatchGistsByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}",
	Method:  "PATCH",
}

var DeleteGistsByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}",
	Method:  "DELETE",
}

var GetGistsCommentsByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/comments",
	Method:  "GET",
}

var PostGistsCommentsByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/comments",
	Method:  "POST",
}

var GetGistsCommentsByGistIdByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/comments/{comment_id}",
	Method:  "GET",
}

var PatchGistsCommentsByGistIdByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/comments/{comment_id}",
	Method:  "PATCH",
}

var DeleteGistsCommentsByGistIdByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/comments/{comment_id}",
	Method:  "DELETE",
}

var GetGistsCommitsByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/commits",
	Method:  "GET",
}

var GetGistsForksByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/forks",
	Method:  "GET",
}

var PostGistsForksByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/forks",
	Method:  "POST",
}

var GetGistsStarByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/star",
	Method:  "GET",
}

var PutGistsStarByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/star",
	Method:  "PUT",
}

var DeleteGistsStarByGistId EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/star",
	Method:  "DELETE",
}

var GetGistsByGistIdBySha EndpointPattern = EndpointPattern{
	Pattern: "/gists/{gist_id}/{sha}",
	Method:  "GET",
}

var GetGitignoreTemplates EndpointPattern = EndpointPattern{
	Pattern: "/gitignore/templates",
	Method:  "GET",
}

var GetGitignoreTemplatesByName EndpointPattern = EndpointPattern{
	Pattern: "/gitignore/templates/{name}",
	Method:  "GET",
}

var GetInstallationRepositories EndpointPattern = EndpointPattern{
	Pattern: "/installation/repositories",
	Method:  "GET",
}

var DeleteInstallationToken EndpointPattern = EndpointPattern{
	Pattern: "/installation/token",
	Method:  "DELETE",
}

var GetIssues EndpointPattern = EndpointPattern{
	Pattern: "/issues",
	Method:  "GET",
}

var GetLicenses EndpointPattern = EndpointPattern{
	Pattern: "/licenses",
	Method:  "GET",
}

var GetLicensesByLicense EndpointPattern = EndpointPattern{
	Pattern: "/licenses/{license}",
	Method:  "GET",
}

var PostMarkdown EndpointPattern = EndpointPattern{
	Pattern: "/markdown",
	Method:  "POST",
}

var PostMarkdownRaw EndpointPattern = EndpointPattern{
	Pattern: "/markdown/raw",
	Method:  "POST",
}

var GetMarketplaceListingAccountsByAccountId EndpointPattern = EndpointPattern{
	Pattern: "/marketplace_listing/accounts/{account_id}",
	Method:  "GET",
}

var GetMarketplaceListingPlans EndpointPattern = EndpointPattern{
	Pattern: "/marketplace_listing/plans",
	Method:  "GET",
}

var GetMarketplaceListingPlansAccountsByPlanId EndpointPattern = EndpointPattern{
	Pattern: "/marketplace_listing/plans/{plan_id}/accounts",
	Method:  "GET",
}

var GetMarketplaceListingStubbedAccountsByAccountId EndpointPattern = EndpointPattern{
	Pattern: "/marketplace_listing/stubbed/accounts/{account_id}",
	Method:  "GET",
}

var GetMarketplaceListingStubbedPlans EndpointPattern = EndpointPattern{
	Pattern: "/marketplace_listing/stubbed/plans",
	Method:  "GET",
}

var GetMarketplaceListingStubbedPlansAccountsByPlanId EndpointPattern = EndpointPattern{
	Pattern: "/marketplace_listing/stubbed/plans/{plan_id}/accounts",
	Method:  "GET",
}

var GetMeta EndpointPattern = EndpointPattern{
	Pattern: "/meta",
	Method:  "GET",
}

var GetNetworksEventsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/networks/{owner}/{repo}/events",
	Method:  "GET",
}

var GetNotifications EndpointPattern = EndpointPattern{
	Pattern: "/notifications",
	Method:  "GET",
}

var PutNotifications EndpointPattern = EndpointPattern{
	Pattern: "/notifications",
	Method:  "PUT",
}

var GetNotificationsThreadsByThreadId EndpointPattern = EndpointPattern{
	Pattern: "/notifications/threads/{thread_id}",
	Method:  "GET",
}

var PatchNotificationsThreadsByThreadId EndpointPattern = EndpointPattern{
	Pattern: "/notifications/threads/{thread_id}",
	Method:  "PATCH",
}

var DeleteNotificationsThreadsByThreadId EndpointPattern = EndpointPattern{
	Pattern: "/notifications/threads/{thread_id}",
	Method:  "DELETE",
}

var GetNotificationsThreadsSubscriptionByThreadId EndpointPattern = EndpointPattern{
	Pattern: "/notifications/threads/{thread_id}/subscription",
	Method:  "GET",
}

var PutNotificationsThreadsSubscriptionByThreadId EndpointPattern = EndpointPattern{
	Pattern: "/notifications/threads/{thread_id}/subscription",
	Method:  "PUT",
}

var DeleteNotificationsThreadsSubscriptionByThreadId EndpointPattern = EndpointPattern{
	Pattern: "/notifications/threads/{thread_id}/subscription",
	Method:  "DELETE",
}

var GetOctocat EndpointPattern = EndpointPattern{
	Pattern: "/octocat",
	Method:  "GET",
}

var GetOrganizations EndpointPattern = EndpointPattern{
	Pattern: "/organizations",
	Method:  "GET",
}

var GetOrganizationsDependabotRepositoryAccessByOrg EndpointPattern = EndpointPattern{
	Pattern: "/organizations/{org}/dependabot/repository-access",
	Method:  "GET",
}

var PatchOrganizationsDependabotRepositoryAccessByOrg EndpointPattern = EndpointPattern{
	Pattern: "/organizations/{org}/dependabot/repository-access",
	Method:  "PATCH",
}

var PutOrganizationsDependabotRepositoryAccessDefaultLevelByOrg EndpointPattern = EndpointPattern{
	Pattern: "/organizations/{org}/dependabot/repository-access/default-level",
	Method:  "PUT",
}

var GetOrganizationsSettingsBillingUsageByOrg EndpointPattern = EndpointPattern{
	Pattern: "/organizations/{org}/settings/billing/usage",
	Method:  "GET",
}

var GetOrgsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}",
	Method:  "GET",
}

var PatchOrgsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}",
	Method:  "PATCH",
}

var DeleteOrgsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}",
	Method:  "DELETE",
}

var GetOrgsActionsCacheUsageByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/cache/usage",
	Method:  "GET",
}

var GetOrgsActionsCacheUsageByRepositoryByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/cache/usage-by-repository",
	Method:  "GET",
}

var GetOrgsActionsHostedRunnersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners",
	Method:  "GET",
}

var PostOrgsActionsHostedRunnersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners",
	Method:  "POST",
}

var GetOrgsActionsHostedRunnersImagesGithubOwnedByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/images/github-owned",
	Method:  "GET",
}

var GetOrgsActionsHostedRunnersImagesPartnerByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/images/partner",
	Method:  "GET",
}

var GetOrgsActionsHostedRunnersLimitsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/limits",
	Method:  "GET",
}

var GetOrgsActionsHostedRunnersMachineSizesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/machine-sizes",
	Method:  "GET",
}

var GetOrgsActionsHostedRunnersPlatformsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/platforms",
	Method:  "GET",
}

var GetOrgsActionsHostedRunnersByOrgByHostedRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/{hosted_runner_id}",
	Method:  "GET",
}

var PatchOrgsActionsHostedRunnersByOrgByHostedRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/{hosted_runner_id}",
	Method:  "PATCH",
}

var DeleteOrgsActionsHostedRunnersByOrgByHostedRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/hosted-runners/{hosted_runner_id}",
	Method:  "DELETE",
}

var GetOrgsActionsOidcCustomizationSubByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/oidc/customization/sub",
	Method:  "GET",
}

var PutOrgsActionsOidcCustomizationSubByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/oidc/customization/sub",
	Method:  "PUT",
}

var GetOrgsActionsPermissionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions",
	Method:  "GET",
}

var PutOrgsActionsPermissionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions",
	Method:  "PUT",
}

var GetOrgsActionsPermissionsRepositoriesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/repositories",
	Method:  "GET",
}

var PutOrgsActionsPermissionsRepositoriesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/repositories",
	Method:  "PUT",
}

var PutOrgsActionsPermissionsRepositoriesByOrgByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteOrgsActionsPermissionsRepositoriesByOrgByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/repositories/{repository_id}",
	Method:  "DELETE",
}

var GetOrgsActionsPermissionsSelectedActionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/selected-actions",
	Method:  "GET",
}

var PutOrgsActionsPermissionsSelectedActionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/selected-actions",
	Method:  "PUT",
}

var GetOrgsActionsPermissionsWorkflowByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/workflow",
	Method:  "GET",
}

var PutOrgsActionsPermissionsWorkflowByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/permissions/workflow",
	Method:  "PUT",
}

var GetOrgsActionsRunnerGroupsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups",
	Method:  "GET",
}

var PostOrgsActionsRunnerGroupsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups",
	Method:  "POST",
}

var GetOrgsActionsRunnerGroupsByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}",
	Method:  "GET",
}

var PatchOrgsActionsRunnerGroupsByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}",
	Method:  "PATCH",
}

var DeleteOrgsActionsRunnerGroupsByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}",
	Method:  "DELETE",
}

var GetOrgsActionsRunnerGroupsHostedRunnersByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/hosted-runners",
	Method:  "GET",
}

var GetOrgsActionsRunnerGroupsRepositoriesByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/repositories",
	Method:  "GET",
}

var PutOrgsActionsRunnerGroupsRepositoriesByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/repositories",
	Method:  "PUT",
}

var PutOrgsActionsRunnerGroupsRepositoriesByOrgByRunnerGroupIdByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteOrgsActionsRunnerGroupsRepositoriesByOrgByRunnerGroupIdByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}",
	Method:  "DELETE",
}

var GetOrgsActionsRunnerGroupsRunnersByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/runners",
	Method:  "GET",
}

var PutOrgsActionsRunnerGroupsRunnersByOrgByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/runners",
	Method:  "PUT",
}

var PutOrgsActionsRunnerGroupsRunnersByOrgByRunnerGroupIdByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}",
	Method:  "PUT",
}

var DeleteOrgsActionsRunnerGroupsRunnersByOrgByRunnerGroupIdByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}",
	Method:  "DELETE",
}

var GetOrgsActionsRunnersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners",
	Method:  "GET",
}

var GetOrgsActionsRunnersDownloadsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/downloads",
	Method:  "GET",
}

var PostOrgsActionsRunnersGenerateJitconfigByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/generate-jitconfig",
	Method:  "POST",
}

var PostOrgsActionsRunnersRegistrationTokenByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/registration-token",
	Method:  "POST",
}

var PostOrgsActionsRunnersRemoveTokenByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/remove-token",
	Method:  "POST",
}

var GetOrgsActionsRunnersByOrgByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/{runner_id}",
	Method:  "GET",
}

var DeleteOrgsActionsRunnersByOrgByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/{runner_id}",
	Method:  "DELETE",
}

var GetOrgsActionsRunnersLabelsByOrgByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/{runner_id}/labels",
	Method:  "GET",
}

var PostOrgsActionsRunnersLabelsByOrgByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/{runner_id}/labels",
	Method:  "POST",
}

var PutOrgsActionsRunnersLabelsByOrgByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/{runner_id}/labels",
	Method:  "PUT",
}

var DeleteOrgsActionsRunnersLabelsByOrgByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/{runner_id}/labels",
	Method:  "DELETE",
}

var DeleteOrgsActionsRunnersLabelsByOrgByRunnerIdByName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/runners/{runner_id}/labels/{name:.+}",
	Method:  "DELETE",
}

var GetOrgsActionsSecretsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets",
	Method:  "GET",
}

var GetOrgsActionsSecretsPublicKeyByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/public-key",
	Method:  "GET",
}

var GetOrgsActionsSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/{secret_name}",
	Method:  "GET",
}

var PutOrgsActionsSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteOrgsActionsSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetOrgsActionsSecretsRepositoriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/{secret_name}/repositories",
	Method:  "GET",
}

var PutOrgsActionsSecretsRepositoriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/{secret_name}/repositories",
	Method:  "PUT",
}

var PutOrgsActionsSecretsRepositoriesByOrgBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteOrgsActionsSecretsRepositoriesByOrgBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "DELETE",
}

var GetOrgsActionsVariablesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables",
	Method:  "GET",
}

var PostOrgsActionsVariablesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables",
	Method:  "POST",
}

var GetOrgsActionsVariablesByOrgByName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables/{name}",
	Method:  "GET",
}

var PatchOrgsActionsVariablesByOrgByName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables/{name}",
	Method:  "PATCH",
}

var DeleteOrgsActionsVariablesByOrgByName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables/{name}",
	Method:  "DELETE",
}

var GetOrgsActionsVariablesRepositoriesByOrgByName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables/{name}/repositories",
	Method:  "GET",
}

var PutOrgsActionsVariablesRepositoriesByOrgByName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables/{name}/repositories",
	Method:  "PUT",
}

var PutOrgsActionsVariablesRepositoriesByOrgByNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables/{name}/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteOrgsActionsVariablesRepositoriesByOrgByNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/actions/variables/{name}/repositories/{repository_id}",
	Method:  "DELETE",
}

var PostOrgsAttestationsBulkListByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/attestations/bulk-list",
	Method:  "POST",
}

var PostOrgsAttestationsDeleteRequestByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/attestations/delete-request",
	Method:  "POST",
}

var DeleteOrgsAttestationsDigestByOrgBySubjectDigest EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/attestations/digest/{subject_digest}",
	Method:  "DELETE",
}

var DeleteOrgsAttestationsByOrgByAttestationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/attestations/{attestation_id}",
	Method:  "DELETE",
}

var GetOrgsAttestationsByOrgBySubjectDigest EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/attestations/{subject_digest}",
	Method:  "GET",
}

var GetOrgsBlocksByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/blocks",
	Method:  "GET",
}

var GetOrgsBlocksByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/blocks/{username}",
	Method:  "GET",
}

var PutOrgsBlocksByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/blocks/{username}",
	Method:  "PUT",
}

var DeleteOrgsBlocksByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/blocks/{username}",
	Method:  "DELETE",
}

var GetOrgsCampaignsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/campaigns",
	Method:  "GET",
}

var PostOrgsCampaignsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/campaigns",
	Method:  "POST",
}

var GetOrgsCampaignsByOrgByCampaignNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/campaigns/{campaign_number}",
	Method:  "GET",
}

var PatchOrgsCampaignsByOrgByCampaignNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/campaigns/{campaign_number}",
	Method:  "PATCH",
}

var DeleteOrgsCampaignsByOrgByCampaignNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/campaigns/{campaign_number}",
	Method:  "DELETE",
}

var GetOrgsCodeScanningAlertsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-scanning/alerts",
	Method:  "GET",
}

var GetOrgsCodeSecurityConfigurationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations",
	Method:  "GET",
}

var PostOrgsCodeSecurityConfigurationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations",
	Method:  "POST",
}

var GetOrgsCodeSecurityConfigurationsDefaultsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/defaults",
	Method:  "GET",
}

var DeleteOrgsCodeSecurityConfigurationsDetachByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/detach",
	Method:  "DELETE",
}

var GetOrgsCodeSecurityConfigurationsByOrgByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/{configuration_id}",
	Method:  "GET",
}

var PatchOrgsCodeSecurityConfigurationsByOrgByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/{configuration_id}",
	Method:  "PATCH",
}

var DeleteOrgsCodeSecurityConfigurationsByOrgByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/{configuration_id}",
	Method:  "DELETE",
}

var PostOrgsCodeSecurityConfigurationsAttachByOrgByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/{configuration_id}/attach",
	Method:  "POST",
}

var PutOrgsCodeSecurityConfigurationsDefaultsByOrgByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/{configuration_id}/defaults",
	Method:  "PUT",
}

var GetOrgsCodeSecurityConfigurationsRepositoriesByOrgByConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/code-security/configurations/{configuration_id}/repositories",
	Method:  "GET",
}

var GetOrgsCodespacesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces",
	Method:  "GET",
}

var PutOrgsCodespacesAccessByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/access",
	Method:  "PUT",
}

var PostOrgsCodespacesAccessSelectedUsersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/access/selected_users",
	Method:  "POST",
}

var DeleteOrgsCodespacesAccessSelectedUsersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/access/selected_users",
	Method:  "DELETE",
}

var GetOrgsCodespacesSecretsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets",
	Method:  "GET",
}

var GetOrgsCodespacesSecretsPublicKeyByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/public-key",
	Method:  "GET",
}

var GetOrgsCodespacesSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/{secret_name}",
	Method:  "GET",
}

var PutOrgsCodespacesSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteOrgsCodespacesSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetOrgsCodespacesSecretsRepositoriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/{secret_name}/repositories",
	Method:  "GET",
}

var PutOrgsCodespacesSecretsRepositoriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/{secret_name}/repositories",
	Method:  "PUT",
}

var PutOrgsCodespacesSecretsRepositoriesByOrgBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteOrgsCodespacesSecretsRepositoriesByOrgBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "DELETE",
}

var GetOrgsCopilotBillingByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/copilot/billing",
	Method:  "GET",
}

var GetOrgsCopilotBillingSeatsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/copilot/billing/seats",
	Method:  "GET",
}

var PostOrgsCopilotBillingSelectedTeamsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/copilot/billing/selected_teams",
	Method:  "POST",
}

var DeleteOrgsCopilotBillingSelectedTeamsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/copilot/billing/selected_teams",
	Method:  "DELETE",
}

var PostOrgsCopilotBillingSelectedUsersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/copilot/billing/selected_users",
	Method:  "POST",
}

var DeleteOrgsCopilotBillingSelectedUsersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/copilot/billing/selected_users",
	Method:  "DELETE",
}

var GetOrgsCopilotMetricsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/copilot/metrics",
	Method:  "GET",
}

var GetOrgsDependabotAlertsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/alerts",
	Method:  "GET",
}

var GetOrgsDependabotSecretsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets",
	Method:  "GET",
}

var GetOrgsDependabotSecretsPublicKeyByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/public-key",
	Method:  "GET",
}

var GetOrgsDependabotSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/{secret_name}",
	Method:  "GET",
}

var PutOrgsDependabotSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteOrgsDependabotSecretsByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetOrgsDependabotSecretsRepositoriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/{secret_name}/repositories",
	Method:  "GET",
}

var PutOrgsDependabotSecretsRepositoriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/{secret_name}/repositories",
	Method:  "PUT",
}

var PutOrgsDependabotSecretsRepositoriesByOrgBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteOrgsDependabotSecretsRepositoriesByOrgBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "DELETE",
}

var GetOrgsDockerConflictsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/docker/conflicts",
	Method:  "GET",
}

var GetOrgsEventsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/events",
	Method:  "GET",
}

var GetOrgsFailedInvitationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/failed_invitations",
	Method:  "GET",
}

var GetOrgsHooksByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks",
	Method:  "GET",
}

var PostOrgsHooksByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks",
	Method:  "POST",
}

var GetOrgsHooksByOrgByHookId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}",
	Method:  "GET",
}

var PatchOrgsHooksByOrgByHookId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}",
	Method:  "PATCH",
}

var DeleteOrgsHooksByOrgByHookId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}",
	Method:  "DELETE",
}

var GetOrgsHooksConfigByOrgByHookId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}/config",
	Method:  "GET",
}

var PatchOrgsHooksConfigByOrgByHookId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}/config",
	Method:  "PATCH",
}

var GetOrgsHooksDeliveriesByOrgByHookId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}/deliveries",
	Method:  "GET",
}

var GetOrgsHooksDeliveriesByOrgByHookIdByDeliveryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}",
	Method:  "GET",
}

var PostOrgsHooksDeliveriesAttemptsByOrgByHookIdByDeliveryId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts",
	Method:  "POST",
}

var PostOrgsHooksPingsByOrgByHookId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/hooks/{hook_id}/pings",
	Method:  "POST",
}

var GetOrgsInsightsApiRouteStatsByOrgByActorTypeByActorId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/route-stats/{actor_type}/{actor_id}",
	Method:  "GET",
}

var GetOrgsInsightsApiSubjectStatsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/subject-stats",
	Method:  "GET",
}

var GetOrgsInsightsApiSummaryStatsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/summary-stats",
	Method:  "GET",
}

var GetOrgsInsightsApiSummaryStatsUsersByOrgByUserId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/summary-stats/users/{user_id}",
	Method:  "GET",
}

var GetOrgsInsightsApiSummaryStatsByOrgByActorTypeByActorId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/summary-stats/{actor_type}/{actor_id}",
	Method:  "GET",
}

var GetOrgsInsightsApiTimeStatsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/time-stats",
	Method:  "GET",
}

var GetOrgsInsightsApiTimeStatsUsersByOrgByUserId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/time-stats/users/{user_id}",
	Method:  "GET",
}

var GetOrgsInsightsApiTimeStatsByOrgByActorTypeByActorId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/time-stats/{actor_type}/{actor_id}",
	Method:  "GET",
}

var GetOrgsInsightsApiUserStatsByOrgByUserId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/insights/api/user-stats/{user_id}",
	Method:  "GET",
}

var GetOrgsInstallationByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/installation",
	Method:  "GET",
}

var GetOrgsInstallationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/installations",
	Method:  "GET",
}

var GetOrgsInteractionLimitsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/interaction-limits",
	Method:  "GET",
}

var PutOrgsInteractionLimitsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/interaction-limits",
	Method:  "PUT",
}

var DeleteOrgsInteractionLimitsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/interaction-limits",
	Method:  "DELETE",
}

var GetOrgsInvitationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/invitations",
	Method:  "GET",
}

var PostOrgsInvitationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/invitations",
	Method:  "POST",
}

var DeleteOrgsInvitationsByOrgByInvitationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/invitations/{invitation_id}",
	Method:  "DELETE",
}

var GetOrgsInvitationsTeamsByOrgByInvitationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/invitations/{invitation_id}/teams",
	Method:  "GET",
}

var GetOrgsIssueTypesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/issue-types",
	Method:  "GET",
}

var PostOrgsIssueTypesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/issue-types",
	Method:  "POST",
}

var PutOrgsIssueTypesByOrgByIssueTypeId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/issue-types/{issue_type_id}",
	Method:  "PUT",
}

var DeleteOrgsIssueTypesByOrgByIssueTypeId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/issue-types/{issue_type_id}",
	Method:  "DELETE",
}

var GetOrgsIssuesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/issues",
	Method:  "GET",
}

var GetOrgsMembersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/members",
	Method:  "GET",
}

var GetOrgsMembersByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/members/{username}",
	Method:  "GET",
}

var DeleteOrgsMembersByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/members/{username}",
	Method:  "DELETE",
}

var GetOrgsMembersCodespacesByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/members/{username}/codespaces",
	Method:  "GET",
}

var DeleteOrgsMembersCodespacesByOrgByUsernameByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/members/{username}/codespaces/{codespace_name}",
	Method:  "DELETE",
}

var PostOrgsMembersCodespacesStopByOrgByUsernameByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/members/{username}/codespaces/{codespace_name}/stop",
	Method:  "POST",
}

var GetOrgsMembersCopilotByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/members/{username}/copilot",
	Method:  "GET",
}

var GetOrgsMembershipsByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/memberships/{username}",
	Method:  "GET",
}

var PutOrgsMembershipsByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/memberships/{username}",
	Method:  "PUT",
}

var DeleteOrgsMembershipsByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/memberships/{username}",
	Method:  "DELETE",
}

var GetOrgsMigrationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/migrations",
	Method:  "GET",
}

var PostOrgsMigrationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/migrations",
	Method:  "POST",
}

var GetOrgsMigrationsByOrgByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/migrations/{migration_id}",
	Method:  "GET",
}

var GetOrgsMigrationsArchiveByOrgByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/migrations/{migration_id}/archive",
	Method:  "GET",
}

var DeleteOrgsMigrationsArchiveByOrgByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/migrations/{migration_id}/archive",
	Method:  "DELETE",
}

var DeleteOrgsMigrationsReposLockByOrgByMigrationIdByRepoName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/migrations/{migration_id}/repos/{repo_name}/lock",
	Method:  "DELETE",
}

var GetOrgsMigrationsRepositoriesByOrgByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/migrations/{migration_id}/repositories",
	Method:  "GET",
}

var GetOrgsOrganizationRolesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles",
	Method:  "GET",
}

var DeleteOrgsOrganizationRolesTeamsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/teams/{team_slug}",
	Method:  "DELETE",
}

var PutOrgsOrganizationRolesTeamsByOrgByTeamSlugByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/teams/{team_slug}/{role_id}",
	Method:  "PUT",
}

var DeleteOrgsOrganizationRolesTeamsByOrgByTeamSlugByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/teams/{team_slug}/{role_id}",
	Method:  "DELETE",
}

var DeleteOrgsOrganizationRolesUsersByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/users/{username}",
	Method:  "DELETE",
}

var PutOrgsOrganizationRolesUsersByOrgByUsernameByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/users/{username}/{role_id}",
	Method:  "PUT",
}

var DeleteOrgsOrganizationRolesUsersByOrgByUsernameByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/users/{username}/{role_id}",
	Method:  "DELETE",
}

var GetOrgsOrganizationRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/{role_id}",
	Method:  "GET",
}

var GetOrgsOrganizationRolesTeamsByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/{role_id}/teams",
	Method:  "GET",
}

var GetOrgsOrganizationRolesUsersByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/{role_id}/users",
	Method:  "GET",
}

var GetOrgsOutsideCollaboratorsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/outside_collaborators",
	Method:  "GET",
}

var PutOrgsOutsideCollaboratorsByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/outside_collaborators/{username}",
	Method:  "PUT",
}

var DeleteOrgsOutsideCollaboratorsByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/outside_collaborators/{username}",
	Method:  "DELETE",
}

var GetOrgsPackagesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages",
	Method:  "GET",
}

var GetOrgsPackagesByOrgByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages/{package_type}/{package_name}",
	Method:  "GET",
}

var DeleteOrgsPackagesByOrgByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages/{package_type}/{package_name}",
	Method:  "DELETE",
}

var PostOrgsPackagesRestoreByOrgByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages/{package_type}/{package_name}/restore",
	Method:  "POST",
}

var GetOrgsPackagesVersionsByOrgByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages/{package_type}/{package_name}/versions",
	Method:  "GET",
}

var GetOrgsPackagesVersionsByOrgByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}",
	Method:  "GET",
}

var DeleteOrgsPackagesVersionsByOrgByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}",
	Method:  "DELETE",
}

var PostOrgsPackagesVersionsRestoreByOrgByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore",
	Method:  "POST",
}

var GetOrgsPersonalAccessTokenRequestsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-token-requests",
	Method:  "GET",
}

var PostOrgsPersonalAccessTokenRequestsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-token-requests",
	Method:  "POST",
}

var PostOrgsPersonalAccessTokenRequestsByOrgByPatRequestId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-token-requests/{pat_request_id}",
	Method:  "POST",
}

var GetOrgsPersonalAccessTokenRequestsRepositoriesByOrgByPatRequestId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories",
	Method:  "GET",
}

var GetOrgsPersonalAccessTokensByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-tokens",
	Method:  "GET",
}

var PostOrgsPersonalAccessTokensByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-tokens",
	Method:  "POST",
}

var PostOrgsPersonalAccessTokensByOrgByPatId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-tokens/{pat_id}",
	Method:  "POST",
}

var GetOrgsPersonalAccessTokensRepositoriesByOrgByPatId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/personal-access-tokens/{pat_id}/repositories",
	Method:  "GET",
}

var GetOrgsPrivateRegistriesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/private-registries",
	Method:  "GET",
}

var PostOrgsPrivateRegistriesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/private-registries",
	Method:  "POST",
}

var GetOrgsPrivateRegistriesPublicKeyByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/private-registries/public-key",
	Method:  "GET",
}

var GetOrgsPrivateRegistriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/private-registries/{secret_name}",
	Method:  "GET",
}

var PatchOrgsPrivateRegistriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/private-registries/{secret_name}",
	Method:  "PATCH",
}

var DeleteOrgsPrivateRegistriesByOrgBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/private-registries/{secret_name}",
	Method:  "DELETE",
}

var GetOrgsProjectsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/projects",
	Method:  "GET",
}

var PostOrgsProjectsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/projects",
	Method:  "POST",
}

var GetOrgsPropertiesSchemaByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/properties/schema",
	Method:  "GET",
}

var PatchOrgsPropertiesSchemaByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/properties/schema",
	Method:  "PATCH",
}

var GetOrgsPropertiesSchemaByOrgByCustomPropertyName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/properties/schema/{custom_property_name}",
	Method:  "GET",
}

var PutOrgsPropertiesSchemaByOrgByCustomPropertyName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/properties/schema/{custom_property_name}",
	Method:  "PUT",
}

var DeleteOrgsPropertiesSchemaByOrgByCustomPropertyName EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/properties/schema/{custom_property_name}",
	Method:  "DELETE",
}

var GetOrgsPropertiesValuesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/properties/values",
	Method:  "GET",
}

var PatchOrgsPropertiesValuesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/properties/values",
	Method:  "PATCH",
}

var GetOrgsPublicMembersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/public_members",
	Method:  "GET",
}

var GetOrgsPublicMembersByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/public_members/{username}",
	Method:  "GET",
}

var PutOrgsPublicMembersByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/public_members/{username}",
	Method:  "PUT",
}

var DeleteOrgsPublicMembersByOrgByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/public_members/{username}",
	Method:  "DELETE",
}

var GetOrgsReposByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/repos",
	Method:  "GET",
}

var PostOrgsReposByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/repos",
	Method:  "POST",
}

var GetOrgsRulesetsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets",
	Method:  "GET",
}

var PostOrgsRulesetsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets",
	Method:  "POST",
}

var GetOrgsRulesetsRuleSuitesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets/rule-suites",
	Method:  "GET",
}

var GetOrgsRulesetsRuleSuitesByOrgByRuleSuiteId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets/rule-suites/{rule_suite_id}",
	Method:  "GET",
}

var GetOrgsRulesetsByOrgByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets/{ruleset_id}",
	Method:  "GET",
}

var PutOrgsRulesetsByOrgByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets/{ruleset_id}",
	Method:  "PUT",
}

var DeleteOrgsRulesetsByOrgByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets/{ruleset_id}",
	Method:  "DELETE",
}

var GetOrgsRulesetsHistoryByOrgByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets/{ruleset_id}/history",
	Method:  "GET",
}

var GetOrgsRulesetsHistoryByOrgByRulesetIdByVersionId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/rulesets/{ruleset_id}/history/{version_id}",
	Method:  "GET",
}

var GetOrgsSecretScanningAlertsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/secret-scanning/alerts",
	Method:  "GET",
}

var GetOrgsSecurityAdvisoriesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/security-advisories",
	Method:  "GET",
}

var GetOrgsSecurityManagersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/security-managers",
	Method:  "GET",
}

var PutOrgsSecurityManagersTeamsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/security-managers/teams/{team_slug}",
	Method:  "PUT",
}

var DeleteOrgsSecurityManagersTeamsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/security-managers/teams/{team_slug}",
	Method:  "DELETE",
}

var GetOrgsSettingsBillingActionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/billing/actions",
	Method:  "GET",
}

var GetOrgsSettingsBillingPackagesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/billing/packages",
	Method:  "GET",
}

var GetOrgsSettingsBillingSharedStorageByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/billing/shared-storage",
	Method:  "GET",
}

var GetOrgsSettingsNetworkConfigurationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/network-configurations",
	Method:  "GET",
}

var PostOrgsSettingsNetworkConfigurationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/network-configurations",
	Method:  "POST",
}

var GetOrgsSettingsNetworkConfigurationsByOrgByNetworkConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/network-configurations/{network_configuration_id}",
	Method:  "GET",
}

var PatchOrgsSettingsNetworkConfigurationsByOrgByNetworkConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/network-configurations/{network_configuration_id}",
	Method:  "PATCH",
}

var DeleteOrgsSettingsNetworkConfigurationsByOrgByNetworkConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/network-configurations/{network_configuration_id}",
	Method:  "DELETE",
}

var GetOrgsSettingsNetworkSettingsByOrgByNetworkSettingsId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/network-settings/{network_settings_id}",
	Method:  "GET",
}

var GetOrgsTeamCopilotMetricsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/team/{team_slug}/copilot/metrics",
	Method:  "GET",
}

var GetOrgsTeamsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams",
	Method:  "GET",
}

var PostOrgsTeamsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams",
	Method:  "POST",
}

var GetOrgsTeamsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}",
	Method:  "GET",
}

var PatchOrgsTeamsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}",
	Method:  "PATCH",
}

var DeleteOrgsTeamsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}",
	Method:  "DELETE",
}

var GetOrgsTeamsDiscussionsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions",
	Method:  "GET",
}

var PostOrgsTeamsDiscussionsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions",
	Method:  "POST",
}

var GetOrgsTeamsDiscussionsByOrgByTeamSlugByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}",
	Method:  "GET",
}

var PatchOrgsTeamsDiscussionsByOrgByTeamSlugByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}",
	Method:  "PATCH",
}

var DeleteOrgsTeamsDiscussionsByOrgByTeamSlugByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}",
	Method:  "DELETE",
}

var GetOrgsTeamsDiscussionsCommentsByOrgByTeamSlugByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments",
	Method:  "GET",
}

var PostOrgsTeamsDiscussionsCommentsByOrgByTeamSlugByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments",
	Method:  "POST",
}

var GetOrgsTeamsDiscussionsCommentsByOrgByTeamSlugByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}",
	Method:  "GET",
}

var PatchOrgsTeamsDiscussionsCommentsByOrgByTeamSlugByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}",
	Method:  "PATCH",
}

var DeleteOrgsTeamsDiscussionsCommentsByOrgByTeamSlugByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}",
	Method:  "DELETE",
}

var GetOrgsTeamsDiscussionsCommentsReactionsByOrgByTeamSlugByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions",
	Method:  "GET",
}

var PostOrgsTeamsDiscussionsCommentsReactionsByOrgByTeamSlugByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions",
	Method:  "POST",
}

var DeleteOrgsTeamsDiscussionsCommentsReactionsByOrgByTeamSlugByDiscussionNumberByCommentNumberByReactionId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions/{reaction_id}",
	Method:  "DELETE",
}

var GetOrgsTeamsDiscussionsReactionsByOrgByTeamSlugByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions",
	Method:  "GET",
}

var PostOrgsTeamsDiscussionsReactionsByOrgByTeamSlugByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions",
	Method:  "POST",
}

var DeleteOrgsTeamsDiscussionsReactionsByOrgByTeamSlugByDiscussionNumberByReactionId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions/{reaction_id}",
	Method:  "DELETE",
}

var GetOrgsTeamsInvitationsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/invitations",
	Method:  "GET",
}

var GetOrgsTeamsMembersByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/members",
	Method:  "GET",
}

var GetOrgsTeamsMembershipsByOrgByTeamSlugByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/memberships/{username}",
	Method:  "GET",
}

var PutOrgsTeamsMembershipsByOrgByTeamSlugByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/memberships/{username}",
	Method:  "PUT",
}

var DeleteOrgsTeamsMembershipsByOrgByTeamSlugByUsername EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/memberships/{username}",
	Method:  "DELETE",
}

var GetOrgsTeamsProjectsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/projects",
	Method:  "GET",
}

var GetOrgsTeamsProjectsByOrgByTeamSlugByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/projects/{project_id}",
	Method:  "GET",
}

var PutOrgsTeamsProjectsByOrgByTeamSlugByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/projects/{project_id}",
	Method:  "PUT",
}

var DeleteOrgsTeamsProjectsByOrgByTeamSlugByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/projects/{project_id}",
	Method:  "DELETE",
}

var GetOrgsTeamsReposByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/repos",
	Method:  "GET",
}

var GetOrgsTeamsReposByOrgByTeamSlugByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}",
	Method:  "GET",
}

var PutOrgsTeamsReposByOrgByTeamSlugByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}",
	Method:  "PUT",
}

var DeleteOrgsTeamsReposByOrgByTeamSlugByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}",
	Method:  "DELETE",
}

var GetOrgsTeamsTeamsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/teams",
	Method:  "GET",
}

var PostOrgsByOrgBySecurityProductByEnablement EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/{security_product}/{enablement}",
	Method:  "POST",
}

var GetProjectsColumnsCardsByCardId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/cards/{card_id}",
	Method:  "GET",
}

var PatchProjectsColumnsCardsByCardId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/cards/{card_id}",
	Method:  "PATCH",
}

var DeleteProjectsColumnsCardsByCardId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/cards/{card_id}",
	Method:  "DELETE",
}

var PostProjectsColumnsCardsMovesByCardId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/cards/{card_id}/moves",
	Method:  "POST",
}

var GetProjectsColumnsByColumnId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/{column_id}",
	Method:  "GET",
}

var PatchProjectsColumnsByColumnId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/{column_id}",
	Method:  "PATCH",
}

var DeleteProjectsColumnsByColumnId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/{column_id}",
	Method:  "DELETE",
}

var GetProjectsColumnsCardsByColumnId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/{column_id}/cards",
	Method:  "GET",
}

var PostProjectsColumnsCardsByColumnId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/{column_id}/cards",
	Method:  "POST",
}

var PostProjectsColumnsMovesByColumnId EndpointPattern = EndpointPattern{
	Pattern: "/projects/columns/{column_id}/moves",
	Method:  "POST",
}

var GetProjectsByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}",
	Method:  "GET",
}

var PatchProjectsByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}",
	Method:  "PATCH",
}

var DeleteProjectsByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}",
	Method:  "DELETE",
}

var GetProjectsCollaboratorsByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}/collaborators",
	Method:  "GET",
}

var PutProjectsCollaboratorsByProjectIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}/collaborators/{username}",
	Method:  "PUT",
}

var DeleteProjectsCollaboratorsByProjectIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}/collaborators/{username}",
	Method:  "DELETE",
}

var GetProjectsCollaboratorsPermissionByProjectIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}/collaborators/{username}/permission",
	Method:  "GET",
}

var GetProjectsColumnsByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}/columns",
	Method:  "GET",
}

var PostProjectsColumnsByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/projects/{project_id}/columns",
	Method:  "POST",
}

var GetRateLimit EndpointPattern = EndpointPattern{
	Pattern: "/rate_limit",
	Method:  "GET",
}

var GetReposByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}",
	Method:  "GET",
}

var PatchReposByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}",
	Method:  "PATCH",
}

var DeleteReposByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}",
	Method:  "DELETE",
}

var GetReposActionsArtifactsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/artifacts",
	Method:  "GET",
}

var GetReposActionsArtifactsByOwnerByRepoByArtifactId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/artifacts/{artifact_id}",
	Method:  "GET",
}

var DeleteReposActionsArtifactsByOwnerByRepoByArtifactId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/artifacts/{artifact_id}",
	Method:  "DELETE",
}

var GetReposActionsArtifactsByOwnerByRepoByArtifactIdByArchiveFormat EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
	Method:  "GET",
}

var GetReposActionsCacheUsageByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/cache/usage",
	Method:  "GET",
}

var GetReposActionsCachesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/caches",
	Method:  "GET",
}

var DeleteReposActionsCachesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/caches",
	Method:  "DELETE",
}

var DeleteReposActionsCachesByOwnerByRepoByCacheId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/caches/{cache_id}",
	Method:  "DELETE",
}

var GetReposActionsJobsByOwnerByRepoByJobId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/jobs/{job_id}",
	Method:  "GET",
}

var GetReposActionsJobsLogsByOwnerByRepoByJobId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
	Method:  "GET",
}

var PostReposActionsJobsRerunByOwnerByRepoByJobId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/jobs/{job_id}/rerun",
	Method:  "POST",
}

var GetReposActionsOidcCustomizationSubByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/oidc/customization/sub",
	Method:  "GET",
}

var PutReposActionsOidcCustomizationSubByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/oidc/customization/sub",
	Method:  "PUT",
}

var GetReposActionsOrganizationSecretsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/organization-secrets",
	Method:  "GET",
}

var GetReposActionsOrganizationVariablesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/organization-variables",
	Method:  "GET",
}

var GetReposActionsPermissionsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions",
	Method:  "GET",
}

var PutReposActionsPermissionsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions",
	Method:  "PUT",
}

var GetReposActionsPermissionsAccessByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions/access",
	Method:  "GET",
}

var PutReposActionsPermissionsAccessByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions/access",
	Method:  "PUT",
}

var GetReposActionsPermissionsSelectedActionsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions/selected-actions",
	Method:  "GET",
}

var PutReposActionsPermissionsSelectedActionsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions/selected-actions",
	Method:  "PUT",
}

var GetReposActionsPermissionsWorkflowByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions/workflow",
	Method:  "GET",
}

var PutReposActionsPermissionsWorkflowByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/permissions/workflow",
	Method:  "PUT",
}

var GetReposActionsRunnersByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners",
	Method:  "GET",
}

var GetReposActionsRunnersDownloadsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/downloads",
	Method:  "GET",
}

var PostReposActionsRunnersGenerateJitconfigByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/generate-jitconfig",
	Method:  "POST",
}

var PostReposActionsRunnersRegistrationTokenByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/registration-token",
	Method:  "POST",
}

var PostReposActionsRunnersRemoveTokenByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/remove-token",
	Method:  "POST",
}

var GetReposActionsRunnersByOwnerByRepoByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/{runner_id}",
	Method:  "GET",
}

var DeleteReposActionsRunnersByOwnerByRepoByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/{runner_id}",
	Method:  "DELETE",
}

var GetReposActionsRunnersLabelsByOwnerByRepoByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/{runner_id}/labels",
	Method:  "GET",
}

var PostReposActionsRunnersLabelsByOwnerByRepoByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/{runner_id}/labels",
	Method:  "POST",
}

var PutReposActionsRunnersLabelsByOwnerByRepoByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/{runner_id}/labels",
	Method:  "PUT",
}

var DeleteReposActionsRunnersLabelsByOwnerByRepoByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/{runner_id}/labels",
	Method:  "DELETE",
}

var DeleteReposActionsRunnersLabelsByOwnerByRepoByRunnerIdByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}",
	Method:  "DELETE",
}

var GetReposActionsRunsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs",
	Method:  "GET",
}

var GetReposActionsRunsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}",
	Method:  "GET",
}

var DeleteReposActionsRunsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}",
	Method:  "DELETE",
}

var GetReposActionsRunsApprovalsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/approvals",
	Method:  "GET",
}

var PostReposActionsRunsApproveByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/approve",
	Method:  "POST",
}

var GetReposActionsRunsArtifactsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
	Method:  "GET",
}

var GetReposActionsRunsAttemptsByOwnerByRepoByRunIdByAttemptNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}",
	Method:  "GET",
}

var GetReposActionsRunsAttemptsJobsByOwnerByRepoByRunIdByAttemptNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs",
	Method:  "GET",
}

var GetReposActionsRunsAttemptsLogsByOwnerByRepoByRunIdByAttemptNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs",
	Method:  "GET",
}

var PostReposActionsRunsCancelByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/cancel",
	Method:  "POST",
}

var PostReposActionsRunsDeploymentProtectionRuleByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule",
	Method:  "POST",
}

var PostReposActionsRunsForceCancelByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel",
	Method:  "POST",
}

var GetReposActionsRunsJobsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
	Method:  "GET",
}

var GetReposActionsRunsLogsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/logs",
	Method:  "GET",
}

var DeleteReposActionsRunsLogsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/logs",
	Method:  "DELETE",
}

var GetReposActionsRunsPendingDeploymentsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments",
	Method:  "GET",
}

var PostReposActionsRunsPendingDeploymentsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments",
	Method:  "POST",
}

var PostReposActionsRunsRerunByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/rerun",
	Method:  "POST",
}

var PostReposActionsRunsRerunFailedJobsByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
	Method:  "POST",
}

var GetReposActionsRunsTimingByOwnerByRepoByRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/runs/{run_id}/timing",
	Method:  "GET",
}

var GetReposActionsSecretsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/secrets",
	Method:  "GET",
}

var GetReposActionsSecretsPublicKeyByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/secrets/public-key",
	Method:  "GET",
}

var GetReposActionsSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/secrets/{secret_name}",
	Method:  "GET",
}

var PutReposActionsSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteReposActionsSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetReposActionsVariablesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/variables",
	Method:  "GET",
}

var PostReposActionsVariablesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/variables",
	Method:  "POST",
}

var GetReposActionsVariablesByOwnerByRepoByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/variables/{name}",
	Method:  "GET",
}

var PatchReposActionsVariablesByOwnerByRepoByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/variables/{name}",
	Method:  "PATCH",
}

var DeleteReposActionsVariablesByOwnerByRepoByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/variables/{name}",
	Method:  "DELETE",
}

var GetReposActionsWorkflowsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/workflows",
	Method:  "GET",
}

var GetReposActionsWorkflowsByOwnerByRepoByWorkflowId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/workflows/{workflow_id}",
	Method:  "GET",
}

var PutReposActionsWorkflowsDisableByOwnerByRepoByWorkflowId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable",
	Method:  "PUT",
}

var PostReposActionsWorkflowsDispatchesByOwnerByRepoByWorkflowId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
	Method:  "POST",
}

var PutReposActionsWorkflowsEnableByOwnerByRepoByWorkflowId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable",
	Method:  "PUT",
}

var GetReposActionsWorkflowsRunsByOwnerByRepoByWorkflowId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
	Method:  "GET",
}

var GetReposActionsWorkflowsTimingByOwnerByRepoByWorkflowId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing",
	Method:  "GET",
}

var GetReposActivityByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/activity",
	Method:  "GET",
}

var GetReposAssigneesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/assignees",
	Method:  "GET",
}

var GetReposAssigneesByOwnerByRepoByAssignee EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/assignees/{assignee}",
	Method:  "GET",
}

var PostReposAttestationsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/attestations",
	Method:  "POST",
}

var GetReposAttestationsByOwnerByRepoBySubjectDigest EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/attestations/{subject_digest}",
	Method:  "GET",
}

var GetReposAutolinksByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/autolinks",
	Method:  "GET",
}

var PostReposAutolinksByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/autolinks",
	Method:  "POST",
}

var GetReposAutolinksByOwnerByRepoByAutolinkId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/autolinks/{autolink_id}",
	Method:  "GET",
}

var DeleteReposAutolinksByOwnerByRepoByAutolinkId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/autolinks/{autolink_id}",
	Method:  "DELETE",
}

var GetReposAutomatedSecurityFixesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/automated-security-fixes",
	Method:  "GET",
}

var PutReposAutomatedSecurityFixesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/automated-security-fixes",
	Method:  "PUT",
}

var DeleteReposAutomatedSecurityFixesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/automated-security-fixes",
	Method:  "DELETE",
}

var GetReposBranchesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches",
	Method:  "GET",
}

var GetReposBranchesByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}",
	Method:  "GET",
}

var GetReposBranchesProtectionByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection",
	Method:  "GET",
}

var PutReposBranchesProtectionByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection",
	Method:  "PUT",
}

var DeleteReposBranchesProtectionByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection",
	Method:  "DELETE",
}

var GetReposBranchesProtectionEnforceAdminsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins",
	Method:  "GET",
}

var PostReposBranchesProtectionEnforceAdminsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins",
	Method:  "POST",
}

var DeleteReposBranchesProtectionEnforceAdminsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRequiredPullRequestReviewsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews",
	Method:  "GET",
}

var PatchReposBranchesProtectionRequiredPullRequestReviewsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews",
	Method:  "PATCH",
}

var DeleteReposBranchesProtectionRequiredPullRequestReviewsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRequiredSignaturesByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_signatures",
	Method:  "GET",
}

var PostReposBranchesProtectionRequiredSignaturesByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_signatures",
	Method:  "POST",
}

var DeleteReposBranchesProtectionRequiredSignaturesByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_signatures",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRequiredStatusChecksByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks",
	Method:  "GET",
}

var PatchReposBranchesProtectionRequiredStatusChecksByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks",
	Method:  "PATCH",
}

var DeleteReposBranchesProtectionRequiredStatusChecksByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRequiredStatusChecksContextsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
	Method:  "GET",
}

var PostReposBranchesProtectionRequiredStatusChecksContextsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
	Method:  "POST",
}

var PutReposBranchesProtectionRequiredStatusChecksContextsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
	Method:  "PUT",
}

var DeleteReposBranchesProtectionRequiredStatusChecksContextsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRestrictionsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions",
	Method:  "GET",
}

var DeleteReposBranchesProtectionRestrictionsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRestrictionsAppsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
	Method:  "GET",
}

var PostReposBranchesProtectionRestrictionsAppsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
	Method:  "POST",
}

var PutReposBranchesProtectionRestrictionsAppsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
	Method:  "PUT",
}

var DeleteReposBranchesProtectionRestrictionsAppsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRestrictionsTeamsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
	Method:  "GET",
}

var PostReposBranchesProtectionRestrictionsTeamsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
	Method:  "POST",
}

var PutReposBranchesProtectionRestrictionsTeamsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
	Method:  "PUT",
}

var DeleteReposBranchesProtectionRestrictionsTeamsByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
	Method:  "DELETE",
}

var GetReposBranchesProtectionRestrictionsUsersByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
	Method:  "GET",
}

var PostReposBranchesProtectionRestrictionsUsersByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
	Method:  "POST",
}

var PutReposBranchesProtectionRestrictionsUsersByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
	Method:  "PUT",
}

var DeleteReposBranchesProtectionRestrictionsUsersByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
	Method:  "DELETE",
}

var PostReposBranchesRenameByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/branches/{branch}/rename",
	Method:  "POST",
}

var PostReposCheckRunsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-runs",
	Method:  "POST",
}

var GetReposCheckRunsByOwnerByRepoByCheckRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-runs/{check_run_id}",
	Method:  "GET",
}

var PatchReposCheckRunsByOwnerByRepoByCheckRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-runs/{check_run_id}",
	Method:  "PATCH",
}

var GetReposCheckRunsAnnotationsByOwnerByRepoByCheckRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-runs/{check_run_id}/annotations",
	Method:  "GET",
}

var PostReposCheckRunsRerequestByOwnerByRepoByCheckRunId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest",
	Method:  "POST",
}

var PostReposCheckSuitesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-suites",
	Method:  "POST",
}

var PatchReposCheckSuitesPreferencesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-suites/preferences",
	Method:  "PATCH",
}

var GetReposCheckSuitesByOwnerByRepoByCheckSuiteId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-suites/{check_suite_id}",
	Method:  "GET",
}

var GetReposCheckSuitesCheckRunsByOwnerByRepoByCheckSuiteId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs",
	Method:  "GET",
}

var PostReposCheckSuitesRerequestByOwnerByRepoByCheckSuiteId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest",
	Method:  "POST",
}

var GetReposCodeScanningAlertsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/alerts",
	Method:  "GET",
}

var GetReposCodeScanningAlertsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/alerts/{alert_number}",
	Method:  "GET",
}

var PatchReposCodeScanningAlertsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/alerts/{alert_number}",
	Method:  "PATCH",
}

var GetReposCodeScanningAlertsAutofixByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix",
	Method:  "GET",
}

var PostReposCodeScanningAlertsAutofixByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix",
	Method:  "POST",
}

var PostReposCodeScanningAlertsAutofixCommitsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits",
	Method:  "POST",
}

var GetReposCodeScanningAlertsInstancesByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances",
	Method:  "GET",
}

var GetReposCodeScanningAnalysesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/analyses",
	Method:  "GET",
}

var GetReposCodeScanningAnalysesByOwnerByRepoByAnalysisId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}",
	Method:  "GET",
}

var DeleteReposCodeScanningAnalysesByOwnerByRepoByAnalysisId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}",
	Method:  "DELETE",
}

var GetReposCodeScanningCodeqlDatabasesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/codeql/databases",
	Method:  "GET",
}

var GetReposCodeScanningCodeqlDatabasesByOwnerByRepoByLanguage EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/codeql/databases/{language}",
	Method:  "GET",
}

var DeleteReposCodeScanningCodeqlDatabasesByOwnerByRepoByLanguage EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/codeql/databases/{language}",
	Method:  "DELETE",
}

var PostReposCodeScanningCodeqlVariantAnalysesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/codeql/variant-analyses",
	Method:  "POST",
}

var GetReposCodeScanningCodeqlVariantAnalysesByOwnerByRepoByCodeqlVariantAnalysisId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}",
	Method:  "GET",
}

var GetReposCodeScanningCodeqlVariantAnalysesReposByOwnerByRepoByCodeqlVariantAnalysisIdByRepoOwnerByRepoName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}/repos/{repo_owner}/{repo_name}",
	Method:  "GET",
}

var GetReposCodeScanningDefaultSetupByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/default-setup",
	Method:  "GET",
}

var PatchReposCodeScanningDefaultSetupByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/default-setup",
	Method:  "PATCH",
}

var PostReposCodeScanningSarifsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/sarifs",
	Method:  "POST",
}

var GetReposCodeScanningSarifsByOwnerByRepoBySarifId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}",
	Method:  "GET",
}

var GetReposCodeSecurityConfigurationByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/code-security-configuration",
	Method:  "GET",
}

var GetReposCodeownersErrorsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codeowners/errors",
	Method:  "GET",
}

var GetReposCodespacesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces",
	Method:  "GET",
}

var PostReposCodespacesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces",
	Method:  "POST",
}

var GetReposCodespacesDevcontainersByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/devcontainers",
	Method:  "GET",
}

var GetReposCodespacesMachinesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/machines",
	Method:  "GET",
}

var GetReposCodespacesNewByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/new",
	Method:  "GET",
}

var GetReposCodespacesPermissionsCheckByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/permissions_check",
	Method:  "GET",
}

var GetReposCodespacesSecretsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/secrets",
	Method:  "GET",
}

var GetReposCodespacesSecretsPublicKeyByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/secrets/public-key",
	Method:  "GET",
}

var GetReposCodespacesSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/secrets/{secret_name}",
	Method:  "GET",
}

var PutReposCodespacesSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteReposCodespacesSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/codespaces/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetReposCollaboratorsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/collaborators",
	Method:  "GET",
}

var GetReposCollaboratorsByOwnerByRepoByUsername EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/collaborators/{username}",
	Method:  "GET",
}

var PutReposCollaboratorsByOwnerByRepoByUsername EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/collaborators/{username}",
	Method:  "PUT",
}

var DeleteReposCollaboratorsByOwnerByRepoByUsername EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/collaborators/{username}",
	Method:  "DELETE",
}

var GetReposCollaboratorsPermissionByOwnerByRepoByUsername EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/collaborators/{username}/permission",
	Method:  "GET",
}

var GetReposCommentsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/comments",
	Method:  "GET",
}

var GetReposCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/comments/{comment_id}",
	Method:  "GET",
}

var PatchReposCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/comments/{comment_id}",
	Method:  "PATCH",
}

var DeleteReposCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/comments/{comment_id}",
	Method:  "DELETE",
}

var GetReposCommentsReactionsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/comments/{comment_id}/reactions",
	Method:  "GET",
}

var PostReposCommentsReactionsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/comments/{comment_id}/reactions",
	Method:  "POST",
}

var DeleteReposCommentsReactionsByOwnerByRepoByCommentIdByReactionId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}",
	Method:  "DELETE",
}

var GetReposCommitsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits",
	Method:  "GET",
}

var GetReposCommitsBranchesWhereHeadByOwnerByRepoByCommitSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head",
	Method:  "GET",
}

var GetReposCommitsCommentsByOwnerByRepoByCommitSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{commit_sha}/comments",
	Method:  "GET",
}

var PostReposCommitsCommentsByOwnerByRepoByCommitSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{commit_sha}/comments",
	Method:  "POST",
}

var GetReposCommitsPullsByOwnerByRepoByCommitSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{commit_sha}/pulls",
	Method:  "GET",
}

var GetReposCommitsByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{ref:.+}",
	Method:  "GET",
}

var GetReposCommitsCheckRunsByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{ref}/check-runs",
	Method:  "GET",
}

var GetReposCommitsCheckSuitesByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{ref}/check-suites",
	Method:  "GET",
}

var GetReposCommitsStatusByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{ref}/status",
	Method:  "GET",
}

var GetReposCommitsStatusesByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/commits/{ref}/statuses",
	Method:  "GET",
}

var GetReposCommunityProfileByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/community/profile",
	Method:  "GET",
}

var GetReposCompareByOwnerByRepoByBasehead EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/compare/{basehead}",
	Method:  "GET",
}

var GetReposContentsByOwnerByRepoByPath EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/contents/{path:.*}",
	Method:  "GET",
}

var PutReposContentsByOwnerByRepoByPath EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/contents/{path:.*}",
	Method:  "PUT",
}

var DeleteReposContentsByOwnerByRepoByPath EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/contents/{path:.*}",
	Method:  "DELETE",
}

var GetReposContributorsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/contributors",
	Method:  "GET",
}

var GetReposDependabotAlertsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/alerts",
	Method:  "GET",
}

var GetReposDependabotAlertsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/alerts/{alert_number}",
	Method:  "GET",
}

var PatchReposDependabotAlertsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/alerts/{alert_number}",
	Method:  "PATCH",
}

var GetReposDependabotSecretsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/secrets",
	Method:  "GET",
}

var GetReposDependabotSecretsPublicKeyByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/secrets/public-key",
	Method:  "GET",
}

var GetReposDependabotSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/secrets/{secret_name}",
	Method:  "GET",
}

var PutReposDependabotSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteReposDependabotSecretsByOwnerByRepoBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependabot/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetReposDependencyGraphCompareByOwnerByRepoByBasehead EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependency-graph/compare/{basehead}",
	Method:  "GET",
}

var GetReposDependencyGraphSbomByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependency-graph/sbom",
	Method:  "GET",
}

var PostReposDependencyGraphSnapshotsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dependency-graph/snapshots",
	Method:  "POST",
}

var GetReposDeploymentsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/deployments",
	Method:  "GET",
}

var PostReposDeploymentsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/deployments",
	Method:  "POST",
}

var GetReposDeploymentsByOwnerByRepoByDeploymentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/deployments/{deployment_id}",
	Method:  "GET",
}

var DeleteReposDeploymentsByOwnerByRepoByDeploymentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/deployments/{deployment_id}",
	Method:  "DELETE",
}

var GetReposDeploymentsStatusesByOwnerByRepoByDeploymentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/deployments/{deployment_id}/statuses",
	Method:  "GET",
}

var PostReposDeploymentsStatusesByOwnerByRepoByDeploymentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/deployments/{deployment_id}/statuses",
	Method:  "POST",
}

var GetReposDeploymentsStatusesByOwnerByRepoByDeploymentIdByStatusId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}",
	Method:  "GET",
}

var PostReposDispatchesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dispatches",
	Method:  "POST",
}

var GetReposEnvironmentsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments",
	Method:  "GET",
}

var GetReposEnvironmentsByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}",
	Method:  "GET",
}

var PutReposEnvironmentsByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}",
	Method:  "PUT",
}

var DeleteReposEnvironmentsByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}",
	Method:  "DELETE",
}

var GetReposEnvironmentsDeploymentBranchPoliciesByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies",
	Method:  "GET",
}

var PostReposEnvironmentsDeploymentBranchPoliciesByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies",
	Method:  "POST",
}

var GetReposEnvironmentsDeploymentBranchPoliciesByOwnerByRepoByEnvironmentNameByBranchPolicyId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}",
	Method:  "GET",
}

var PutReposEnvironmentsDeploymentBranchPoliciesByOwnerByRepoByEnvironmentNameByBranchPolicyId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}",
	Method:  "PUT",
}

var DeleteReposEnvironmentsDeploymentBranchPoliciesByOwnerByRepoByEnvironmentNameByBranchPolicyId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}",
	Method:  "DELETE",
}

var GetReposEnvironmentsDeploymentProtectionRulesByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules",
	Method:  "GET",
}

var PostReposEnvironmentsDeploymentProtectionRulesByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules",
	Method:  "POST",
}

var GetReposEnvironmentsDeploymentProtectionRulesAppsByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps",
	Method:  "GET",
}

var GetReposEnvironmentsDeploymentProtectionRulesByOwnerByRepoByEnvironmentNameByProtectionRuleId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}",
	Method:  "GET",
}

var DeleteReposEnvironmentsDeploymentProtectionRulesByOwnerByRepoByEnvironmentNameByProtectionRuleId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}",
	Method:  "DELETE",
}

var GetReposEnvironmentsSecretsByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/secrets",
	Method:  "GET",
}

var GetReposEnvironmentsSecretsPublicKeyByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key",
	Method:  "GET",
}

var GetReposEnvironmentsSecretsByOwnerByRepoByEnvironmentNameBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}",
	Method:  "GET",
}

var PutReposEnvironmentsSecretsByOwnerByRepoByEnvironmentNameBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteReposEnvironmentsSecretsByOwnerByRepoByEnvironmentNameBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetReposEnvironmentsVariablesByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/variables",
	Method:  "GET",
}

var PostReposEnvironmentsVariablesByOwnerByRepoByEnvironmentName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/variables",
	Method:  "POST",
}

var GetReposEnvironmentsVariablesByOwnerByRepoByEnvironmentNameByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/variables/{name}",
	Method:  "GET",
}

var PatchReposEnvironmentsVariablesByOwnerByRepoByEnvironmentNameByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/variables/{name}",
	Method:  "PATCH",
}

var DeleteReposEnvironmentsVariablesByOwnerByRepoByEnvironmentNameByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/environments/{environment_name}/variables/{name}",
	Method:  "DELETE",
}

var GetReposEventsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/events",
	Method:  "GET",
}

var GetReposForksByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/forks",
	Method:  "GET",
}

var PostReposForksByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/forks",
	Method:  "POST",
}

var PostReposGitBlobsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/blobs",
	Method:  "POST",
}

var GetReposGitBlobsByOwnerByRepoByFileSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/blobs/{file_sha}",
	Method:  "GET",
}

var PostReposGitCommitsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/commits",
	Method:  "POST",
}

var GetReposGitCommitsByOwnerByRepoByCommitSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/commits/{commit_sha}",
	Method:  "GET",
}

var GetReposGitMatchingRefsByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/matching-refs/{ref}",
	Method:  "GET",
}

var GetReposGitRefByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/ref/{ref:.+}",
	Method:  "GET",
}

var PostReposGitRefsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/refs",
	Method:  "POST",
}

var PatchReposGitRefsByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/refs/{ref:.+}",
	Method:  "PATCH",
}

var DeleteReposGitRefsByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/refs/{ref:.+}",
	Method:  "DELETE",
}

var PostReposGitTagsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/tags",
	Method:  "POST",
}

var GetReposGitTagsByOwnerByRepoByTagSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/tags/{tag_sha}",
	Method:  "GET",
}

var PostReposGitTreesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/trees",
	Method:  "POST",
}

var GetReposGitTreesByOwnerByRepoByTreeSha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/git/trees/{tree_sha}",
	Method:  "GET",
}

var GetReposHooksByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks",
	Method:  "GET",
}

var PostReposHooksByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks",
	Method:  "POST",
}

var GetReposHooksByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}",
	Method:  "GET",
}

var PatchReposHooksByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}",
	Method:  "PATCH",
}

var DeleteReposHooksByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}",
	Method:  "DELETE",
}

var GetReposHooksConfigByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}/config",
	Method:  "GET",
}

var PatchReposHooksConfigByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}/config",
	Method:  "PATCH",
}

var GetReposHooksDeliveriesByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}/deliveries",
	Method:  "GET",
}

var GetReposHooksDeliveriesByOwnerByRepoByHookIdByDeliveryId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}",
	Method:  "GET",
}

var PostReposHooksDeliveriesAttemptsByOwnerByRepoByHookIdByDeliveryId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts",
	Method:  "POST",
}

var PostReposHooksPingsByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}/pings",
	Method:  "POST",
}

var PostReposHooksTestsByOwnerByRepoByHookId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/hooks/{hook_id}/tests",
	Method:  "POST",
}

var GetReposImportByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import",
	Method:  "GET",
}

var PutReposImportByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import",
	Method:  "PUT",
}

var PatchReposImportByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import",
	Method:  "PATCH",
}

var DeleteReposImportByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import",
	Method:  "DELETE",
}

var GetReposImportAuthorsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import/authors",
	Method:  "GET",
}

var PatchReposImportAuthorsByOwnerByRepoByAuthorId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import/authors/{author_id}",
	Method:  "PATCH",
}

var GetReposImportLargeFilesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import/large_files",
	Method:  "GET",
}

var PatchReposImportLfsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/import/lfs",
	Method:  "PATCH",
}

var GetReposInstallationByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/installation",
	Method:  "GET",
}

var GetReposInteractionLimitsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/interaction-limits",
	Method:  "GET",
}

var PutReposInteractionLimitsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/interaction-limits",
	Method:  "PUT",
}

var DeleteReposInteractionLimitsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/interaction-limits",
	Method:  "DELETE",
}

var GetReposInvitationsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/invitations",
	Method:  "GET",
}

var PatchReposInvitationsByOwnerByRepoByInvitationId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/invitations/{invitation_id}",
	Method:  "PATCH",
}

var DeleteReposInvitationsByOwnerByRepoByInvitationId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/invitations/{invitation_id}",
	Method:  "DELETE",
}

var GetReposIssuesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues",
	Method:  "GET",
}

var PostReposIssuesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues",
	Method:  "POST",
}

var GetReposIssuesCommentsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/comments",
	Method:  "GET",
}

var GetReposIssuesCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/comments/{comment_id}",
	Method:  "GET",
}

var PatchReposIssuesCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/comments/{comment_id}",
	Method:  "PATCH",
}

var DeleteReposIssuesCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/comments/{comment_id}",
	Method:  "DELETE",
}

var GetReposIssuesCommentsReactionsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
	Method:  "GET",
}

var PostReposIssuesCommentsReactionsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
	Method:  "POST",
}

var DeleteReposIssuesCommentsReactionsByOwnerByRepoByCommentIdByReactionId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}",
	Method:  "DELETE",
}

var GetReposIssuesEventsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/events",
	Method:  "GET",
}

var GetReposIssuesEventsByOwnerByRepoByEventId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/events/{event_id}",
	Method:  "GET",
}

var GetReposIssuesByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}",
	Method:  "GET",
}

var PatchReposIssuesByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}",
	Method:  "PATCH",
}

var PostReposIssuesAssigneesByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/assignees",
	Method:  "POST",
}

var DeleteReposIssuesAssigneesByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/assignees",
	Method:  "DELETE",
}

var GetReposIssuesAssigneesByOwnerByRepoByIssueNumberByAssignee EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}",
	Method:  "GET",
}

var GetReposIssuesCommentsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/comments",
	Method:  "GET",
}

var PostReposIssuesCommentsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/comments",
	Method:  "POST",
}

var GetReposIssuesEventsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/events",
	Method:  "GET",
}

var GetReposIssuesLabelsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/labels",
	Method:  "GET",
}

var PostReposIssuesLabelsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/labels",
	Method:  "POST",
}

var PutReposIssuesLabelsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/labels",
	Method:  "PUT",
}

var DeleteReposIssuesLabelsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/labels",
	Method:  "DELETE",
}

var DeleteReposIssuesLabelsByOwnerByRepoByIssueNumberByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/labels/{name:.+}",
	Method:  "DELETE",
}

var PutReposIssuesLockByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/lock",
	Method:  "PUT",
}

var DeleteReposIssuesLockByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/lock",
	Method:  "DELETE",
}

var GetReposIssuesReactionsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/reactions",
	Method:  "GET",
}

var PostReposIssuesReactionsByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/reactions",
	Method:  "POST",
}

var DeleteReposIssuesReactionsByOwnerByRepoByIssueNumberByReactionId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}",
	Method:  "DELETE",
}

var DeleteReposIssuesSubIssueByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/sub_issue",
	Method:  "DELETE",
}

var GetReposIssuesSubIssuesByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/sub_issues",
	Method:  "GET",
}

var PostReposIssuesSubIssuesByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/sub_issues",
	Method:  "POST",
}

var PatchReposIssuesSubIssuesPriorityByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority",
	Method:  "PATCH",
}

var GetReposIssuesTimelineByOwnerByRepoByIssueNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/issues/{issue_number}/timeline",
	Method:  "GET",
}

var GetReposKeysByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/keys",
	Method:  "GET",
}

var PostReposKeysByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/keys",
	Method:  "POST",
}

var GetReposKeysByOwnerByRepoByKeyId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/keys/{key_id}",
	Method:  "GET",
}

var DeleteReposKeysByOwnerByRepoByKeyId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/keys/{key_id}",
	Method:  "DELETE",
}

var GetReposLabelsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/labels",
	Method:  "GET",
}

var PostReposLabelsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/labels",
	Method:  "POST",
}

var GetReposLabelsByOwnerByRepoByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/labels/{name:.+}",
	Method:  "GET",
}

var PatchReposLabelsByOwnerByRepoByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/labels/{name:.+}",
	Method:  "PATCH",
}

var DeleteReposLabelsByOwnerByRepoByName EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/labels/{name:.+}",
	Method:  "DELETE",
}

var GetReposLanguagesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/languages",
	Method:  "GET",
}

var GetReposLicenseByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/license",
	Method:  "GET",
}

var PostReposMergeUpstreamByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/merge-upstream",
	Method:  "POST",
}

var PostReposMergesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/merges",
	Method:  "POST",
}

var GetReposMilestonesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/milestones",
	Method:  "GET",
}

var PostReposMilestonesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/milestones",
	Method:  "POST",
}

var GetReposMilestonesByOwnerByRepoByMilestoneNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/milestones/{milestone_number}",
	Method:  "GET",
}

var PatchReposMilestonesByOwnerByRepoByMilestoneNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/milestones/{milestone_number}",
	Method:  "PATCH",
}

var DeleteReposMilestonesByOwnerByRepoByMilestoneNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/milestones/{milestone_number}",
	Method:  "DELETE",
}

var GetReposMilestonesLabelsByOwnerByRepoByMilestoneNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/milestones/{milestone_number}/labels",
	Method:  "GET",
}

var GetReposNotificationsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/notifications",
	Method:  "GET",
}

var PutReposNotificationsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/notifications",
	Method:  "PUT",
}

var GetReposPagesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages",
	Method:  "GET",
}

var PostReposPagesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages",
	Method:  "POST",
}

var PutReposPagesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages",
	Method:  "PUT",
}

var DeleteReposPagesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages",
	Method:  "DELETE",
}

var GetReposPagesBuildsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/builds",
	Method:  "GET",
}

var PostReposPagesBuildsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/builds",
	Method:  "POST",
}

var GetReposPagesBuildsLatestByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/builds/latest",
	Method:  "GET",
}

var GetReposPagesBuildsByOwnerByRepoByBuildId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/builds/{build_id}",
	Method:  "GET",
}

var PostReposPagesDeploymentsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/deployments",
	Method:  "POST",
}

var GetReposPagesDeploymentsByOwnerByRepoByPagesDeploymentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}",
	Method:  "GET",
}

var PostReposPagesDeploymentsCancelByOwnerByRepoByPagesDeploymentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel",
	Method:  "POST",
}

var GetReposPagesHealthByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pages/health",
	Method:  "GET",
}

var GetReposPrivateVulnerabilityReportingByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/private-vulnerability-reporting",
	Method:  "GET",
}

var PutReposPrivateVulnerabilityReportingByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/private-vulnerability-reporting",
	Method:  "PUT",
}

var DeleteReposPrivateVulnerabilityReportingByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/private-vulnerability-reporting",
	Method:  "DELETE",
}

var GetReposProjectsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/projects",
	Method:  "GET",
}

var PostReposProjectsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/projects",
	Method:  "POST",
}

var GetReposPropertiesValuesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/properties/values",
	Method:  "GET",
}

var PatchReposPropertiesValuesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/properties/values",
	Method:  "PATCH",
}

var GetReposPullsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls",
	Method:  "GET",
}

var PostReposPullsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls",
	Method:  "POST",
}

var GetReposPullsCommentsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/comments",
	Method:  "GET",
}

var GetReposPullsCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/comments/{comment_id}",
	Method:  "GET",
}

var PatchReposPullsCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/comments/{comment_id}",
	Method:  "PATCH",
}

var DeleteReposPullsCommentsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/comments/{comment_id}",
	Method:  "DELETE",
}

var GetReposPullsCommentsReactionsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions",
	Method:  "GET",
}

var PostReposPullsCommentsReactionsByOwnerByRepoByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions",
	Method:  "POST",
}

var DeleteReposPullsCommentsReactionsByOwnerByRepoByCommentIdByReactionId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}",
	Method:  "DELETE",
}

var GetReposPullsByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}",
	Method:  "GET",
}

var PatchReposPullsByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}",
	Method:  "PATCH",
}

var PostReposPullsCodespacesByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/codespaces",
	Method:  "POST",
}

var GetReposPullsCommentsByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/comments",
	Method:  "GET",
}

var PostReposPullsCommentsByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/comments",
	Method:  "POST",
}

var PostReposPullsCommentsRepliesByOwnerByRepoByPullNumberByCommentId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies",
	Method:  "POST",
}

var GetReposPullsCommitsByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/commits",
	Method:  "GET",
}

var GetReposPullsFilesByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/files",
	Method:  "GET",
}

var GetReposPullsMergeByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/merge",
	Method:  "GET",
}

var PutReposPullsMergeByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/merge",
	Method:  "PUT",
}

var GetReposPullsRequestedReviewersByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
	Method:  "GET",
}

var PostReposPullsRequestedReviewersByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
	Method:  "POST",
}

var DeleteReposPullsRequestedReviewersByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
	Method:  "DELETE",
}

var GetReposPullsReviewsByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
	Method:  "GET",
}

var PostReposPullsReviewsByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
	Method:  "POST",
}

var GetReposPullsReviewsByOwnerByRepoByPullNumberByReviewId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}",
	Method:  "GET",
}

var PutReposPullsReviewsByOwnerByRepoByPullNumberByReviewId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}",
	Method:  "PUT",
}

var DeleteReposPullsReviewsByOwnerByRepoByPullNumberByReviewId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}",
	Method:  "DELETE",
}

var GetReposPullsReviewsCommentsByOwnerByRepoByPullNumberByReviewId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments",
	Method:  "GET",
}

var PutReposPullsReviewsDismissalsByOwnerByRepoByPullNumberByReviewId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals",
	Method:  "PUT",
}

var PostReposPullsReviewsEventsByOwnerByRepoByPullNumberByReviewId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events",
	Method:  "POST",
}

var PutReposPullsUpdateBranchByOwnerByRepoByPullNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/pulls/{pull_number}/update-branch",
	Method:  "PUT",
}

var GetReposReadmeByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/readme",
	Method:  "GET",
}

var GetReposReadmeByOwnerByRepoByDir EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/readme/{dir}",
	Method:  "GET",
}

var GetReposReleasesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases",
	Method:  "GET",
}

var PostReposReleasesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases",
	Method:  "POST",
}

var GetReposReleasesAssetsByOwnerByRepoByAssetId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/assets/{asset_id}",
	Method:  "GET",
}

var PatchReposReleasesAssetsByOwnerByRepoByAssetId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/assets/{asset_id}",
	Method:  "PATCH",
}

var DeleteReposReleasesAssetsByOwnerByRepoByAssetId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/assets/{asset_id}",
	Method:  "DELETE",
}

var PostReposReleasesGenerateNotesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/generate-notes",
	Method:  "POST",
}

var GetReposReleasesLatestByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/latest",
	Method:  "GET",
}

var GetReposReleasesTagsByOwnerByRepoByTag EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/tags/{tag}",
	Method:  "GET",
}

var GetReposReleasesByOwnerByRepoByReleaseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}",
	Method:  "GET",
}

var PatchReposReleasesByOwnerByRepoByReleaseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}",
	Method:  "PATCH",
}

var DeleteReposReleasesByOwnerByRepoByReleaseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}",
	Method:  "DELETE",
}

var GetReposReleasesAssetsByOwnerByRepoByReleaseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}/assets",
	Method:  "GET",
}

var PostReposReleasesAssetsByOwnerByRepoByReleaseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}/assets",
	Method:  "POST",
}

var GetReposReleasesReactionsByOwnerByRepoByReleaseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}/reactions",
	Method:  "GET",
}

var PostReposReleasesReactionsByOwnerByRepoByReleaseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}/reactions",
	Method:  "POST",
}

var DeleteReposReleasesReactionsByOwnerByRepoByReleaseIdByReactionId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}",
	Method:  "DELETE",
}

var GetReposRulesBranchesByOwnerByRepoByBranch EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rules/branches/{branch}",
	Method:  "GET",
}

var GetReposRulesetsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets",
	Method:  "GET",
}

var PostReposRulesetsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets",
	Method:  "POST",
}

var GetReposRulesetsRuleSuitesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets/rule-suites",
	Method:  "GET",
}

var GetReposRulesetsRuleSuitesByOwnerByRepoByRuleSuiteId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}",
	Method:  "GET",
}

var GetReposRulesetsByOwnerByRepoByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets/{ruleset_id}",
	Method:  "GET",
}

var PutReposRulesetsByOwnerByRepoByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets/{ruleset_id}",
	Method:  "PUT",
}

var DeleteReposRulesetsByOwnerByRepoByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets/{ruleset_id}",
	Method:  "DELETE",
}

var GetReposRulesetsHistoryByOwnerByRepoByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets/{ruleset_id}/history",
	Method:  "GET",
}

var GetReposRulesetsHistoryByOwnerByRepoByRulesetIdByVersionId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}",
	Method:  "GET",
}

var GetReposSecretScanningAlertsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/secret-scanning/alerts",
	Method:  "GET",
}

var GetReposSecretScanningAlertsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}",
	Method:  "GET",
}

var PatchReposSecretScanningAlertsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}",
	Method:  "PATCH",
}

var GetReposSecretScanningAlertsLocationsByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations",
	Method:  "GET",
}

var PostReposSecretScanningPushProtectionBypassesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/secret-scanning/push-protection-bypasses",
	Method:  "POST",
}

var GetReposSecretScanningScanHistoryByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/secret-scanning/scan-history",
	Method:  "GET",
}

var GetReposSecurityAdvisoriesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/security-advisories",
	Method:  "GET",
}

var PostReposSecurityAdvisoriesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/security-advisories",
	Method:  "POST",
}

var PostReposSecurityAdvisoriesReportsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/security-advisories/reports",
	Method:  "POST",
}

var GetReposSecurityAdvisoriesByOwnerByRepoByGhsaId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/security-advisories/{ghsa_id}",
	Method:  "GET",
}

var PatchReposSecurityAdvisoriesByOwnerByRepoByGhsaId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/security-advisories/{ghsa_id}",
	Method:  "PATCH",
}

var PostReposSecurityAdvisoriesCveByOwnerByRepoByGhsaId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve",
	Method:  "POST",
}

var PostReposSecurityAdvisoriesForksByOwnerByRepoByGhsaId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks",
	Method:  "POST",
}

var GetReposStargazersByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/stargazers",
	Method:  "GET",
}

var GetReposStatsCodeFrequencyByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/stats/code_frequency",
	Method:  "GET",
}

var GetReposStatsCommitActivityByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/stats/commit_activity",
	Method:  "GET",
}

var GetReposStatsContributorsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/stats/contributors",
	Method:  "GET",
}

var GetReposStatsParticipationByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/stats/participation",
	Method:  "GET",
}

var GetReposStatsPunchCardByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/stats/punch_card",
	Method:  "GET",
}

var PostReposStatusesByOwnerByRepoBySha EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/statuses/{sha}",
	Method:  "POST",
}

var GetReposSubscribersByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/subscribers",
	Method:  "GET",
}

var GetReposSubscriptionByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/subscription",
	Method:  "GET",
}

var PutReposSubscriptionByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/subscription",
	Method:  "PUT",
}

var DeleteReposSubscriptionByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/subscription",
	Method:  "DELETE",
}

var GetReposTagsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/tags",
	Method:  "GET",
}

var GetReposTagsProtectionByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/tags/protection",
	Method:  "GET",
}

var PostReposTagsProtectionByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/tags/protection",
	Method:  "POST",
}

var DeleteReposTagsProtectionByOwnerByRepoByTagProtectionId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/tags/protection/{tag_protection_id}",
	Method:  "DELETE",
}

var GetReposTarballByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/tarball/{ref}",
	Method:  "GET",
}

var GetReposTeamsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/teams",
	Method:  "GET",
}

var GetReposTopicsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/topics",
	Method:  "GET",
}

var PutReposTopicsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/topics",
	Method:  "PUT",
}

var GetReposTrafficClonesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/traffic/clones",
	Method:  "GET",
}

var GetReposTrafficPopularPathsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/traffic/popular/paths",
	Method:  "GET",
}

var GetReposTrafficPopularReferrersByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/traffic/popular/referrers",
	Method:  "GET",
}

var GetReposTrafficViewsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/traffic/views",
	Method:  "GET",
}

var PostReposTransferByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/transfer",
	Method:  "POST",
}

var GetReposVulnerabilityAlertsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/vulnerability-alerts",
	Method:  "GET",
}

var PutReposVulnerabilityAlertsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/vulnerability-alerts",
	Method:  "PUT",
}

var DeleteReposVulnerabilityAlertsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/vulnerability-alerts",
	Method:  "DELETE",
}

var GetReposZipballByOwnerByRepoByRef EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/zipball/{ref}",
	Method:  "GET",
}

var PostReposGenerateByTemplateOwnerByTemplateRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{template_owner}/{template_repo}/generate",
	Method:  "POST",
}

var GetRepositories EndpointPattern = EndpointPattern{
	Pattern: "/repositories",
	Method:  "GET",
}

var GetSearchCode EndpointPattern = EndpointPattern{
	Pattern: "/search/code",
	Method:  "GET",
}

var GetSearchCommits EndpointPattern = EndpointPattern{
	Pattern: "/search/commits",
	Method:  "GET",
}

var GetSearchIssues EndpointPattern = EndpointPattern{
	Pattern: "/search/issues",
	Method:  "GET",
}

var GetSearchLabels EndpointPattern = EndpointPattern{
	Pattern: "/search/labels",
	Method:  "GET",
}

var GetSearchRepositories EndpointPattern = EndpointPattern{
	Pattern: "/search/repositories",
	Method:  "GET",
}

var GetSearchTopics EndpointPattern = EndpointPattern{
	Pattern: "/search/topics",
	Method:  "GET",
}

var GetSearchUsers EndpointPattern = EndpointPattern{
	Pattern: "/search/users",
	Method:  "GET",
}

var GetTeamsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}",
	Method:  "GET",
}

var PatchTeamsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}",
	Method:  "PATCH",
}

var DeleteTeamsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}",
	Method:  "DELETE",
}

var GetTeamsDiscussionsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions",
	Method:  "GET",
}

var PostTeamsDiscussionsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions",
	Method:  "POST",
}

var GetTeamsDiscussionsByTeamIdByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}",
	Method:  "GET",
}

var PatchTeamsDiscussionsByTeamIdByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}",
	Method:  "PATCH",
}

var DeleteTeamsDiscussionsByTeamIdByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}",
	Method:  "DELETE",
}

var GetTeamsDiscussionsCommentsByTeamIdByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/comments",
	Method:  "GET",
}

var PostTeamsDiscussionsCommentsByTeamIdByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/comments",
	Method:  "POST",
}

var GetTeamsDiscussionsCommentsByTeamIdByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}",
	Method:  "GET",
}

var PatchTeamsDiscussionsCommentsByTeamIdByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}",
	Method:  "PATCH",
}

var DeleteTeamsDiscussionsCommentsByTeamIdByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}",
	Method:  "DELETE",
}

var GetTeamsDiscussionsCommentsReactionsByTeamIdByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}/reactions",
	Method:  "GET",
}

var PostTeamsDiscussionsCommentsReactionsByTeamIdByDiscussionNumberByCommentNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}/reactions",
	Method:  "POST",
}

var GetTeamsDiscussionsReactionsByTeamIdByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/reactions",
	Method:  "GET",
}

var PostTeamsDiscussionsReactionsByTeamIdByDiscussionNumber EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/discussions/{discussion_number}/reactions",
	Method:  "POST",
}

var GetTeamsInvitationsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/invitations",
	Method:  "GET",
}

var GetTeamsMembersByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/members",
	Method:  "GET",
}

var GetTeamsMembersByTeamIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/members/{username}",
	Method:  "GET",
}

var PutTeamsMembersByTeamIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/members/{username}",
	Method:  "PUT",
}

var DeleteTeamsMembersByTeamIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/members/{username}",
	Method:  "DELETE",
}

var GetTeamsMembershipsByTeamIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/memberships/{username}",
	Method:  "GET",
}

var PutTeamsMembershipsByTeamIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/memberships/{username}",
	Method:  "PUT",
}

var DeleteTeamsMembershipsByTeamIdByUsername EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/memberships/{username}",
	Method:  "DELETE",
}

var GetTeamsProjectsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/projects",
	Method:  "GET",
}

var GetTeamsProjectsByTeamIdByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/projects/{project_id}",
	Method:  "GET",
}

var PutTeamsProjectsByTeamIdByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/projects/{project_id}",
	Method:  "PUT",
}

var DeleteTeamsProjectsByTeamIdByProjectId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/projects/{project_id}",
	Method:  "DELETE",
}

var GetTeamsReposByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/repos",
	Method:  "GET",
}

var GetTeamsReposByTeamIdByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/repos/{owner}/{repo}",
	Method:  "GET",
}

var PutTeamsReposByTeamIdByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/repos/{owner}/{repo}",
	Method:  "PUT",
}

var DeleteTeamsReposByTeamIdByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/repos/{owner}/{repo}",
	Method:  "DELETE",
}

var GetTeamsTeamsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/teams",
	Method:  "GET",
}

var GetUser EndpointPattern = EndpointPattern{
	Pattern: "/user",
	Method:  "GET",
}

var PatchUser EndpointPattern = EndpointPattern{
	Pattern: "/user",
	Method:  "PATCH",
}

var GetUserBlocks EndpointPattern = EndpointPattern{
	Pattern: "/user/blocks",
	Method:  "GET",
}

var GetUserBlocksByUsername EndpointPattern = EndpointPattern{
	Pattern: "/user/blocks/{username}",
	Method:  "GET",
}

var PutUserBlocksByUsername EndpointPattern = EndpointPattern{
	Pattern: "/user/blocks/{username}",
	Method:  "PUT",
}

var DeleteUserBlocksByUsername EndpointPattern = EndpointPattern{
	Pattern: "/user/blocks/{username}",
	Method:  "DELETE",
}

var GetUserCodespaces EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces",
	Method:  "GET",
}

var PostUserCodespaces EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces",
	Method:  "POST",
}

var GetUserCodespacesSecrets EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets",
	Method:  "GET",
}

var GetUserCodespacesSecretsPublicKey EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/public-key",
	Method:  "GET",
}

var GetUserCodespacesSecretsBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/{secret_name}",
	Method:  "GET",
}

var PutUserCodespacesSecretsBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/{secret_name}",
	Method:  "PUT",
}

var DeleteUserCodespacesSecretsBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/{secret_name}",
	Method:  "DELETE",
}

var GetUserCodespacesSecretsRepositoriesBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/{secret_name}/repositories",
	Method:  "GET",
}

var PutUserCodespacesSecretsRepositoriesBySecretName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/{secret_name}/repositories",
	Method:  "PUT",
}

var PutUserCodespacesSecretsRepositoriesBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteUserCodespacesSecretsRepositoriesBySecretNameByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/secrets/{secret_name}/repositories/{repository_id}",
	Method:  "DELETE",
}

var GetUserCodespacesByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}",
	Method:  "GET",
}

var PatchUserCodespacesByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}",
	Method:  "PATCH",
}

var DeleteUserCodespacesByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}",
	Method:  "DELETE",
}

var PostUserCodespacesExportsByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}/exports",
	Method:  "POST",
}

var GetUserCodespacesExportsByCodespaceNameByExportId EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}/exports/{export_id}",
	Method:  "GET",
}

var GetUserCodespacesMachinesByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}/machines",
	Method:  "GET",
}

var PostUserCodespacesPublishByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}/publish",
	Method:  "POST",
}

var PostUserCodespacesStartByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}/start",
	Method:  "POST",
}

var PostUserCodespacesStopByCodespaceName EndpointPattern = EndpointPattern{
	Pattern: "/user/codespaces/{codespace_name}/stop",
	Method:  "POST",
}

var GetUserDockerConflicts EndpointPattern = EndpointPattern{
	Pattern: "/user/docker/conflicts",
	Method:  "GET",
}

var PatchUserEmailVisibility EndpointPattern = EndpointPattern{
	Pattern: "/user/email/visibility",
	Method:  "PATCH",
}

var GetUserEmails EndpointPattern = EndpointPattern{
	Pattern: "/user/emails",
	Method:  "GET",
}

var PostUserEmails EndpointPattern = EndpointPattern{
	Pattern: "/user/emails",
	Method:  "POST",
}

var DeleteUserEmails EndpointPattern = EndpointPattern{
	Pattern: "/user/emails",
	Method:  "DELETE",
}

var GetUserFollowers EndpointPattern = EndpointPattern{
	Pattern: "/user/followers",
	Method:  "GET",
}

var GetUserFollowing EndpointPattern = EndpointPattern{
	Pattern: "/user/following",
	Method:  "GET",
}

var GetUserFollowingByUsername EndpointPattern = EndpointPattern{
	Pattern: "/user/following/{username}",
	Method:  "GET",
}

var PutUserFollowingByUsername EndpointPattern = EndpointPattern{
	Pattern: "/user/following/{username}",
	Method:  "PUT",
}

var DeleteUserFollowingByUsername EndpointPattern = EndpointPattern{
	Pattern: "/user/following/{username}",
	Method:  "DELETE",
}

var GetUserGpgKeys EndpointPattern = EndpointPattern{
	Pattern: "/user/gpg_keys",
	Method:  "GET",
}

var PostUserGpgKeys EndpointPattern = EndpointPattern{
	Pattern: "/user/gpg_keys",
	Method:  "POST",
}

var GetUserGpgKeysByGpgKeyId EndpointPattern = EndpointPattern{
	Pattern: "/user/gpg_keys/{gpg_key_id}",
	Method:  "GET",
}

var DeleteUserGpgKeysByGpgKeyId EndpointPattern = EndpointPattern{
	Pattern: "/user/gpg_keys/{gpg_key_id}",
	Method:  "DELETE",
}

var GetUserInstallations EndpointPattern = EndpointPattern{
	Pattern: "/user/installations",
	Method:  "GET",
}

var GetUserInstallationsRepositoriesByInstallationId EndpointPattern = EndpointPattern{
	Pattern: "/user/installations/{installation_id}/repositories",
	Method:  "GET",
}

var PutUserInstallationsRepositoriesByInstallationIdByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/user/installations/{installation_id}/repositories/{repository_id}",
	Method:  "PUT",
}

var DeleteUserInstallationsRepositoriesByInstallationIdByRepositoryId EndpointPattern = EndpointPattern{
	Pattern: "/user/installations/{installation_id}/repositories/{repository_id}",
	Method:  "DELETE",
}

var GetUserInteractionLimits EndpointPattern = EndpointPattern{
	Pattern: "/user/interaction-limits",
	Method:  "GET",
}

var PutUserInteractionLimits EndpointPattern = EndpointPattern{
	Pattern: "/user/interaction-limits",
	Method:  "PUT",
}

var DeleteUserInteractionLimits EndpointPattern = EndpointPattern{
	Pattern: "/user/interaction-limits",
	Method:  "DELETE",
}

var GetUserIssues EndpointPattern = EndpointPattern{
	Pattern: "/user/issues",
	Method:  "GET",
}

var GetUserKeys EndpointPattern = EndpointPattern{
	Pattern: "/user/keys",
	Method:  "GET",
}

var PostUserKeys EndpointPattern = EndpointPattern{
	Pattern: "/user/keys",
	Method:  "POST",
}

var GetUserKeysByKeyId EndpointPattern = EndpointPattern{
	Pattern: "/user/keys/{key_id}",
	Method:  "GET",
}

var DeleteUserKeysByKeyId EndpointPattern = EndpointPattern{
	Pattern: "/user/keys/{key_id}",
	Method:  "DELETE",
}

var GetUserMarketplacePurchases EndpointPattern = EndpointPattern{
	Pattern: "/user/marketplace_purchases",
	Method:  "GET",
}

var GetUserMarketplacePurchasesStubbed EndpointPattern = EndpointPattern{
	Pattern: "/user/marketplace_purchases/stubbed",
	Method:  "GET",
}

var GetUserMembershipsOrgs EndpointPattern = EndpointPattern{
	Pattern: "/user/memberships/orgs",
	Method:  "GET",
}

var GetUserMembershipsOrgsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/user/memberships/orgs/{org}",
	Method:  "GET",
}

var PatchUserMembershipsOrgsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/user/memberships/orgs/{org}",
	Method:  "PATCH",
}

var GetUserMigrations EndpointPattern = EndpointPattern{
	Pattern: "/user/migrations",
	Method:  "GET",
}

var PostUserMigrations EndpointPattern = EndpointPattern{
	Pattern: "/user/migrations",
	Method:  "POST",
}

var GetUserMigrationsByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/user/migrations/{migration_id}",
	Method:  "GET",
}

var GetUserMigrationsArchiveByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/user/migrations/{migration_id}/archive",
	Method:  "GET",
}

var DeleteUserMigrationsArchiveByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/user/migrations/{migration_id}/archive",
	Method:  "DELETE",
}

var DeleteUserMigrationsReposLockByMigrationIdByRepoName EndpointPattern = EndpointPattern{
	Pattern: "/user/migrations/{migration_id}/repos/{repo_name}/lock",
	Method:  "DELETE",
}

var GetUserMigrationsRepositoriesByMigrationId EndpointPattern = EndpointPattern{
	Pattern: "/user/migrations/{migration_id}/repositories",
	Method:  "GET",
}

var GetUserOrgs EndpointPattern = EndpointPattern{
	Pattern: "/user/orgs",
	Method:  "GET",
}

var GetUserPackages EndpointPattern = EndpointPattern{
	Pattern: "/user/packages",
	Method:  "GET",
}

var GetUserPackagesByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/user/packages/{package_type}/{package_name}",
	Method:  "GET",
}

var DeleteUserPackagesByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/user/packages/{package_type}/{package_name}",
	Method:  "DELETE",
}

var PostUserPackagesRestoreByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/user/packages/{package_type}/{package_name}/restore",
	Method:  "POST",
}

var GetUserPackagesVersionsByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/user/packages/{package_type}/{package_name}/versions",
	Method:  "GET",
}

var GetUserPackagesVersionsByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/user/packages/{package_type}/{package_name}/versions/{package_version_id}",
	Method:  "GET",
}

var DeleteUserPackagesVersionsByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/user/packages/{package_type}/{package_name}/versions/{package_version_id}",
	Method:  "DELETE",
}

var PostUserPackagesVersionsRestoreByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/user/packages/{package_type}/{package_name}/versions/{package_version_id}/restore",
	Method:  "POST",
}

var PostUserProjects EndpointPattern = EndpointPattern{
	Pattern: "/user/projects",
	Method:  "POST",
}

var GetUserPublicEmails EndpointPattern = EndpointPattern{
	Pattern: "/user/public_emails",
	Method:  "GET",
}

var GetUserRepos EndpointPattern = EndpointPattern{
	Pattern: "/user/repos",
	Method:  "GET",
}

var PostUserRepos EndpointPattern = EndpointPattern{
	Pattern: "/user/repos",
	Method:  "POST",
}

var GetUserRepositoryInvitations EndpointPattern = EndpointPattern{
	Pattern: "/user/repository_invitations",
	Method:  "GET",
}

var PatchUserRepositoryInvitationsByInvitationId EndpointPattern = EndpointPattern{
	Pattern: "/user/repository_invitations/{invitation_id}",
	Method:  "PATCH",
}

var DeleteUserRepositoryInvitationsByInvitationId EndpointPattern = EndpointPattern{
	Pattern: "/user/repository_invitations/{invitation_id}",
	Method:  "DELETE",
}

var GetUserSocialAccounts EndpointPattern = EndpointPattern{
	Pattern: "/user/social_accounts",
	Method:  "GET",
}

var PostUserSocialAccounts EndpointPattern = EndpointPattern{
	Pattern: "/user/social_accounts",
	Method:  "POST",
}

var DeleteUserSocialAccounts EndpointPattern = EndpointPattern{
	Pattern: "/user/social_accounts",
	Method:  "DELETE",
}

var GetUserSshSigningKeys EndpointPattern = EndpointPattern{
	Pattern: "/user/ssh_signing_keys",
	Method:  "GET",
}

var PostUserSshSigningKeys EndpointPattern = EndpointPattern{
	Pattern: "/user/ssh_signing_keys",
	Method:  "POST",
}

var GetUserSshSigningKeysBySshSigningKeyId EndpointPattern = EndpointPattern{
	Pattern: "/user/ssh_signing_keys/{ssh_signing_key_id}",
	Method:  "GET",
}

var DeleteUserSshSigningKeysBySshSigningKeyId EndpointPattern = EndpointPattern{
	Pattern: "/user/ssh_signing_keys/{ssh_signing_key_id}",
	Method:  "DELETE",
}

var GetUserStarred EndpointPattern = EndpointPattern{
	Pattern: "/user/starred",
	Method:  "GET",
}

var GetUserStarredByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/user/starred/{owner}/{repo}",
	Method:  "GET",
}

var PutUserStarredByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/user/starred/{owner}/{repo}",
	Method:  "PUT",
}

var DeleteUserStarredByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/user/starred/{owner}/{repo}",
	Method:  "DELETE",
}

var GetUserSubscriptions EndpointPattern = EndpointPattern{
	Pattern: "/user/subscriptions",
	Method:  "GET",
}

var GetUserTeams EndpointPattern = EndpointPattern{
	Pattern: "/user/teams",
	Method:  "GET",
}

var GetUserByAccountId EndpointPattern = EndpointPattern{
	Pattern: "/user/{account_id}",
	Method:  "GET",
}

var GetUsers EndpointPattern = EndpointPattern{
	Pattern: "/users",
	Method:  "GET",
}

var GetUsersByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}",
	Method:  "GET",
}

var PostUsersAttestationsDeleteRequestByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/attestations/delete-request",
	Method:  "POST",
}

var DeleteUsersAttestationsDigestByUsernameBySubjectDigest EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/attestations/digest/{subject_digest}",
	Method:  "DELETE",
}

var DeleteUsersAttestationsByUsernameByAttestationId EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/attestations/{attestation_id}",
	Method:  "DELETE",
}

var GetUsersAttestationsByUsernameBySubjectDigest EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/attestations/{subject_digest}",
	Method:  "GET",
}

var GetUsersDockerConflictsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/docker/conflicts",
	Method:  "GET",
}

var GetUsersEventsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/events",
	Method:  "GET",
}

var GetUsersEventsOrgsByUsernameByOrg EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/events/orgs/{org}",
	Method:  "GET",
}

var GetUsersEventsPublicByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/events/public",
	Method:  "GET",
}

var GetUsersFollowersByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/followers",
	Method:  "GET",
}

var GetUsersFollowingByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/following",
	Method:  "GET",
}

var GetUsersFollowingByUsernameByTargetUser EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/following/{target_user}",
	Method:  "GET",
}

var GetUsersGistsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/gists",
	Method:  "GET",
}

var GetUsersGpgKeysByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/gpg_keys",
	Method:  "GET",
}

var GetUsersHovercardByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/hovercard",
	Method:  "GET",
}

var GetUsersInstallationByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/installation",
	Method:  "GET",
}

var GetUsersKeysByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/keys",
	Method:  "GET",
}

var GetUsersOrgsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/orgs",
	Method:  "GET",
}

var GetUsersPackagesByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages",
	Method:  "GET",
}

var GetUsersPackagesByUsernameByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages/{package_type}/{package_name}",
	Method:  "GET",
}

var DeleteUsersPackagesByUsernameByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages/{package_type}/{package_name}",
	Method:  "DELETE",
}

var PostUsersPackagesRestoreByUsernameByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages/{package_type}/{package_name}/restore",
	Method:  "POST",
}

var GetUsersPackagesVersionsByUsernameByPackageTypeByPackageName EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages/{package_type}/{package_name}/versions",
	Method:  "GET",
}

var GetUsersPackagesVersionsByUsernameByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}",
	Method:  "GET",
}

var DeleteUsersPackagesVersionsByUsernameByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}",
	Method:  "DELETE",
}

var PostUsersPackagesVersionsRestoreByUsernameByPackageTypeByPackageNameByPackageVersionId EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore",
	Method:  "POST",
}

var GetUsersProjectsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/projects",
	Method:  "GET",
}

var GetUsersReceivedEventsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/received_events",
	Method:  "GET",
}

var GetUsersReceivedEventsPublicByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/received_events/public",
	Method:  "GET",
}

var GetUsersReposByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/repos",
	Method:  "GET",
}

var GetUsersSettingsBillingActionsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/settings/billing/actions",
	Method:  "GET",
}

var GetUsersSettingsBillingPackagesByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/settings/billing/packages",
	Method:  "GET",
}

var GetUsersSettingsBillingSharedStorageByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/settings/billing/shared-storage",
	Method:  "GET",
}

var GetUsersSettingsBillingUsageByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/settings/billing/usage",
	Method:  "GET",
}

var GetUsersSocialAccountsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/social_accounts",
	Method:  "GET",
}

var GetUsersSshSigningKeysByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/ssh_signing_keys",
	Method:  "GET",
}

var GetUsersStarredByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/starred",
	Method:  "GET",
}

var GetUsersSubscriptionsByUsername EndpointPattern = EndpointPattern{
	Pattern: "/users/{username}/subscriptions",
	Method:  "GET",
}

var GetVersions EndpointPattern = EndpointPattern{
	Pattern: "/versions",
	Method:  "GET",
}

var GetZen EndpointPattern = EndpointPattern{
	Pattern: "/zen",
	Method:  "GET",
}

var GetEnterpriseInstallationServerStatisticsByEnterpriseOrOrg EndpointPattern = EndpointPattern{
	Pattern: "/enterprise-installation/{enterprise_or_org}/server-statistics",
	Method:  "GET",
}

var GetEnterprisesActionsCacheUsageByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/cache/usage",
	Method:  "GET",
}

var GetEnterprisesActionsHostedRunnersByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners",
	Method:  "GET",
}

var PostEnterprisesActionsHostedRunnersByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners",
	Method:  "POST",
}

var GetEnterprisesActionsHostedRunnersImagesGithubOwnedByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/images/github-owned",
	Method:  "GET",
}

var GetEnterprisesActionsHostedRunnersImagesPartnerByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/images/partner",
	Method:  "GET",
}

var GetEnterprisesActionsHostedRunnersLimitsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/limits",
	Method:  "GET",
}

var GetEnterprisesActionsHostedRunnersMachineSizesByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/machine-sizes",
	Method:  "GET",
}

var GetEnterprisesActionsHostedRunnersPlatformsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/platforms",
	Method:  "GET",
}

var GetEnterprisesActionsHostedRunnersByEnterpriseByHostedRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/{hosted_runner_id}",
	Method:  "GET",
}

var PatchEnterprisesActionsHostedRunnersByEnterpriseByHostedRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/{hosted_runner_id}",
	Method:  "PATCH",
}

var DeleteEnterprisesActionsHostedRunnersByEnterpriseByHostedRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/hosted-runners/{hosted_runner_id}",
	Method:  "DELETE",
}

var PutEnterprisesActionsOidcCustomizationIssuerByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/oidc/customization/issuer",
	Method:  "PUT",
}

var GetEnterprisesActionsPermissionsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions",
	Method:  "GET",
}

var PutEnterprisesActionsPermissionsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions",
	Method:  "PUT",
}

var GetEnterprisesActionsPermissionsOrganizationsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/organizations",
	Method:  "GET",
}

var PutEnterprisesActionsPermissionsOrganizationsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/organizations",
	Method:  "PUT",
}

var PutEnterprisesActionsPermissionsOrganizationsByEnterpriseByOrgId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/organizations/{org_id}",
	Method:  "PUT",
}

var DeleteEnterprisesActionsPermissionsOrganizationsByEnterpriseByOrgId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/organizations/{org_id}",
	Method:  "DELETE",
}

var GetEnterprisesActionsPermissionsSelectedActionsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/selected-actions",
	Method:  "GET",
}

var PutEnterprisesActionsPermissionsSelectedActionsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/selected-actions",
	Method:  "PUT",
}

var GetEnterprisesActionsPermissionsWorkflowByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/workflow",
	Method:  "GET",
}

var PutEnterprisesActionsPermissionsWorkflowByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/permissions/workflow",
	Method:  "PUT",
}

var GetEnterprisesActionsRunnerGroupsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups",
	Method:  "GET",
}

var PostEnterprisesActionsRunnerGroupsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups",
	Method:  "POST",
}

var GetEnterprisesActionsRunnerGroupsByEnterpriseByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}",
	Method:  "GET",
}

var PatchEnterprisesActionsRunnerGroupsByEnterpriseByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}",
	Method:  "PATCH",
}

var DeleteEnterprisesActionsRunnerGroupsByEnterpriseByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}",
	Method:  "DELETE",
}

var GetEnterprisesActionsRunnerGroupsOrganizationsByEnterpriseByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/organizations",
	Method:  "GET",
}

var PutEnterprisesActionsRunnerGroupsOrganizationsByEnterpriseByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/organizations",
	Method:  "PUT",
}

var PutEnterprisesActionsRunnerGroupsOrganizationsByEnterpriseByRunnerGroupIdByOrgId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/organizations/{org_id}",
	Method:  "PUT",
}

var DeleteEnterprisesActionsRunnerGroupsOrganizationsByEnterpriseByRunnerGroupIdByOrgId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/organizations/{org_id}",
	Method:  "DELETE",
}

var GetEnterprisesActionsRunnerGroupsRunnersByEnterpriseByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/runners",
	Method:  "GET",
}

var PutEnterprisesActionsRunnerGroupsRunnersByEnterpriseByRunnerGroupId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/runners",
	Method:  "PUT",
}

var PutEnterprisesActionsRunnerGroupsRunnersByEnterpriseByRunnerGroupIdByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/runners/{runner_id}",
	Method:  "PUT",
}

var DeleteEnterprisesActionsRunnerGroupsRunnersByEnterpriseByRunnerGroupIdByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runner-groups/{runner_group_id}/runners/{runner_id}",
	Method:  "DELETE",
}

var GetEnterprisesActionsRunnersByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners",
	Method:  "GET",
}

var GetEnterprisesActionsRunnersDownloadsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/downloads",
	Method:  "GET",
}

var PostEnterprisesActionsRunnersGenerateJitconfigByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/generate-jitconfig",
	Method:  "POST",
}

var PostEnterprisesActionsRunnersRegistrationTokenByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/registration-token",
	Method:  "POST",
}

var PostEnterprisesActionsRunnersRemoveTokenByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/remove-token",
	Method:  "POST",
}

var GetEnterprisesActionsRunnersByEnterpriseByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/{runner_id}",
	Method:  "GET",
}

var DeleteEnterprisesActionsRunnersByEnterpriseByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/{runner_id}",
	Method:  "DELETE",
}

var GetEnterprisesActionsRunnersLabelsByEnterpriseByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/{runner_id}/labels",
	Method:  "GET",
}

var PostEnterprisesActionsRunnersLabelsByEnterpriseByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/{runner_id}/labels",
	Method:  "POST",
}

var PutEnterprisesActionsRunnersLabelsByEnterpriseByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/{runner_id}/labels",
	Method:  "PUT",
}

var DeleteEnterprisesActionsRunnersLabelsByEnterpriseByRunnerId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/{runner_id}/labels",
	Method:  "DELETE",
}

var DeleteEnterprisesActionsRunnersLabelsByEnterpriseByRunnerIdByName EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/actions/runners/{runner_id}/labels/{name}",
	Method:  "DELETE",
}

var GetEnterprisesAnnouncementByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/announcement",
	Method:  "GET",
}

var PatchEnterprisesAnnouncementByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/announcement",
	Method:  "PATCH",
}

var DeleteEnterprisesAnnouncementByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/announcement",
	Method:  "DELETE",
}

var GetEnterprisesAuditLogByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/audit-log",
	Method:  "GET",
}

var GetEnterprisesAuditLogStreamKeyByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/audit-log/stream-key",
	Method:  "GET",
}

var GetEnterprisesAuditLogStreamsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/audit-log/streams",
	Method:  "GET",
}

var PostEnterprisesAuditLogStreamsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/audit-log/streams",
	Method:  "POST",
}

var GetEnterprisesAuditLogStreamsByEnterpriseByStreamId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/audit-log/streams/{stream_id}",
	Method:  "GET",
}

var PutEnterprisesAuditLogStreamsByEnterpriseByStreamId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/audit-log/streams/{stream_id}",
	Method:  "PUT",
}

var DeleteEnterprisesAuditLogStreamsByEnterpriseByStreamId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/audit-log/streams/{stream_id}",
	Method:  "DELETE",
}

var GetEnterprisesBypassRequestsPushRulesByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/bypass-requests/push-rules",
	Method:  "GET",
}

var GetEnterprisesCodeScanningAlertsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code-scanning/alerts",
	Method:  "GET",
}

var GetEnterprisesCodeSecurityAndAnalysisByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code_security_and_analysis",
	Method:  "GET",
}

var PatchEnterprisesCodeSecurityAndAnalysisByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/code_security_and_analysis",
	Method:  "PATCH",
}

var GetEnterprisesConsumedLicensesByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/consumed-licenses",
	Method:  "GET",
}

var GetEnterprisesCopilotBillingSeatsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/copilot/billing/seats",
	Method:  "GET",
}

var GetEnterprisesCopilotMetricsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/copilot/metrics",
	Method:  "GET",
}

var GetEnterprisesLicenseSyncStatusByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/license-sync-status",
	Method:  "GET",
}

var GetEnterprisesMembersCopilotByEnterpriseByUsername EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/members/{username}/copilot",
	Method:  "GET",
}

var GetEnterprisesNetworkConfigurationsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/network-configurations",
	Method:  "GET",
}

var PostEnterprisesNetworkConfigurationsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/network-configurations",
	Method:  "POST",
}

var GetEnterprisesNetworkConfigurationsByEnterpriseByNetworkConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/network-configurations/{network_configuration_id}",
	Method:  "GET",
}

var PatchEnterprisesNetworkConfigurationsByEnterpriseByNetworkConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/network-configurations/{network_configuration_id}",
	Method:  "PATCH",
}

var DeleteEnterprisesNetworkConfigurationsByEnterpriseByNetworkConfigurationId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/network-configurations/{network_configuration_id}",
	Method:  "DELETE",
}

var GetEnterprisesNetworkSettingsByEnterpriseByNetworkSettingsId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/network-settings/{network_settings_id}",
	Method:  "GET",
}

var GetEnterprisesPropertiesSchemaByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/properties/schema",
	Method:  "GET",
}

var PatchEnterprisesPropertiesSchemaByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/properties/schema",
	Method:  "PATCH",
}

var PutEnterprisesPropertiesSchemaOrganizationsPromoteByEnterpriseByOrgByCustomPropertyName EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/properties/schema/organizations/{org}/{custom_property_name}/promote",
	Method:  "PUT",
}

var GetEnterprisesPropertiesSchemaByEnterpriseByCustomPropertyName EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/properties/schema/{custom_property_name}",
	Method:  "GET",
}

var PutEnterprisesPropertiesSchemaByEnterpriseByCustomPropertyName EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/properties/schema/{custom_property_name}",
	Method:  "PUT",
}

var DeleteEnterprisesPropertiesSchemaByEnterpriseByCustomPropertyName EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/properties/schema/{custom_property_name}",
	Method:  "DELETE",
}

var PostEnterprisesRulesetsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/rulesets",
	Method:  "POST",
}

var GetEnterprisesRulesetsByEnterpriseByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/rulesets/{ruleset_id}",
	Method:  "GET",
}

var PutEnterprisesRulesetsByEnterpriseByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/rulesets/{ruleset_id}",
	Method:  "PUT",
}

var DeleteEnterprisesRulesetsByEnterpriseByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/rulesets/{ruleset_id}",
	Method:  "DELETE",
}

var GetEnterprisesRulesetsHistoryByEnterpriseByRulesetId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/rulesets/{ruleset_id}/history",
	Method:  "GET",
}

var GetEnterprisesRulesetsHistoryByEnterpriseByRulesetIdByVersionId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/rulesets/{ruleset_id}/history/{version_id}",
	Method:  "GET",
}

var GetEnterprisesSettingsBillingActionsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/actions",
	Method:  "GET",
}

var GetEnterprisesSettingsBillingAdvancedSecurityByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/advanced-security",
	Method:  "GET",
}

var GetEnterprisesSettingsBillingCostCentersByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/cost-centers",
	Method:  "GET",
}

var PostEnterprisesSettingsBillingCostCentersResourceByEnterpriseByCostCenterId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}/resource",
	Method:  "POST",
}

var DeleteEnterprisesSettingsBillingCostCentersResourceByEnterpriseByCostCenterId EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/cost-centers/{cost_center_id}/resource",
	Method:  "DELETE",
}

var GetEnterprisesSettingsBillingPackagesByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/packages",
	Method:  "GET",
}

var GetEnterprisesSettingsBillingSharedStorageByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/shared-storage",
	Method:  "GET",
}

var GetEnterprisesSettingsBillingUsageByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/settings/billing/usage",
	Method:  "GET",
}

var GetEnterprisesTeamCopilotMetricsByEnterpriseByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/team/{team_slug}/copilot/metrics",
	Method:  "GET",
}

var PostEnterprisesByEnterpriseBySecurityProductByEnablement EndpointPattern = EndpointPattern{
	Pattern: "/enterprises/{enterprise}/{security_product}/{enablement}",
	Method:  "POST",
}

var GetOrganizationsCustomRolesByOrganizationId EndpointPattern = EndpointPattern{
	Pattern: "/organizations/{organization_id}/custom_roles",
	Method:  "GET",
}

var GetOrgsAnnouncementByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/announcement",
	Method:  "GET",
}

var PatchOrgsAnnouncementByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/announcement",
	Method:  "PATCH",
}

var DeleteOrgsAnnouncementByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/announcement",
	Method:  "DELETE",
}

var GetOrgsAuditLogByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/audit-log",
	Method:  "GET",
}

var GetOrgsBypassRequestsPushRulesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/bypass-requests/push-rules",
	Method:  "GET",
}

var GetOrgsBypassRequestsSecretScanningByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/bypass-requests/secret-scanning",
	Method:  "GET",
}

var GetOrgsCredentialAuthorizationsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/credential-authorizations",
	Method:  "GET",
}

var DeleteOrgsCredentialAuthorizationsByOrgByCredentialId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/credential-authorizations/{credential_id}",
	Method:  "DELETE",
}

var GetOrgsCustomRepositoryRolesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom-repository-roles",
	Method:  "GET",
}

var PostOrgsCustomRepositoryRolesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom-repository-roles",
	Method:  "POST",
}

var GetOrgsCustomRepositoryRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom-repository-roles/{role_id}",
	Method:  "GET",
}

var PatchOrgsCustomRepositoryRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom-repository-roles/{role_id}",
	Method:  "PATCH",
}

var DeleteOrgsCustomRepositoryRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom-repository-roles/{role_id}",
	Method:  "DELETE",
}

var PostOrgsCustomRolesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom_roles",
	Method:  "POST",
}

var GetOrgsCustomRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom_roles/{role_id}",
	Method:  "GET",
}

var PatchOrgsCustomRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom_roles/{role_id}",
	Method:  "PATCH",
}

var DeleteOrgsCustomRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/custom_roles/{role_id}",
	Method:  "DELETE",
}

var GetOrgsDismissalRequestsSecretScanningByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/dismissal-requests/secret-scanning",
	Method:  "GET",
}

var GetOrgsExternalGroupByOrgByGroupId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/external-group/{group_id}",
	Method:  "GET",
}

var GetOrgsExternalGroupsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/external-groups",
	Method:  "GET",
}

var GetOrgsFineGrainedPermissionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/fine_grained_permissions",
	Method:  "GET",
}

var GetOrgsOrganizationFineGrainedPermissionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-fine-grained-permissions",
	Method:  "GET",
}

var PostOrgsOrganizationRolesByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles",
	Method:  "POST",
}

var PatchOrgsOrganizationRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/{role_id}",
	Method:  "PATCH",
}

var DeleteOrgsOrganizationRolesByOrgByRoleId EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/organization-roles/{role_id}",
	Method:  "DELETE",
}

var GetOrgsRepositoryFineGrainedPermissionsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/repository-fine-grained-permissions",
	Method:  "GET",
}

var GetOrgsSettingsBillingAdvancedSecurityByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/settings/billing/advanced-security",
	Method:  "GET",
}

var GetOrgsTeamSyncGroupsByOrg EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/team-sync/groups",
	Method:  "GET",
}

var GetOrgsTeamsExternalGroupsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/external-groups",
	Method:  "GET",
}

var PatchOrgsTeamsExternalGroupsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/external-groups",
	Method:  "PATCH",
}

var DeleteOrgsTeamsExternalGroupsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/external-groups",
	Method:  "DELETE",
}

var GetOrgsTeamsTeamSyncGroupMappingsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/team-sync/group-mappings",
	Method:  "GET",
}

var PatchOrgsTeamsTeamSyncGroupMappingsByOrgByTeamSlug EndpointPattern = EndpointPattern{
	Pattern: "/orgs/{org}/teams/{team_slug}/team-sync/group-mappings",
	Method:  "PATCH",
}

var GetReposBypassRequestsPushRulesByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/bypass-requests/push-rules",
	Method:  "GET",
}

var GetReposBypassRequestsPushRulesByOwnerByRepoByBypassRequestNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/bypass-requests/push-rules/{bypass_request_number}",
	Method:  "GET",
}

var GetReposBypassRequestsSecretScanningByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/bypass-requests/secret-scanning",
	Method:  "GET",
}

var GetReposBypassRequestsSecretScanningByOwnerByRepoByBypassRequestNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/bypass-requests/secret-scanning/{bypass_request_number}",
	Method:  "GET",
}

var PatchReposBypassRequestsSecretScanningByOwnerByRepoByBypassRequestNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/bypass-requests/secret-scanning/{bypass_request_number}",
	Method:  "PATCH",
}

var DeleteReposBypassResponsesSecretScanningByOwnerByRepoByBypassResponseId EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/bypass-responses/secret-scanning/{bypass_response_id}",
	Method:  "DELETE",
}

var GetReposDismissalRequestsSecretScanningByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dismissal-requests/secret-scanning",
	Method:  "GET",
}

var GetReposDismissalRequestsSecretScanningByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dismissal-requests/secret-scanning/{alert_number}",
	Method:  "GET",
}

var PatchReposDismissalRequestsSecretScanningByOwnerByRepoByAlertNumber EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/dismissal-requests/secret-scanning/{alert_number}",
	Method:  "PATCH",
}

var PutReposLfsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/lfs",
	Method:  "PUT",
}

var DeleteReposLfsByOwnerByRepo EndpointPattern = EndpointPattern{
	Pattern: "/repos/{owner}/{repo}/lfs",
	Method:  "DELETE",
}

var GetScimV2EnterprisesGroupsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Groups",
	Method:  "GET",
}

var PostScimV2EnterprisesGroupsByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Groups",
	Method:  "POST",
}

var GetScimV2EnterprisesGroupsByEnterpriseByScimGroupId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Groups/{scim_group_id}",
	Method:  "GET",
}

var PutScimV2EnterprisesGroupsByEnterpriseByScimGroupId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Groups/{scim_group_id}",
	Method:  "PUT",
}

var PatchScimV2EnterprisesGroupsByEnterpriseByScimGroupId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Groups/{scim_group_id}",
	Method:  "PATCH",
}

var DeleteScimV2EnterprisesGroupsByEnterpriseByScimGroupId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Groups/{scim_group_id}",
	Method:  "DELETE",
}

var GetScimV2EnterprisesUsersByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Users",
	Method:  "GET",
}

var PostScimV2EnterprisesUsersByEnterprise EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Users",
	Method:  "POST",
}

var GetScimV2EnterprisesUsersByEnterpriseByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Users/{scim_user_id}",
	Method:  "GET",
}

var PutScimV2EnterprisesUsersByEnterpriseByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Users/{scim_user_id}",
	Method:  "PUT",
}

var PatchScimV2EnterprisesUsersByEnterpriseByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Users/{scim_user_id}",
	Method:  "PATCH",
}

var DeleteScimV2EnterprisesUsersByEnterpriseByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/enterprises/{enterprise}/Users/{scim_user_id}",
	Method:  "DELETE",
}

var GetScimV2OrganizationsUsersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/organizations/{org}/Users",
	Method:  "GET",
}

var PostScimV2OrganizationsUsersByOrg EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/organizations/{org}/Users",
	Method:  "POST",
}

var GetScimV2OrganizationsUsersByOrgByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/organizations/{org}/Users/{scim_user_id}",
	Method:  "GET",
}

var PutScimV2OrganizationsUsersByOrgByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/organizations/{org}/Users/{scim_user_id}",
	Method:  "PUT",
}

var PatchScimV2OrganizationsUsersByOrgByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/organizations/{org}/Users/{scim_user_id}",
	Method:  "PATCH",
}

var DeleteScimV2OrganizationsUsersByOrgByScimUserId EndpointPattern = EndpointPattern{
	Pattern: "/scim/v2/organizations/{org}/Users/{scim_user_id}",
	Method:  "DELETE",
}

var GetTeamsTeamSyncGroupMappingsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/team-sync/group-mappings",
	Method:  "GET",
}

var PatchTeamsTeamSyncGroupMappingsByTeamId EndpointPattern = EndpointPattern{
	Pattern: "/teams/{team_id}/team-sync/group-mappings",
	Method:  "PATCH",
}
