load(
    'scripts/lib.star',
    'build_image',
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
    'upload_packages_step',
    'notify_pipeline',
    'integration_test_services',
)

ver_mode = 'version-branch'

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
        package_step(edition=edition, ver_mode=ver_mode),
        e2e_tests_server_step(),
        e2e_tests_step(),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, ver_mode=ver_mode),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]
    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode)

    return steps, windows_steps

def get_oss_pipelines(trigger):
    services = integration_test_services()
    steps, windows_steps = get_steps(edition='oss')
    return [
        pipeline(
            name='oss-build-{}'.format(ver_mode), edition='oss', trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
        pipeline(
            name='oss-windows-{}'.format(ver_mode), edition='oss', trigger=trigger, steps=windows_steps,
            platform='windows', depends_on=['oss-build-{}'.format(ver_mode)], ver_mode=ver_mode,
        ),
    ]

def get_enterprise_pipelines(trigger):
    services = integration_test_services()
    steps, windows_steps = get_steps(edition='enterprise')
    return [
        pipeline(
            name='enterprise-build-{}'.format(ver_mode), edition='enterprise', trigger=trigger, services=services,
            steps=steps, ver_mode=ver_mode,
        ),
        pipeline(
            name='enterprise-windows-{}'.format(ver_mode), edition='enterprise', trigger=trigger, steps=windows_steps,
            platform='windows', depends_on=['enterprise-build-{}'.format(ver_mode)], ver_mode=ver_mode,
        ),
    ]

def version_branch_pipelines():
    services = integration_test_services()
    trigger = {
        'ref': ['refs/heads/v*',],
    }

    oss_pipelines = get_oss_pipelines(trigger=trigger)
    enterprise_pipelines = get_enterprise_pipelines(trigger=trigger)

    pipelines = oss_pipelines + enterprise_pipelines

    pipelines.append(notify_pipeline(
        name='notify-{}'.format(ver_mode), slack_channel='grafana-ci-notifications', trigger=trigger,
        depends_on=[p['name'] for p in pipelines],
    ))

    return pipelines
