const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsSrcUrl = process.env.sqsSrcUrl;
const sqsDstUrl = process.env.sqsDstUrl;

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

     // push a message
     const sqsReceiveParams = {
        QueueUrl: sqsSrcUrl,
        AttributeNames: [
            'All' 
        ],
        MaxNumberOfMessages: 10,        
    };  

    let sqsReceiveResponse;
    try {
        sqsReceiveResponse = await sqs.receiveMessage(sqsReceiveParams).promise();  
        console.log("sqsReceiveResponse: "+JSON.stringify(sqsReceiveResponse));

        // remove message queue 
        try {
            const deleteParams = {
                QueueUrl: sqsSrcUrl,
                ReceiptHandle: receiptHandle
            };
    
            console.log('remove messageQueue: ' + receiptHandle);
            sqs.deleteMessage(deleteParams, function(err, data) {
                if (err) {
                    console.log("Error", err);
                } else {
                    console.log("Success to remove messageQueue");
                }
            });
        } catch (err) {
            console.log(err);
        }        
    } catch (err) {
        console.log(err);
    } 


    let events = sqsReceiveResponse['Messages'];

    events.forEach(event => {
        const body = JSON.parse(event['Body']);
        console.log('body: %j', body);

        const s3Params = {
            Bucket: body.Bucket,
            Key: body.Key,
        }; 
        console.log('s3Params: %j', s3Params);

        let record;
        try {
            record = await s3.getObject(s3Params).promise();
            console.log('record: %j', record);
        } catch (err) {
            console.log(err);
        }

        // push a message
    /*    const sqsParams = {
            DelaySeconds: 10,
            MessageAttributes: {},
            MessageBody: JSON.stringify(record), 
            QueueUrl: sqsDstUrl
        };  
        try {
            let sqsSendResponse = await sqs.sendMessage(sqsParams).promise();  
            console.log("sqsSendResponse: "+JSON.stringify(sqsSendResponse));
        } catch (err) {
            console.log(err);
        } */
    }); 

    const response = {
        statusCode: 200,
    //    body: body,
    };
    return response;
};