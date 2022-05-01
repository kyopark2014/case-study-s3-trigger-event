import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

import * as sqs from 'aws-cdk-lib/aws-sqs'
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
const {SqsEventSource} = require('aws-cdk-lib/aws-lambda-event-sources');

export class CdkEventManagerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3
    const s3Bucket = new s3.Bucket(this, "s3-trigger",{
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
      versioned: false,
    });
    new cdk.CfnOutput(this, 'bucketName', {
      value: s3Bucket.bucketName,
      description: 'The nmae of bucket',
    });
    new cdk.CfnOutput(this, 's3Arn', {
      value: s3Bucket.bucketArn,
      description: 'The arn of s3',
    });
    new cdk.CfnOutput(this, 's3Path', {
      value: 's3://'+s3Bucket.bucketName,
      description: 'The path of s3',
    });

    // DynamoDB
    const tableName = "dynamodb-s3-event";
    const indexName = "time-index";
    const dataTable = new dynamodb.Table(this, 'dynamodb-s3-event', {
      tableName: tableName,
        partitionKey: { name: 'event_id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'event_timestamp', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    dataTable.addGlobalSecondaryIndex({ // GSI
      indexName: indexName,
      partitionKey: { name: 'event_timestamp', type: dynamodb.AttributeType.STRING },
    });

    // SQS - Event
    const queueforEvent = new sqs.Queue(this, 'QueueForEvent');
    new cdk.CfnOutput(this, 'queueforEventUrl', {
      value: queueforEvent.queueUrl,
      description: 'The queue url of evnet',
    });

    // Lambda - S3
    const lambdaS3Trigger = new lambda.Function(this, "LambdaS3Trigger", {
      description: 'managing s3 event and then push the event into SQS',
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("repositories/lambda-for-s3-trigger"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(3),
      environment: {
        tableName: tableName,
      }
    }); 
    new cdk.CfnOutput(this, 'ArnOfLambdaForS3Trigger', {
      value: lambdaS3Trigger.functionArn,
      description: 'The arn of the lambda for S3 Trigger',
    });
    lambdaS3Trigger.addEventSource(new S3EventSource(s3Bucket, {
      events: [ s3.EventType.OBJECT_CREATED ],  
      // filters: [ { prefix: 'subdir/' } ] // optional
    }));
    s3Bucket.grantRead(lambdaS3Trigger);
    // queueforS3.grantSendMessages(lambdaS3Trigger);
    dataTable.grantReadWriteData(lambdaS3Trigger);
    
    // Lambda - Event manager
    const lambdaSchedular = new lambda.Function(this, "LambdaForManager", {
      description: 'event manager',
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("repositories/lambda-for-event"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(30),
      environment: {
        tableName: tableName,
        indexName: indexName,
        sqsUrl: queueforEvent.queueUrl,
        capacity: '100' // the capable capacity per operation by the scheduler 
      }
    }); 
    // grant permissions
    dataTable.grantReadWriteData(lambdaSchedular);
    queueforEvent.grantSendMessages(lambdaSchedular);
    // check functional Arn
    new cdk.CfnOutput(this, 'ArnOfLambdaForSchedular', {
      value: lambdaSchedular.functionArn,
      description: 'The arn of the lambda for Schedular',
    });

    // Lambda - Invoke
    const lambdaInvoke = new lambda.Function(this, "LambdaForInvoke", {
      description: 'lambda for invoke',
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("repositories/lambda-for-invoke"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(30),
      environment: {
        sqsUrl: queueforEvent.queueUrl,
      }
    }); 
    // grant permissions
    s3Bucket.grantRead(lambdaInvoke);
    lambdaInvoke.addEventSource(new SqsEventSource(queueforEvent)); 
    
    // check functional Arn
    new cdk.CfnOutput(this, 'ArnOfLambdaForInvoke', {
      value: lambdaInvoke.functionArn,
      description: 'The arn of the lambda for Invoke',
    });

    // cron job - EventBridge
    const rule = new events.Rule(this, 'Cron', {
      description: "To run lambda-for-schedular periodically",
      schedule: events.Schedule.expression('rate(1 minute)'),
    }); 
    rule.addTarget(new targets.LambdaFunction(lambdaSchedular)); 
  }
}
