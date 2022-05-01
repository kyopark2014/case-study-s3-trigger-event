const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsUrl = process.env.sqsUrl;

exports.handler = async (event) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
    console.log('## EVENT: ' + JSON.stringify(event))
    
    let records = event['Records'];
    
    for(let i=0;i<records.length;i++) {
        const params = JSON.parse(records[i]['body']);
        console.log('params = %j', params);

        let data;
        try {
            data = await s3.getObject(params).promise();
        } catch (err) {
            console.log(err);
        }
        let messages = data['Body'];
        console.log('messages: '+messages);

        // Invoke 
        let invokeMsg = Buffer.from(messages, 'base64');
        console.log('invokeMsg = '+invokeMsg);

        // remove message queue 
        const receiptHandle = records[i]['receiptHandle'];        
        try {
            const deleteParams = {
                QueueUrl: sqsUrl,
                ReceiptHandle: receiptHandle
            };

            await sqs.deleteMessage(deleteParams).promise();
            console.log('remove messageQueue');
            
        } catch (err) {
            console.log(err);
        }            
    }

    const response = {
        statusCode: 200,
    };
    return response;
};