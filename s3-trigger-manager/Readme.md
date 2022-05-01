# S3 Trigger Event Manager

S3 Trigger Event를 DyanmoDB로 저장 후에 Manager를 통해 관리하는 케이스에 대한 Architecture는 아래와 같습니다. 

![image](https://user-images.githubusercontent.com/52392004/166144380-c4d0831e-e455-406e-80c2-039c69165ff8.png)


## DynamoDB table 구성

DynamoDB에 event를 저장하고 읽어올때, timestamp로 sort가 되어야 하므로, 아래와 같이 GSI로 "event_status", "event_timestamp"를 정의 하였습니다. 

```java
    // DynamoDB
    const tableName = "dynamodb-s3-event";
    const indexName = "time-index";
    const dataTable = new dynamodb.Table(this, 'dynamodb-s3-event', {
      tableName: tableName,
        partitionKey: { name: 'event_id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'event_timestamp', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    dataTable.addGlobalSecondaryIndex({ // GSI
      indexName: indexName,
      partitionKey: { name: 'event_status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'event_timestamp', type: dynamodb.AttributeType.STRING },
    });
```

## Event의 Identification

S3 trigger시 발생한 이벤트는 아래와 같이 bucket name과 key로 구성됩니다. 

```java
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const eventInfo = {
        Bucket: bucket,
        Key: key,
    }; 
    console.log('eventInfo: %j', eventInfo);
```

Event를 관리하기 위하여 ID로 UUID를 사용합니다. event 생성시 "event_status"를 create로 하는데, 추후 DynamoDB를 이용한 status 관리시 다양한 status로 관리 할 수 있습니다. 

```java
    const date = new Date();        
    let timestamp = Math.floor(date.getTime()/1000).toString();
    let id = uuidv4(); // generate uuid
      
    // putItem to DynamoDB
    var putParams = {
        TableName: tableName,
        Item: {
            "event_id": id,
            "event_timestamp": timestamp,
            "event_status": "created",
            "event_info": JSON.stringify(eventInfo)    
        } 
    };
```

## CDK를 이용한 Infrastructure 설치 및 삭제 

생성하기

```c
$ cdk synth

$ cdk deploy
````

삭제하기 

```c
$ cdk destory
```
