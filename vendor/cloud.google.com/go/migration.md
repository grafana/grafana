# go-genproto to google-cloud-go message type migration

The message types for all of our client libraries are being migrated from the
`google.golang.org/genproto` [module](https://pkg.go.dev/google.golang.org/genproto)
to their respective product specific module in this repository. For example
this asset request type that was once found in [genproto](https://pkg.go.dev/google.golang.org/genproto@v0.0.0-20220908141613-51c1cc9bc6d0/googleapis/cloud/asset/v1p5beta1#ListAssetsRequest)
can now be found in directly in the [asset module](https://pkg.go.dev/cloud.google.com/go/asset/apiv1p5beta1/assetpb#ListAssetsRequest).

Although the type definitions have moved, aliases have been left in the old
genproto packages to ensure a smooth non-breaking transition.

## How do I migrate to the new packages?

The easiest option is to run a migration tool at the root of our project. It is
like `go fix`, but specifically for this migration. Before running the tool it
is best to make sure any modules that have the prefix of `cloud.google.com/go`
are up to date. To run the tool, do the following:

```bash
go run cloud.google.com/go/internal/aliasfix/cmd/aliasfix@latest .
go mod tidy
```

The tool should only change up to one line in the import statement per file.
This can also be done by hand if you prefer.

## Do I have to migrate?

Yes if you wish to keep using the newest versions of our client libraries with
the newest features -- You should migrate by the start of 2023. Until then we
will keep updating the aliases in go-genproto weekly. If you have an existing
workload that uses these client libraries and does not need to update its
dependencies there is no action to take. All existing written code will continue
to work.

## Why are these types being moved

1. This change will help simplify dependency trees over time.
2. The types will now be in product specific modules that are versioned
   independently with semver. This is especially a benefit for users that rely
   on multiple clients in a single application. Because message types are no
   longer mono-packaged users are less likely to run into intermediate
   dependency conflicts when updating dependencies.
3. Having all these types in one repository will help us ensure that unintended
   changes are caught before they would be released.

## Have questions?

Please reach out to us on our [issue tracker](https://github.com/googleapis/google-cloud-go/issues/new?assignees=&labels=genproto-migration&template=migration-issue.md&title=package%3A+migration+help)
if you have any questions or concerns.
