const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const sqsUrl = process.env.sqsUrl;
const capacity = process.env.capacity;
const tableName = process.env.tableName;
const dynamo = new aws.DynamoDB.DocumentClient();
const indexName = "time-index"; // GSI

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    const date = new Date();        
    let querytime = Math.floor(date.getTime()/1000-60*60).toString(); // from 1 hour before 
    let count;

    var queryParams = {
        TableName: tableName,
        IndexName: indexName,    
        Limit: capacity,
        KeyConditionExpression: "Timestamp = :querytime",        
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
            console.log('id: '+id);
            console.log('eventInfo: '+eventInfo);
            
            // push the event
            const sqsSendParams = {
                DelaySeconds: 0,
                MessageAttributes: {},
                MessageBody: eventInfo, 
                QueueUrl: sqsUrl
            };  
    
            try {
                const resp = await sqs.sendMessage(sqsSendParams).promise();
                // console.log('resp: %j',resp);
                console.log('Sent MessageId: ', resp.MessageId);
    
                } catch (err) {
                    console.log(err);
            } 
    
            // delete Id
            var deleteParams = {
                TableName: tableName,
                Key: {
                    Id: id
                },    
                Limit: capacity,
                KeyConditionExpression: "Timestamp >= :querytime",        
                ExpressionAttributeValues: {
                    ":querytime": querytime
                }
            };
        
            var dynamoQuery; 
            try {
                const response = await dynamo.deleteItems(deleteParams).promise();
        
                console.log('response: '+JSON.stringify(response));
            } catch (error) {
              console.log(error);
              return;
            }     
        }
    }

    const response = {
        statusCode: 200,
    };
    return response;
};