load(
    'scripts/lib.star',
    'build_image',
    'publish_image',
    'pipeline',
    'lint_backend_step',
    'codespell_step',
    'shellcheck_step',
    'test_backend_step',
    'test_frontend_step',
    'build_backend_step',
    'build_frontend_step',
    'build_plugins_step',
    'package_step',
    'e2e_tests_server_step',
    'e2e_tests_step',
    'build_storybook_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'get_windows_steps',
    'benchmark_ldap_step',
    'ldap_service',
    'frontend_metrics_step',
    'publish_storybook_step',
    'upload_packages_step',
    'publish_packages_step',
    'notify_pipeline',
    'integration_test_services',
)

ver_mode = 'release'

def release_npm_packages_step(edition):
    if edition == 'enterprise':
        return None

    return {
        'name': 'release-npm-packages',
        'image': build_image,
        'depends_on': [
            'end-to-end-tests',
        ],
        'environment': {
            'NPM_TOKEN': {
                'from_secret': 'npm_token',
            },
        },
        'commands': [
            './node_modules/.bin/lerna bootstrap',
            'echo "//registry.npmjs.org/:_authToken=$${NPM_TOKEN}" >> ~/.npmrc',
            './scripts/build/release-packages.sh "${DRONE_TAG}"',
        ],
    }

def get_steps(edition):
    steps = [
        lint_backend_step(edition),
        codespell_step(),
        shellcheck_step(),
        test_backend_step(),
        test_frontend_step(),
        build_backend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        build_plugins_step(edition=edition, sign=True),
        package_step(edition=edition, ver_mode=ver_mode, sign=True),
        e2e_tests_server_step(),
        e2e_tests_step(),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        publish_storybook_step(edition=edition, ver_mode=ver_mode),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, publish=True),
        build_docker_images_step(edition=edition, ubuntu=True, publish=True),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
        release_npm_packages_step(edition=edition),
        upload_packages_step(edition=edition, ver_mode=ver_mode),
    ]
    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode)

    return steps, windows_steps

def get_oss_pipelines(trigger, ver_mode):
    services = integration_test_services()
    steps, windows_steps = get_steps(edition='oss')
    return [
        pipeline(
            name='oss-build-release', edition='oss', trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
        pipeline(
            name='oss-windows-release', edition='oss', trigger=trigger, steps=windows_steps, platform='windows',
            depends_on=['oss-build-release'], ver_mode=ver_mode,
        ),
    ]

def get_enterprise_pipelines(trigger, ver_mode):
    services = integration_test_services()
    steps, windows_steps = get_steps(edition='enterprise')
    return [
        pipeline(
            name='enterprise-build-release', edition='enterprise', trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
        pipeline(
            name='enterprise-windows-release', edition='enterprise', trigger=trigger, steps=windows_steps, platform='windows',
            depends_on=['enterprise-build-release'], ver_mode=ver_mode,
        ),
    ]

def release_pipelines():
    services = integration_test_services()
    trigger = {
        'ref': ['refs/tags/v*',],
    }

    # The release pipelines include also enterprise ones, so both editions are built for a release.
    # We could also solve this by triggering a downstream build for the enterprise repo, but by including enterprise
    # in OSS release builds, we simplify the UX for the release engineer.
    oss_pipelines = get_oss_pipelines(ver_mode=ver_mode, trigger=trigger)
    enterprise_pipelines = get_enterprise_pipelines(ver_mode=ver_mode, trigger=trigger)

    publish_pipeline = pipeline(
        name='publish-release', trigger=trigger, edition='oss', steps=[
            {
                'name': 'publish-packages',
                'image': publish_image,
                'depends_on': [
                    'initialize',
                ],
                'environment': {
                    'GRAFANA_COM_API_KEY': {
                        'from_secret': 'grafana_api_key',
                    },
                },
                'commands': [
                    './bin/grabpl publish-packages --edition oss ${DRONE_TAG}',
                    './bin/grabpl publish-packages --edition enterprise ${DRONE_TAG}',
                ],
            },
        ], depends_on=[p['name'] for p in oss_pipelines + enterprise_pipelines], install_deps=False,
        ver_mode=ver_mode,
    )

    pipelines = oss_pipelines + enterprise_pipelines + [publish_pipeline,]

    pipelines.append(notify_pipeline(
        name='notify-release', slack_channel='grafana-ci-notifications', trigger=trigger,
        depends_on=[p['name'] for p in pipelines],
    ))

    return pipelines
