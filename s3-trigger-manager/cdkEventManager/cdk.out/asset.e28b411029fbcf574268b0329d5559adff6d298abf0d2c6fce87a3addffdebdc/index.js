const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const sqsUrl = process.env.sqsUrl;
const capacity = process.env.capacity;
const indexName = "Timestamp"; // GSI

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    const date = new Date();        
    let querytime = Math.floor(date.getTime()/1000-60*60).toString(); // from 1 hour before 

    var queryParams = {
        TableName: tableName,
        IndexName: indexName,    
        Limit: capacity,
        KeyConditionExpression: "Timestamp >= :querytime",        
        ExpressionAttributeValues: {
            ":querytime": querytime
        }
    };

    var dynamoQuery; 
    try {
        dynamoQuery = await dynamo.query(queryParams).promise();

        console.log('queryDynamo: '+JSON.stringify(dynamoQuery));
        console.log('queryDynamo: '+dynamoQuery.Count);   
        count = dynamoQuery.Count;
    } catch (error) {
      console.log(error);
      return;
    } 

    console.log('cnt: '+count); 
    
    if(dynamoQuery.Count == 0) {  // remain event is not exist
        const response = {
            statusCode: 404,
        };

        console.log("No job!");
    }
    else {
        for(let i=0;i<count;i++) {
            const id = dynamoQuery['Items'][i]['Id'];
            const eventInfo = dynamoQuery['Items'][i]['eventInfo'];
    
            // push the event
            const sqsSendParams = {
                DelaySeconds: 0,
                MessageAttributes: {},
                MessageBody: eventInfo, 
                QueueUrl: sqsDstUrl
            };  
    
            try {
                const resp = await sqs.sendMessage(sqsSendParams).promise();
                // console.log('resp: %j',resp);
                console.log('Sent MessageId: ', resp.MessageId);
    
                } catch (err) {
                    console.log(err);
            } 
    
            // delete dynamodb
                
        }
    }

    const response = {
        statusCode: 200,
    };
    return response;
};