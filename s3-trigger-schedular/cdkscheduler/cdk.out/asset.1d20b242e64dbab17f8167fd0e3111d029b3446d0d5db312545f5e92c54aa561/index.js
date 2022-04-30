const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsSrcUrl = process.env.sqsSrcUrl;
const sqsDstUrl = process.env.sqsDstUrl;

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    let isCompleted = false; 

    // push a message
     const sqsReceiveParams = {
        QueueUrl: sqsSrcUrl,
        AttributeNames: [
            'All' 
        ],
        MaxNumberOfMessages: 10,        
    };  
    
    for(let i=0;i<10;i++) {  // 100 events per 1min
        let entries = [];
        let sqsReceiveResponse;
        try {
            sqsReceiveResponse = await sqs.receiveMessage(sqsReceiveParams).promise();  
        } catch (err) {
            console.log(err);
        } 

        // get events
        let events = sqsReceiveResponse['Messages'];
        if(events) {
            // console.log("events: %j", events);

            events.forEach(event => {                
                const body = JSON.parse(event['Body']);
                console.log('key: '+body.Key);

                // remove message queue 
                const entry = {
                    Id: event['MessageId'],
                    ReceiptHandle: event['ReceiptHandle']
                }
                entries.push(entry);
                
            /*    try {
                    const deleteParams = {
                        QueueUrl: sqsSrcUrl,
                        ReceiptHandle: entry.ReceiptHandle
                    };
                    sqs.deleteMessage(deleteParams);
                    
                    console.log('remove received message from (' + sqsSrcUrl+')');
                } catch (err) {
                    console.log(err);
                } */

                // push the event
            /*    const sqsSendParams = {
                    DelaySeconds: 0,
                    MessageAttributes: {},
                    MessageBody: JSON.stringify(body), 
                    QueueUrl: sqsDstUrl
                };  
                try {
                    sqs.sendMessage(sqsSendParams);

                    console.log('push new message to ('+sqsDstUrl+')');
                } catch (err) {
                    console.log(err);
                } */
            }); 
        }
        else {
            console.log('No more new message');

            if(entries.length==0) isCompleted = true;
            break;
        }

        if(entries.length>0) {
            console.log("entries: %j",entries);
            console.log("# of messages: "+entries.length);
    
            sqs.deleteMessageBatch({
                Entries: entries,
                QueueUrl: sqsSrcUrl,
            }, function(err,data) {
                if(err) console.log('error: '+err);
                else console.log('delet status: %j', data);
            });    
        }
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