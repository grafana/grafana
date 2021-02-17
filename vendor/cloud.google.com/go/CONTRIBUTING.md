# Contributing

1. [File an issue](https://github.com/googleapis/google-cloud-go/issues/new/choose).
   The issue will be used to discuss the bug or feature and should be created
   before sending a CL.

1. [Install Go](https://golang.org/dl/).
    1. Ensure that your `GOBIN` directory (by default `$(go env GOPATH)/bin`)
    is in your `PATH`.
    1. Check it's working by running `go version`.
        * If it doesn't work, check the install location, usually
        `/usr/local/go`, is on your `PATH`.

1. Sign one of the
[contributor license agreements](#contributor-license-agreements) below.

1. Clone the repo:
    `git clone https://github.com/googleapis/google-cloud-go`

1. Change into the checked out source:
    `cd google-cloud-go`

1. Fork the repo.

1. Set your fork as a remote:
    `git remote add fork git@github.com:GITHUB_USERNAME/google-cloud-go.git`

1. Make changes, commit to your fork.

   Commit messages should follow the
   [Conventional Commits Style](https://www.conventionalcommits.org). The scope
   portion should always be filled with the name of the package affected by the
   changes being made. For example:
   ```
   feat(functions): add gophers codelab
   ```

1. Send a pull request with your changes.

   To minimize friction, consider setting `Allow edits from maintainers` on the
   PR, which will enable project committers and automation to update your PR.

1. A maintainer will review the pull request and make comments.

   Prefer adding additional commits over amending and force-pushing since it can
   be difficult to follow code reviews when the commit history changes.

   Commits will be squashed when they're merged.

## Testing

We test code against two versions of Go, the minimum and maximum versions
supported by our clients. To see which versions these are checkout our
[README](README.md#supported-versions).

### Integration Tests

In addition to the unit tests, you may run the integration test suite. These
directions describe setting up your environment to run integration tests for
_all_ packages: note that many of these instructions may be redundant if you
intend only to run integration tests on a single package.

#### GCP Setup

To run the integrations tests, creation and configuration of two projects in
the Google Developers Console is required: one specifically for Firestore
integration tests, and another for all other integration tests. We'll refer to
these projects as "general project" and "Firestore project".

After creating each project, you must [create a service account](https://developers.google.com/identity/protocols/OAuth2ServiceAccount#creatinganaccount)
for each project. Ensure the project-level **Owner**
[IAM role](console.cloud.google.com/iam-admin/iam/project) role is added to
each service account. During the creation of the service account, you should
download the JSON credential file for use later.

Next, ensure the following APIs are enabled in the general project:

- BigQuery API
- BigQuery Data Transfer API
- Cloud Dataproc API
- Cloud Dataproc Control API Private
- Cloud Datastore API
- Cloud Firestore API
- Cloud Key Management Service (KMS) API
- Cloud Natural Language API
- Cloud OS Login API
- Cloud Pub/Sub API
- Cloud Resource Manager API
- Cloud Spanner API
- Cloud Speech API
- Cloud Translation API
- Cloud Video Intelligence API
- Cloud Vision API
- Compute Engine API
- Compute Engine Instance Group Manager API
- Container Registry API
- Firebase Rules API
- Google Cloud APIs
- Google Cloud Deployment Manager V2 API
- Google Cloud SQL
- Google Cloud Storage
- Google Cloud Storage JSON API
- Google Compute Engine Instance Group Updater API
- Google Compute Engine Instance Groups API
- Kubernetes Engine API
- Cloud Error Reporting API
- Pub/Sub Lite API

Next, create a Datastore database in the general project, and a Firestore
database in the Firestore project.

Finally, in the general project, create an API key for the translate API:

- Go to GCP Developer Console.
- Navigate to APIs & Services > Credentials.
- Click Create Credentials > API Key.
- Save this key for use in `GCLOUD_TESTS_API_KEY` as described below.

#### Local Setup

Once the two projects are created and configured, set the following environment
variables:

- `GCLOUD_TESTS_GOLANG_PROJECT_ID`: Developers Console project's ID (e.g.
bamboo-shift-455) for the general project.
- `GCLOUD_TESTS_GOLANG_KEY`: The path to the JSON key file of the general
project's service account.
- `GCLOUD_TESTS_GOLANG_FIRESTORE_PROJECT_ID`: Developers Console project's ID
(e.g. doorway-cliff-677) for the Firestore project.
- `GCLOUD_TESTS_GOLANG_FIRESTORE_KEY`: The path to the JSON key file of the
Firestore project's service account.
- `GCLOUD_TESTS_API_KEY`: API key for using the Translate API created above.

As part of the setup that follows, the following variables will be configured:

- `GCLOUD_TESTS_GOLANG_KEYRING`: The full name of the keyring for the tests,
in the form
"projects/P/locations/L/keyRings/R". The creation of this is described below.
- `GCLOUD_TESTS_GOLANG_ZONE`: Compute Engine zone.

Install the [gcloud command-line tool][gcloudcli] to your machine and use it to
create some resources used in integration tests.

From the project's root directory:

``` sh
# Sets the default project in your env.
$ gcloud config set project $GCLOUD_TESTS_GOLANG_PROJECT_ID

# Authenticates the gcloud tool with your account.
$ gcloud auth login

# Create the indexes used in the datastore integration tests.
$ gcloud datastore indexes create datastore/testdata/index.yaml

# Creates a Google Cloud storage bucket with the same name as your test project,
# and with the Cloud Logging service account as owner, for the sink
# integration tests in logging.
$ gsutil mb gs://$GCLOUD_TESTS_GOLANG_PROJECT_ID
$ gsutil acl ch -g cloud-logs@google.com:O gs://$GCLOUD_TESTS_GOLANG_PROJECT_ID

# Creates a PubSub topic for integration tests of storage notifications.
$ gcloud beta pubsub topics create go-storage-notification-test
# Next, go to the Pub/Sub dashboard in GCP console. Authorize the user
# "service-<numeric project id>@gs-project-accounts.iam.gserviceaccount.com"
# as a publisher to that topic.

# Creates a Spanner instance for the spanner integration tests.
$ gcloud beta spanner instances create go-integration-test --config regional-us-central1 --nodes 10 --description 'Instance for go client test'
# NOTE: Spanner instances are priced by the node-hour, so you may want to
# delete the instance after testing with 'gcloud beta spanner instances delete'.

$ export MY_KEYRING=some-keyring-name
$ export MY_LOCATION=global
# Creates a KMS keyring, in the same location as the default location for your
# project's buckets.
$ gcloud kms keyrings create $MY_KEYRING --location $MY_LOCATION
# Creates two keys in the keyring, named key1 and key2.
$ gcloud kms keys create key1 --keyring $MY_KEYRING --location $MY_LOCATION --purpose encryption
$ gcloud kms keys create key2 --keyring $MY_KEYRING --location $MY_LOCATION --purpose encryption
# Sets the GCLOUD_TESTS_GOLANG_KEYRING environment variable.
$ export GCLOUD_TESTS_GOLANG_KEYRING=projects/$GCLOUD_TESTS_GOLANG_PROJECT_ID/locations/$MY_LOCATION/keyRings/$MY_KEYRING
# Authorizes Google Cloud Storage to encrypt and decrypt using key1.
$ gsutil kms authorize -p $GCLOUD_TESTS_GOLANG_PROJECT_ID -k $GCLOUD_TESTS_GOLANG_KEYRING/cryptoKeys/key1
```

It may be useful to add exports to your shell initialization for future use.
For instance, in `.zshrc`:

```sh
#### START GO SDK Test Variables
# Developers Console project's ID (e.g. bamboo-shift-455) for the general project.
export GCLOUD_TESTS_GOLANG_PROJECT_ID=your-project

# The path to the JSON key file of the general project's service account.
export GCLOUD_TESTS_GOLANG_KEY=~/directory/your-project-abcd1234.json

# Developers Console project's ID (e.g. doorway-cliff-677) for the Firestore project.
export GCLOUD_TESTS_GOLANG_FIRESTORE_PROJECT_ID=your-firestore-project

# The path to the JSON key file of the Firestore project's service account.
export GCLOUD_TESTS_GOLANG_FIRESTORE_KEY=~/directory/your-firestore-project-abcd1234.json

# The full name of the keyring for the tests, in the form "projects/P/locations/L/keyRings/R".
# The creation of this is described below.
export MY_KEYRING=my-golang-sdk-test
export MY_LOCATION=global
export GCLOUD_TESTS_GOLANG_KEYRING=projects/$GCLOUD_TESTS_GOLANG_PROJECT_ID/locations/$MY_LOCATION/keyRings/$MY_KEYRING

# API key for using the Translate API.
export GCLOUD_TESTS_API_KEY=abcdefghijk123456789

# Compute Engine zone. (https://cloud.google.com/compute/docs/regions-zones)
export GCLOUD_TESTS_GOLANG_ZONE=your-chosen-region
#### END GO SDK Test Variables
```

#### Running

Once you've done the necessary setup, you can run the integration tests by
running:

``` sh
$ go test -v ./...
```

Note that the above command will not run the tests in other modules. To run
tests on other modules, first navigate to the appropriate
subdirectory. For instance, to run only the tests for datastore:
``` sh
$ cd datastore
$ go test -v ./...
```

#### Replay

Some packages can record the RPCs during integration tests to a file for
subsequent replay. To record, pass the `-record` flag to `go test`. The
recording will be saved to the _package_`.replay` file. To replay integration
tests from a saved recording, the replay file must be present, the `-short`
flag must be passed to `go test`, and the `GCLOUD_TESTS_GOLANG_ENABLE_REPLAY`
environment variable must have a non-empty value.

## Contributor License Agreements

Before we can accept your pull requests you'll need to sign a Contributor
License Agreement (CLA):

- **If you are an individual writing original source code** and **you own the
intellectual property**, then you'll need to sign an [individual CLA][indvcla].
- **If you work for a company that wants to allow you to contribute your
work**, then you'll need to sign a [corporate CLA][corpcla].

You can sign these electronically (just scroll to the bottom). After that,
we'll be able to accept your pull requests.

## Contributor Code of Conduct

As contributors and maintainers of this project,
and in the interest of fostering an open and welcoming community,
we pledge to respect all people who contribute through reporting issues,
posting feature requests, updating documentation,
submitting pull requests or patches, and other activities.

We are committed to making participation in this project
a harassment-free experience for everyone,
regardless of level of experience, gender, gender identity and expression,
sexual orientation, disability, personal appearance,
body size, race, ethnicity, age, religion, or nationality.

Examples of unacceptable behavior by participants include:

* The use of sexualized language or imagery
* Personal attacks
* Trolling or insulting/derogatory comments
* Public or private harassment
* Publishing other's private information,
such as physical or electronic
addresses, without explicit permission
* Other unethical or unprofessional conduct.

Project maintainers have the right and responsibility to remove, edit, or reject
comments, commits, code, wiki edits, issues, and other contributions
that are not aligned to this Code of Conduct.
By adopting this Code of Conduct,
project maintainers commit themselves to fairly and consistently
applying these principles to every aspect of managing this project.
Project maintainers who do not follow or enforce the Code of Conduct
may be permanently removed from the project team.

This code of conduct applies both within project spaces and in public spaces
when an individual is representing the project or its community.

Instances of abusive, harassing, or otherwise unacceptable behavior
may be reported by opening an issue
or contacting one or more of the project maintainers.

This Code of Conduct is adapted from the [Contributor Covenant](http://contributor-covenant.org), version 1.2.0,
available at [http://contributor-covenant.org/version/1/2/0/](http://contributor-covenant.org/version/1/2/0/)

[gcloudcli]: https://developers.google.com/cloud/sdk/gcloud/
[indvcla]: https://developers.google.com/open-source/cla/individual
[corpcla]: https://developers.google.com/open-source/cla/corporate
