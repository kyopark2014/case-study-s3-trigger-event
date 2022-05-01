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

    } catch (err) {
        console.log(err);
    } 

    // get events
    let events = sqsReceiveResponse['Messages'];

            

    // read 
    if(events) {
        events.forEach(event => {
            const body = JSON.parse(event['Body']);
            console.log('body: %j', body);

            // remove message queue 
            const receiptHandle = event['ReceiptHandle'];
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

            // push the event
            const sqsSendParams = {
                DelaySeconds: 10,
                MessageAttributes: {},
                MessageBody: JSON.stringify(body), 
                QueueUrl: sqsDstUrl
            };  
            try {
                let sqsSendResponse = sqs.sendMessage(sqsSendParams);  
                console.log("sqsSendResponse: "+JSON.stringify(sqsSendResponse));
            } catch (err) {
                console.log(err);
            } 
        }); 
    }

    const response = {
        statusCode: 200,
    //    body: body,
    };
    return response;
};