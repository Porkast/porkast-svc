import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class PorkastSvcStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const scheduledLambda = new NodejsFunction(this, 'PorkastScheduledUpdateUserSubLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(__dirname, '../lib/lambda/handler.ts'),
            handler: 'handler',
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                NODE_ENV: 'production',
            },
        });

        const rule = new events.Rule(this, 'ScheduleRule', {
            schedule: events.Schedule.rate(cdk.Duration.hours(1)),
        });

        rule.addTarget(new targets.LambdaFunction(scheduledLambda));
    }
}
