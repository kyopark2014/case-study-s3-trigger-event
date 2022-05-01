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

/*    const scanParams = {
        TableName: tableName,
        Limit: capacity,
    };

    var dynamoQuery; 
    let count;
    try {
        dynamoQuery = await dynamo.scan(scanParams).promise();

        console.log('queryDynamo: '+JSON.stringify(dynamoQuery));
        console.log('queryDynamo: '+dynamoQuery.Count);   
        count = dynamoQuery.Count;
    } catch (error) {
      console.log(error);
      return;
    } */

    const queryParams = {
        TableName: tableName,
        IndexName: indexName,    
        KeyConditionExpression: "status = :status",
        ExpressionAttributeValues: {
            ":status": "created"
        },
        ScanIndexForward: false   // true = ascending, false = descending
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

    if(count == 0) {  // remain event is not exist
        const response = {
            statusCode: 404,
        };

        console.log("No job!");
    }
    else {
        for(let i=0;i<count;i++) {
            const id = dynamoQuery['Items'][i]['event_id'];
            const timestamp = dynamoQuery['Items'][i]['event_timestamp'];
            const eventInfo = dynamoQuery['Items'][i]['event_info'];
            console.log('event_id: '+id+', event_timestamp: '+timestamp);
            console.log('event_info: '+eventInfo);
            
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
                    'event_id': id,
                    'event_timestamp': timestamp
                },    
            };      

            try {
                const response = await dynamo.delete(deleteParams).promise();
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