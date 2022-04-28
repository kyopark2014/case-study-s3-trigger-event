# Amazon S3의 신규 Object 생성 Trigger의 스케줄링 방법 

## SQS 기본 동작 

- SQS에 저장된 메시지는 [consumer가 가져가서 처리가 다 끝나면 영구적으로 삭제](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#1-successful-processing)해야 합니다. 

- SQS에 저장된 메시지를 [consumer가 가져갔으나 지우지 않으면(inflight)](https://www.bluematador.com/docs/troubleshooting/aws-sqs-limits), Standard 메시지는 120,000개, FIFO는 20,000개의 제한이 있습니다. 이 할당량은 [AWS에 요청하여 변경](https://us-east-1.console.aws.amazon.com/support/home?region=us-east-1#/case/create?issueType=service-limit-increase&limitType=service-code-sqs) 할 수 있습니다.

- SQS에 저장된 메시지를 consumer가 가져가서 처리를 하지만 [처리가 안되어서 다시 읽을 수](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#3-maximum-receive-count-set-too-low)도 있는데, 이때 [MaxReceiverCount(up to 1000)가 넘으면 DLQ(Dead Letter Queue)로 전달](https://github.com/kyopark2014/technical-summary/blob/main/sqs.md) 됩니다. 

- SQS의 메시지는 [retension time(default: 4days, up to 14days)이후에는 마찬가지로 DLQ로 전달](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#4-message-retention-period-exceeded)됩니다.


## Preblem Description 

아래 그림과 같이 다수의 디바이스들이 Amazon S3에 json 파일 형태로 디바이스의 status를 업로드 한다면, Lambda가 S3에 저장되는 신규 Object 생성 event를 trigger로 받아서, SQS에 event를 message로 쌓아놓을 수 있습니다. 이후 AWS Step Functions는 SQS의 신규 메시지 이벤트를 받아서 처리하는 케이스입니다. 

![image](https://user-images.githubusercontent.com/52392004/165836642-69ccb24b-b51c-479b-9a8e-f6d7d018179f.png)

아래는 예상되는 문제 케이스 입니다. 

- AWS Step Functions에서 1개의 event를 처리 할 때 1초라고 가정합니다. S3에 저장되는 데이터가 1초보다 천천히 들어온다면, Amazon SQS에 event가 쌓이지 않고 잘 처리가 됩니다.

- Amazon S3에 저장되는 파일이 일시적으로 1초에 1개보다 더 많이 들어오더라도, SQS가 Step Functions에 전달한 이벤트를 Concurrent하게 처리하면, 역시 event가 쌓이지 않고 잘 처리가 됩니다.

- 하지만, Step Functions에서 Concurrent하게 처리 할 수 있는 용량보다 훨씬 더 많은 event가 전달되면, SQS의 메시지가 전달은 되었으나 삭제는 되지 않은 inflight 상태인 메시지가 늘어날 수 있습니다. 
 
 - 그리고, 이런한 [inflight 메시지가 Standard 일때 120,000개, FIFO일때는 20,000개가 넘으면, SQS가 SQSOverLimit error를 발생](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-queues.html)시켜, 새로운 메시지를 저장하지 못하게 되므로, 이런 상태에서 새로운 event가 계속 S3로부터 trigger되어 들어오면 유실 될 수 있을 것으로 보입니다. 
 
## 해결 방안

1) [SQS에 message는 제한없이 쌓일 수 있으므로](https://aws.amazon.com/ko/sqs/faqs/), Step Functions에 전달되는 event를 제한하거나 스케줄링 할 수 있다면 문제 해결이 가능할 것으로 보여집니다. 

여기서는 SQS의 신규 메시지 event를 Lambda가 받아서 처리하지 않고, Event Bridge가 주기적으로 생성한 cron job 형태의 event로 Lambda를 Trigger하여, SQS에 있는 메시지를 읽어가는 구조입니다. S3에 새로 Object 생성되더라도, Step Functions이 바로 trigger 되지 않고, 정해진 스케줄에 따라 원하는 만큼만 event를 처리할 수 있습니다. 


![image](https://user-images.githubusercontent.com/52392004/165837257-69cc32c7-22b8-4846-9445-62e0f93a6678.png)

[Sample Request](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html)

```c
https://sqs.us-east-2.amazonaws.com/123456789012/MyQueue/
?Action=ReceiveMessage
&MaxNumberOfMessages=5
&VisibilityTimeout=15
&AttributeName=All
&Expires=2020-04-18T22%3A52%3A43PST
&Version=2012-11-05
&AUTHPARAMS
```

[Calling the receiveMessage operation](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#receiveMessage-property)

```java
var params = {
  QueueUrl: 'STRING_VALUE', /* required */
  AttributeNames: [
    All | Policy | VisibilityTimeout | MaximumMessageSize | MessageRetentionPeriod | ApproximateNumberOfMessages | ApproximateNumberOfMessagesNotVisible | CreatedTimestamp | LastModifiedTimestamp | QueueArn | ApproximateNumberOfMessagesDelayed | DelaySeconds | ReceiveMessageWaitTimeSeconds | RedrivePolicy | FifoQueue | ContentBasedDeduplication | KmsMasterKeyId | KmsDataKeyReusePeriodSeconds | DeduplicationScope | FifoThroughputLimit | RedriveAllowPolicy | SqsManagedSseEnabled,
    /* more items */
  ],
  MaxNumberOfMessages: 'NUMBER_VALUE',
  MessageAttributeNames: [
    'STRING_VALUE',
    /* more items */
  ],
  ReceiveRequestAttemptId: 'STRING_VALUE',
  VisibilityTimeout: 'NUMBER_VALUE',
  WaitTimeSeconds: 'NUMBER_VALUE'
};
sqs.receiveMessage(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     console.log(data);           // successful response
});
```
이 경우에도 어떤 비정상 상황에서 SQS에 저장된 message가 삭제되어 버린다면, event를 읽어버려서 정상적으로 데이터를 처리할 수 없는 문제점이 남아 있습니다. 이것은 DynamoDB와 같은 데이터베이스를 사용하여 모든 event를 logging 한 후, 순차적으로 처리하는 방법으로 접근 할 수 있을것으로 보입니다.

EventBridge event 


2) [Amazon Glue를 이용하여 S3 trigger event를 처리하는 방법](https://catalog.us-east-1.prod.workshops.aws/workshops/ee59d21b-4cb8-4b3d-a629-24537cf37bb5/en-US/lab1/event-notification-crawler)이 있습니다. 이 방법은 기존 step functions을 glue를 통해 해결하여야 합니다. 

