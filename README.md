# Porkast Backend Service

This is the backend service for the Porkast app built with AWS CDK lambda functions. Currently it mainly update users podcast subscriptions and send notifications.

## About CDK application

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npm cdk bootstrap` create the cdk bootstrap stack for first time deploy
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
