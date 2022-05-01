const aws = require('aws-sdk');
const dynamo = new aws.DynamoDB.DocumentClient();
const tableName = process.env.tableName;
const {v4: uuidv4} = require('uuid');

exports.handler = async (event, context) => {
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env))
    console.log('## EVENT: ' + JSON.stringify(event))

    // Get the object from the event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const eventInfo = {
        Bucket: bucket,
        Key: key,
    }; 
    console.log('eventInfo: %j', eventInfo);

    const date = new Date();        
    let timestamp = Math.floor(date.getTime()/1000).toString();
    let id = uuidv4(); // generate uuid
      
    // putItem to DynamoDB
    var putParams = {
        TableName: tableName,
        Item: {
            "event_id": id,
            "event_timestamp": timestamp,
            "status": 'created',
            "event_info": JSON.stringify(eventInfo)    
        } 
    };
    console.log("params: %j", putParams);

    try {
        const response = await dynamo.put(putParams).promise();
        console.log('dynamo response: %j', response);
    } catch (error) {
      console.log(error);
      return;
    } 
    
    const response = {
        statusCode: 200,
        body: eventInfo,
    };
    return response;
};