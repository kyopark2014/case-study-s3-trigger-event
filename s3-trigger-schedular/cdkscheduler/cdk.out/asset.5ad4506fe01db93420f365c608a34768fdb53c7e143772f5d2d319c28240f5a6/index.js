   
const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsUrl = process.env.sqsUrl;

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    let records = event['Records'];

    // Get the object from the event and show its content type
    records.forEach(record => {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        const params = {
            Bucket: bucket,
            Key: key,
        }; 

        console.log('params: %j',params);

        let data;
        try {
            data = await s3.getObject(params).promise();
            console.log('record: %j', data);
        } catch (err) {
            console.log(err);
        }

        let body = data['Body'];
        console.log('body: '+body);
        
        // push a message
        const sqsParams = {
            DelaySeconds: 10,
            MessageAttributes: {},
            MessageBody: JSON.stringify(body), 
            QueueUrl: sqsUrl
        };  
        try {
            let sqsResponse = await sqs.sendMessage(sqsParams).promise();  
            
            console.log("sqsResponse: "+JSON.stringify(sqsResponse));
        } catch (err) {
            console.log(err);
        } 
    });
    
    const response = {
        statusCode: 200,
    };
    return response;
};