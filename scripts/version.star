load(
    'scripts/release.star',
    'release_pipelines',
)

ver_mode = 'release-branch'

def version_branch_pipelines():
    return release_pipelines(ver_mode=ver_mode, trigger={
        'ref': ['refs/heads/v*',],
    })
