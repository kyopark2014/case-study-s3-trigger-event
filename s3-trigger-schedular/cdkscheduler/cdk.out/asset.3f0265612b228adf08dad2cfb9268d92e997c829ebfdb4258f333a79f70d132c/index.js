const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsSrcUrl = process.env.sqsSrcUrl;
const sqsDstUrl = process.env.sqsDstUrl;
const capacity = process.env.capacity;

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    const sqsReceiveParams = {
        QueueUrl: sqsSrcUrl,
        AttributeNames: [
            'All' 
        ],
        MaxNumberOfMessages: 10,        
    };  
    
    for(let i=0;i<capacity/10;i++) {  
        let entries = [];

        // read messages from queue
        let sqsReceiveResponse;
        try {
            sqsReceiveResponse = await sqs.receiveMessage(sqsReceiveParams).promise();  
        } catch (err) {
            console.log(err);
        } 

        // parsing events
        let events = sqsReceiveResponse['Messages'];
        if(events) {
            // console.log("events: %j", events);
            for(let i=0;i<events.length;i++) {
                const body = JSON.parse(events[i]['Body']);
                console.log('key: '+body.Key);

                // remove message queue 
                const entry = {
                    Id: events[i]['MessageId'],
                    ReceiptHandle: events[i]['ReceiptHandle']
                }
                entries.push(entry);
                
                // push the event
                const sqsSendParams = {
                    DelaySeconds: 0,
                    MessageAttributes: {},
                    MessageBody: JSON.stringify(body), 
                    QueueUrl: sqsDstUrl
                };  

                try {
                    const resp = await sqs.sendMessage(sqsSendParams).promise();
                    // console.log('resp: %j',resp);
                    console.log('Sent MessageId: ', resp.MessageId);

                } catch (err) {
                    console.log(err);
                } 
            }
        }
        else {
            console.log('No more new message');
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
                else console.log('delete status: %j', data);
            });    
        }
    }

    const response = {
        statusCode: 200,
    };
    return response;
};