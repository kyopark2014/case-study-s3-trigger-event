# Amazon S3의 신규 Object 생성 Trigger의 스케줄링 방법 

## Problem Description 

아래 그림과 같이 다수의 디바이스들이 Amazon S3에 json 파일 형태로 디바이스의 status를 업로드 한다면, Lambda가 S3에 저장되는 신규 Object 생성 event를 trigger로 받아서, SQS에 event를 message로 쌓아놓을 수 있습니다.  

![image](https://user-images.githubusercontent.com/52392004/165836642-69ccb24b-b51c-479b-9a8e-f6d7d018179f.png)

아래는 예상되는 문제 케이스 입니다. 

- AWS Step Functions에서 1개의 event를 처리 할 때 1초라고 가정합니다. S3에 저장되는 데이터가 1초보다 천천히 들어온다면, Amazon SQS에 event가 쌓이지 않고 잘 처리가 됩니다.

- Amazon S3에 저장되는 파일이 일시적으로 1초에 1개보다 더 많이 들어오더라도, SQS가 Step Functions에 전달한 이벤트를 Concurrent하게 처리하면, 역시 event가 쌓이지 않고 잘 처리가 됩니다.

- 하지만, Step Functions에서 Concurrent하게 처리 할 수 있는 용량보다 훨씬 더 많은 event가 전달되면, SQS의 메시지가 전달은 되었으나 삭제는 되지 않은 inflight 상태인 메시지가 늘어날 수 있습니다. 
 
 - 그리고, 이런한 [inflight 메시지가 Standard 일때 120,000개, FIFO일때는 20,000개가 넘으면, SQS가 SQSOverLimit error를 발생](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-queues.html)시켜, 새로운 메시지를 저장하지 못하게 되므로, 이런 상태에서 새로운 event가 계속 S3로부터 trigger되어 들어오면 유실 될 수 있을 것으로 보입니다. 
 
## 해결 방안 1 : S3 Trigger Event Schedular based on SQS

#### SQS 기본 동작 

- SQS에 저장된 메시지는 [consumer가 가져가서 처리가 다 끝나면 영구적으로 삭제](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#1-successful-processing)해야 합니다. 

- SQS에 저장된 메시지를 [consumer가 가져갔으나 지우지 않으면(inflight)](https://www.bluematador.com/docs/troubleshooting/aws-sqs-limits), Standard 메시지는 120,000개, FIFO는 20,000개의 제한이 있습니다. 이 할당량은 [AWS에 요청하여 변경](https://us-east-1.console.aws.amazon.com/support/home?region=us-east-1#/case/create?issueType=service-limit-increase&limitType=service-code-sqs) 할 수 있습니다.

- SQS에 저장된 메시지를 consumer가 가져가서 처리를 하지만 [처리가 안되어서 다시 읽을 수](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#3-maximum-receive-count-set-too-low)도 있는데, 이때 [MaxReceiverCount(up to 1000)가 넘으면 DLQ(Dead Letter Queue)로 전달](https://github.com/kyopark2014/technical-summary/blob/main/sqs.md) 됩니다. 

- SQS의 메시지는 [retension time(default: 4days, up to 14days)이후에는 마찬가지로 DLQ로 전달](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#4-message-retention-period-exceeded)됩니다.

#### Event Scheduler

1) [SQS에 message는 제한없이 쌓일 수 있으므로](https://aws.amazon.com/ko/sqs/faqs/), Step Functions에 전달되는 event를 제한하거나 스케줄링 할 수 있다면 문제 해결이 가능합니다.

여기서는 SQS의 신규 메시지 event를 Lambda가 받아서 처리하지 않고, Event Bridge가 주기적으로 생성한 cron job 형태의 event로 Lambda를 Trigger하여, SQS에 있는 메시지를 읽어가는 구조입니다. S3에 새로 Object 생성되더라도, Step Functions이 바로 trigger 되지 않고, 정해진 스케줄에 따라 원하는 만큼만 event를 처리할 수 있습니다. 

![image](https://user-images.githubusercontent.com/52392004/165837257-69cc32c7-22b8-4846-9445-62e0f93a6678.png)

EventBridge event로 만든 Cron job에서 다수의 event messages을 처리해야 하는 경우에는 아래와 같은 방법으로 변경도 가능합니다. 상세한 설게는 [S3 Trigger Event Scheduler](https://github.com/kyopark2014/case-study-s3-trigger-event/tree/main/s3-trigger-scheduler)를 참고하십시요. 

![image](https://user-images.githubusercontent.com/52392004/165844568-929eb7f1-8147-4b05-85f6-3ae161afda7d.png)




## 해결방안 2 : S3 Trigger Event Manager based on DynaomoDB

Rare 하지만 비정상 케이스에서도 message 전송을 보장하여야 한다면 아래와 같은 구조도 가능합니다. 

장애등의 어떤 비정상 상황에서 SQS에 저장된 message가 삭제되어 버린 경우에도 정상적으로 데이터를 처리하고자 한다면 아래와 같이 DynamoDB와 같은 데이터베이스를 사용하여 모든 event를 logging 한 후, 순차적으로 처리하는 방법으로 접근 할 수 있을것으로 보입니다. 아래 그림에서는 S3의 object 생성 trigger 발생시 Lambda(S3)가 SQS에 event message를 push 하면서, DynamoDB에도 같은 이벤트를 put 합니다. 이때, 중복방지를 위해 UUID같은 event에 대한 unique한 ID를 생성하여 사용할 수 있습니다. SQS에 저장된 messages들은 순차적으로 Lambda(schedular)에 의해서 처리 되는데, SQS의 메시지를 삭제할때 마찬가지로 DynamoDB의 event message도 삭제합니다. (UUID 이용) 

만약, 비정상적인 상황으로 인해 SQS의 메시지가 유실되었다고 하더라도, DynamoDB와 S3에는 데이터가 남아 있으므로, EventBridge를 통해 정기적으로 cron job을 생성하여, Lambda(check)가 DynamoDB에 전달되지 않은 오래된 event message가 있다면, 다시 SQS로 전송합니다. SQS에 들어온 미처리 데이터는 신규 메시지처럼 처리되고, 처리된 이후에 DynamoDB에서도 삭제가 가능합니다. 

![image](https://user-images.githubusercontent.com/52392004/165841203-bd871114-c554-4b6a-ab46-c8f43b081a5c.png)



#### Event Manager 

아래에서는 Amazon S3에서 생성된 신규 object event를 SQS가 아닌 DynamoDB에 저장후에, EventBridge가 생성한 Cron job으로 Lambda(schedular)가 DynamoDB를 조회한 후, SQS에 push 하는 방법입니다. 상세한 설계는 [S3 Trigger Event Manager](https://github.com/kyopark2014/case-study-s3-trigger-event/tree/main/s3-trigger-manager)를 참고 하십시요.

![image](https://user-images.githubusercontent.com/52392004/166154215-3d23a906-f1df-4df6-893c-4aa0a8f0b75f.png)

## 해결방안 3 : Amazon Glue 

[Amazon Glue를 이용하여 S3 trigger event를 처리하는 방법](https://catalog.us-east-1.prod.workshops.aws/workshops/ee59d21b-4cb8-4b3d-a629-24537cf37bb5/en-US/lab1/event-notification-crawler)이 있습니다. 이 방법은 기존 step functions을 glue를 통해 해결하여야 합니다. 

## 해결방안 4 : DLQ Redrive

메시지를 


[Introducing Amazon Simple Queue Service dead-letter queue redrive to source queues](https://aws.amazon.com/ko/blogs/compute/introducing-amazon-simple-queue-service-dead-letter-queue-redrive-to-source-queues/)
