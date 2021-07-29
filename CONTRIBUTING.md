## Contributor Guide

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

### Pull Request Process

1. Write a summary with details of the changes in the pull request and link the related issue
2. For UI changes: Test with browser and the android build
3. For UI changes: Modify the deployment script at `./ionic_user_interface/.github` if necessary
4. For API changes: Include Postman Collections at `./lambda_backend/postman_collections`
5. For API changes: Update swagger UI in `./docs`
6. For API changes: Modify the deployment script at `./lambda_backend/serverless-deploy.sh` if necessary
7. Ensure all tests in the pipeline passes
8. Request a reviewer for approval

### Initial Setup

The runtimes are NodeJS 14 and Python 3.7.

To ensure the PR passes checks in Github Actions, there are [CommitLint](https://github.com/conventional-changelog/commitlint), [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) set up as git hooks. Please enable it:

```
cd ./RouteMaker
npm ci
```

### Setup

Refer to the [documentation](docs/README.md).
