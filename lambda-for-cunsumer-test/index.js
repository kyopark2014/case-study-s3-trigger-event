const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});

const sqsUrl = process.env.sqsUrl;

exports.handler = async (event) => {
    // console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
    console.log('## EVENT: ' + JSON.stringify(event))
    
    let records = event['Records'];

    for(let i=0;i<records.length;i++) {
        const receiptHandle = records[i]['receiptHandle'];
        // console.log('receiptHandle: '+receiptHandle);
        
        const body = records[i]['body'];
        console.log('body = '+body);

        // To make in-fright mesage, generate an error as bellow.
        const infright = true;
        if(infright) {
            const data = JSON.parse(body);
 
            let output = Buffer.from(data, 'base64');
            console.log('output = '+output); 
        }
  
        // remove message queue 
        try {
            const deleteParams = {
                QueueUrl: sqsUrl,
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
    }

    const response = {
        statusCode: 200,
    };
    return response;
};
