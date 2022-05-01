const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsUrl = process.env.sqsUrl;

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const eventInfo = {
        Bucket: bucket,
        Key: key,
    }; 

    // push the event
    const sqsParams = {
        DelaySeconds: 10,
        MessageAttributes: {},
        MessageBody: JSON.stringify(eventInfo), 
        QueueUrl: sqsUrl
    };  
    try {
        let sqsResponse = await sqs.sendMessage(sqsParams).promise();  
        console.log("sqsResponse: "+JSON.stringify(sqsResponse));
    } catch (err) {
        console.log(err);
    } 

    const response = {
        statusCode: 200,
        body: eventInfo,
    };
    return response;
};