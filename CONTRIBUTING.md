## Contributor Guide

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

### Pull Request Process

1. Write a summary with details of the changes in the pull request and link the related issue
2. For UI changes: Test with browser and the android build
3. For UI changes: Modify the deployment script at `./ionic_user_interface/.github` if necessary
4. For API changes: Include Postman Collections and update swagger UI in `./docs`
5. For API changes: Modify the deployment script at `./lambda_backend/serverless-deploy.sh` if necessary
6. Ensure all tests in the pipeline passes
7. Request a reviewer for approval

### Initial Setup

To ensure the PR passes checks in Github Actions, there are [CommitLint](https://github.com/conventional-changelog/commitlint), [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) set up as git hooks. Please enable it:

```
cd ./yolo_bouldering
npm ci
```

### Backend Setup

There are currently three microservices.

1. Predict: Serves Yolov4-tiny model to predict climbing holds
2. User: Provides authentication and authorization via AWS Cognito
3. Route: Provides functions related to gyms and climbing routes

API Documentation is available at the repo's [github page](https://yarkhinephyo.github.io/yolo_bouldering/). Postman Collections are available at `./lambda_backend/postman_collections`.

There is a bash script to setup everything via Serverless Framework. Ensure that [AWS Credentials](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html) with administrator permissions is set up for deployment and that Docker engine is running for preparing Python packages.

```
cd ./yolo_bouldering/lambda_backend
npm ci
sudo ./serverless-deploy.sh deploy dev all
```

Then should be a new file at `./lambda_backend/.env` which contains the required environment variables.

#### Telegram Notification (Optional)

Create a telegram bot. Then save the credentials as shown below before running `serverless-deploy.sh`. Notifications for the developers will be sent to the channel.

```
echo '{
  "BOT_TOKEN": "1313131313:xxxxxxxxxxxxxxxxxxxxxxxxxx",
  "BOT_CHAT_ID": "-131313131"
}' > ./lambda_backend/sns_setup/serverless-config.dev.json
```

### Frontend Setup

The Vue application can run in browser and also in Android through Capacitor plugin.

Ensure `.env` file from the backend setup is present in `./ionic_user_interface`. Ping @yarkhinephyo if there is any issue.

For running in browser:

```
cd ./ionic_user_interface
npm ci
npm run serve
```

Ensure Android Studio is installed for building as an android application:

```
cd ./ionic_user_interface
npm ci
npm run android
```
