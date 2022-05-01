const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsUrl = process.env.sqsUrl;

exports.handler = async (event) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
    console.log('## EVENT: ' + JSON.stringify(event))
    
    let records = event['Records'];
    console.log('records: '+records);

    let isCompleted = false;

    let objects = [];    

    records.forEach(record => {
        const receiptHandle = record['receiptHandle'];
 
        const body = JSON.parse(record['body']);
        console.log('body = %j', body);

        objects.push({
            Bucket: body.Bucket,
            Key: body.Key
        })
 
       // let output = Buffer.from(data, 'base64');
        // remove message queue 
        try {
            const deleteParams = {
                QueueUrl: sqsUrl,
                ReceiptHandle: receiptHandle
            };
    
            console.log('remove messageQueue: ' + receiptHandle);
            sqs.deleteMessage(deleteParams);
        } catch (err) {
            console.log(err);
        }            
    });

    for(let i=0;i<objects.length;i++) {
        const params = objects[i];
        console.log('params: %j', params);

        let data;
        try {
            data = await s3.getObject(params).promise();
            console.log('record: %j', data);
        } catch (err) {
            console.log(err);
        }

        let invokeMsg = data['Body'];
        console.log('invokeMsg: '+invokeMsg);
    }

    function wait(){
        return new Promise((resolve, reject) => {
          if(!isCompleted) {
            setTimeout(() => resolve("wait..."), 1000)
          }
          else {
            setTimeout(() => resolve("closing..."), 0)
          }
        });
    }
    console.log(await wait());
    console.log(await wait());
    console.log(await wait());
    console.log(await wait());

    const response = {
        statusCode: 200,
    };
    return response;
};