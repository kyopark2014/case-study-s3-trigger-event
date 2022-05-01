const aws = require('aws-sdk');
const sqs = new aws.SQS({apiVersion: '2012-11-05'});
const dynamo = new aws.DynamoDB.DocumentClient();

const tableName = process.env.tableName;
const indexName = process.env.indexName; // GSI
const capacity = process.env.capacity;
const sqsUrl = process.env.sqsUrl;

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    const date = new Date();        
    let endTime = Math.floor(date.getTime()/1000).toString(); 
    let startTime = Math.floor(date.getTime()/1000-60*60).toString(); // from 1 hour before 
    console.log('startTime: '+startTime+', endTime:'+endTime);

    const queryParams = {
        TableName: tableName,
        IndexName: indexName,    
        Limit: capacity,
        KeyConditionExpression: "event-timestamp = :event-timestamp",        
        //FilterExpression: "#event-timestamp BETWEEN :startTime AND :endTime",
        ExpressionAttributeValues: {
            ":startTime": startTime, 
            ":endTime": endTime,
            "event-timestamp": startTime
        }
    };

    var dynamoQuery; 
    let count;
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
    
    if(count == 0) {  // remain event is not exist
        const response = {
            statusCode: 404,
        };

        console.log("No job!");
    }
    else {
        for(let i=0;i<count;i++) {
            const id = dynamoQuery['Items'][i]['event-id'];
            const eventInfo = dynamoQuery['Items'][i]['event-info'];
            console.log('event-id: '+id);
            console.log('event-info: '+eventInfo);
            
            // push the event to SQS
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
    
            // delete the event from DynamoDB
            var deleteParams = {
                TableName: tableName,
                Key: {
                    'event-id': id
                },    
            };        
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