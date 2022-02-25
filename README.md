# honeycomb

Experimenting with setting up Contentful in an automated way.

## What problems are we trying to solve?

* We want to define our Content Management System "as code", in much the same way that we now define our infrastructure.
* We want to deploy our Content Management System in an automated, repeatable way.
* We want to run automated tests against our Content Management System to give us confidence that we have not made any
  breaking changes.

## Installation

To install, run:

```shell
npm install
```

## Testing

### Unit tests

Unit tests are written with Jest. To run them:

```shell
npm run test
```

The unit tests live alongside the code they are testing; they end with the suffix `.test.ts`.

### Integration tests

Integration tests are also written in Jest. They are stored in the [src/integration-tests](src/integration-tests)
directory.

The purpose of the integration tests is to prove that the state of Contentful matches our expectations after **all**
of the migrations have been executed. So, we should create integration tests for each **Content Type** that we define.

## Migrations

Migrations define incremental changes to the state of the Contentful space - for example, creating a new Content Type,
updating an existing Content Type, etc.

The migrations depend upon the [contentful-migrations](https://github.com/contentful/contentful-migration) package. They
are stored in the [src/migrations](src/migrations) directory.

One of the important things with migrations is to ensure that they are executed in order. Contentful recommends
a [forward-only migration plan](https://www.contentful.com/help/cms-as-code/#how-to-get-started) rather than the
common "up" and "down" type migrations.

In order to try and ensure that migrations are always executed in order, the application expects migration file names to
begin with a timestamp; e.g. `2022-02-24_16-55-34_an-example-migration.ts`.

While this naming convention is still subject to human error, it's a fairly simple method that adds some safety to the
process.

## Pipeline

A Node CLI application for running migrations in a "pipeline". The pipeline makes changes to your Contentful space in an
automated, repeatable way. It uses
Contentful's [Environment Aliases](https://www.contentful.com/developers/docs/concepts/environment-aliases/)
feature to make changes with no downtime.

The pipeline code can be found at [src/bin/pipeline.ts](src/bin/pipeline.ts).

### Pre-requisites

NodeJS, obviously! You will also need a [Contentful account](https://www.contentful.com/sign-up/) and
an [AWS account](https://aws.amazon.com/resources/create-account/).

1. Your Contentful space must
   have [Environment Aliases](https://www.contentful.com/developers/docs/concepts/environment-aliases/) enabled.
2. Your [Contentful Access Token](https://www.contentful.com/help/personal-access-tokens/) must be stored in AWS Secrets
   Manager. By default, the pipeline expects the secret to be named `contentful-token`; you can specify a different
   secret name using the `--accessTokenSecretId` option.
3. Your [Contentful Space ID](https://www.contentful.com/help/find-space-id/) must be stored in AWS Systems Manager (
   SSM) Parameter Store. By default, the pipeline expects the parameter to be named `contentful-space-id`; you can
   specify a different parameter name using the `--spaceIdParameterStoreName` option.
4. Your DynamoDB table name must be stored in AWS Systems Manager (SSM) Parameter Store. By default, the pipeline
   expects the parameter to be named `contentful-migration-record-table-name`; you can specify a different parameter
   name using the `--dynamoDBTableNameParameterStoreName` option. (**NOTE**: The pipeline will create the DynamoDB table
   if it does not exist.)

### Execution

To run the pipeline from the project root using your default AWS account credentials:

```shell
npx ts-node src/bin/pipeline.ts \
  --migrationsDirectory "./src/migrations" \
  --testsDirectory "./src/integration-tests" \
  --targetEnvironmentId "<your-release-environment-id>"
```

**NOTE:** If you are operating in a multi-account AWS environment, you can use
the [common AWS environment variables](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
to specify alternative AWS credentials profile to use. For example, to use a different AWS profile:

```shell
AWS_PROFILE=marchie-ci-cd npx ts-node src/bin/pipeline.ts \
  --migrationsDirectory "./src/migrations" \
  --testsDirectory "./src/integration-tests" \
  --targetEnvironmentId "<your-release-environment-id>"
```

### Further help

To see all options available for the pipeline, run:

```shell
npx ts-node src/bin/pipeline.ts --help
```

### Pipeline actions

The pipeline does the following:

1. Gets the **environmentId** of your current Contentful `master` environment alias.
2. Creates a new `release` environment from the current `master` environment.
3. Copies the record of migrations that have already been run on the `master` environment to a new record for
   the `release` environment in the DynamoDB table.
4. Performs each migration on the `release` environment.
5. Records each migration on the `release` environment in the DynamoDB table.
6. Runs automated integration tests against the `release` environment.
7. Switches the Contentful `master` environment alias to point to the `release` environment. (i.e. `release` environment
   becomes `master`.)
8. Runs automated integration tests against the new `master` environment.
9. Deletes the old `master` environment.
10. Deletes the record of migrations for the old `master` environment.

### Failure scenarios

If the pipeline fails, it will attempt to revert any action taken:

* If the failure occurs before the `master` environment alias is changed, the revert action attempts to delete
  the `release` environment and associated records in DynamoDB.
* If the failure occurs after the `master` environment alias is changed but before the old `master` environment is
  deleted (i.e. integration tests fail against the `master` environment), the revert action attempts to switch
  the `master` environment alias back to the old `master` environment and then delete the `release` environment.
* If the failure occurs while deleting the old `master` environment, no revert action is taken.

If the revert action fails, manual tidy-up will be required.

## Useful resources

* [Deploying changes with environment aliases](https://www.contentful.com/developers/docs/tutorials/general/deploying-changes-with-environment-aliases/)
* ["CMS as code"](https://www.contentful.com/help/cms-as-code/)
