# S3 Trigger Event Scheduler

여기서는 S3 Trigger Event를 처리하기 위한 Scheduler 설계에 집중하여 설명합니다. 

## Basic Architecture

여기서 구현하려는 Archiecture는 아래와 같이, Amazon S3, Amazon SQS와 Amazon EventBridge로 구성됩니다. 여기서 StepFunction은 Scheduler와 관계없는 Load에 관계되므로, 편의상 log로 대체합니다. 

![image](https://user-images.githubusercontent.com/52392004/165916282-d38b28dc-c8c4-4dfd-bfa7-a4f471e956b7.png)


## Scheduler

Scheduler가 SQS for S3로 부터 메시지 요청시 받은 메시지의 예는 아래와 같습니다. 여기서 "Messages"를 추출하고, 다시 Body들을 뽑습니다.

```java
{
    "ResponseMetadata": {
        "RequestId": "b55d6df9-345d-5740-a308-371f352307d3"
    },
    "Messages": [
        {
            "MessageId": "0648905f-7efc-418f-b925-2a8403003851",
            "ReceiptHandle": "AQEBdsEWi7zw5RO6g8A4EaON1WaJEmMQCmagoZUmabH8+EdvtmgGTG+RgrQWSJThVRX4wrZhzAptkatiGFC6vv9VssvY+DNEtfXwy0emqBq543/MkOdSDYgQMweHsKtzBLEOK1VU7V9t9xZOvNP0kLaDA/iqyCsadt6k4IMDR2gicl+qd+yX4KNrQTz+zT8DoQtapNOZwt9OgdVPXDEaSzlA3hcvuUP4tfhtVSazeuA72DmaFGHYn/HI9WjYAndQBizM0FdsUbMO2gEFWVfdfYAZVk4x00p9dswSvfMWmfpIPIT+/ZEL8va9MYufwdC9pwpXJtf19iEnBYGuwdCLMUTD4+tZwJQ1QhOTs3a/J6cwQLGv0Cx0acB9u0D/kq1VWStJEWflXMPVmC0g8rIqcDcodqWwZryr25X/QwT0VYshAulOV7JA4CNSPynebJFpwW7m5V3b/KBhQmb7SrTQYSEoTg==",
            "MD5OfBody": "7f57b2cca00e0d646c45c7db8d513e58",
            "Body": "{\"Bucket\":\"cdkschedulerstack-s3triggerce04a23f-a4z1bilaem5o\",\"Key\":\"CdkStack-FirehoseDeliveryStream-gGryzcERpFBm-1-2022-04-28-07-08-10-9a7bb97d-7367-4fb1-893c-f171137f82c6\"}",
            "Attributes": {
                "SenderId": "AROAZ3KIXN5TFODEZ7DDE:CdkschedulerStack-LambdaS3Trigger08CA0BBF-lGuL0s5RsWVe",
                "ApproximateFirstReceiveTimestamp": "1651244862655",
                "ApproximateReceiveCount": "1",
                "SentTimestamp": "1651243428220"
            }
        }
    ]
}
```

## S3 Event Trigger

[Lambda for S3](https://github.com/kyopark2014/case-study-s3-trigger-event/blob/main/s3-trigger-schedular/cdkscheduler/repositories/lambda-for-s3-trigger/index.js)와 같이 S3에 object가 생성시 발생하는 event에서 bucket이름과 key에 대한 정보를 아래처럼 추출해서 SQS에 push 합니다.


```java
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const eventInfo = {
        Bucket: bucket,
        Key: key,
    }; 
    
    // push the event
    const sqsParams = {
        DelaySeconds: 0,
        MessageAttributes: {},
        MessageBody: JSON.stringify(eventInfo), 
        QueueUrl: sqsUrl
    };  
    try {
        let sqsResponse = await sqs.sendMessage(sqsParams).promise();  
        // console.log("sqsResponse: "+JSON.stringify(sqsResponse));
        console.log("Sent MessageId: "+sqsResponse.MessageId);
    } catch (err) {
        console.log(err);
    } 
```    


## Event Scheduler

EventBridge를 통해 Rule을 등록하면 일정 주기로 Lambda 함수를 호출 할 수 있습니다. 여기서는 EventBridge를 이용해 일정주기(1분 단위)로 cron job 형태로 [Lambda for event](https://github.com/kyopark2014/case-study-s3-trigger-event/blob/main/s3-trigger-scheduler/cdkscheduler/repositories/lambda-for-event/index.js)를 실행시킵니다. 여기서는 아래처럼 SQS에 ReceiveMessage를 요청해서, 10개 단위로 event를 가져옵니다. 이것을 반복하면 capacity 만큼 event를 처리할 수 있으므로, 일정 주기별로 scheduling을 할 수 있습니다. 

Srouce SQS로 부터 capacity 만큼 event를 불러온 후에 순차적으로 Step Functions 같은 방법으로 처리하기 위해 다른 Destination SQS에 아래와 같이 Push 합니다.

```java
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
