# case-s3-event-logging

## Preblem Description 

아래 그림과 같이 다수의 디바이스들이 Amazon S3에 디바이스의 state와 같은 data를 json 파일 형태후 AWS Step Functions으로 처리하는 케이스가 있습니다. Amazon S3에 object가 생성되어 발생하는 event를 Lambda가 받아서 Amazon Step Functions에서 처리하게 됩니다. 일시적으로 처리량보다 더 많은 event가 trigger되었을때를 가졍하여 Amazon SQS를 사용하고 있습니다. 

<img width="654" alt="image" src="https://user-images.githubusercontent.com/52392004/165797212-de9ed666-7a1f-456a-9d3f-638d1f28d168.png">

문제가 되는 케이스의 한 예는 아래와 같습니다.

- AWS Step Functions에서 1개의 event를 처리 할 때 1초라고 가정합니다. S3에 저장되는 데이터가 1초보다 천천히 들어온다면, Amazon SQS에 event가 쌓이지 않고 잘 처리가 됩니다.

- Amazon S3에 저장되는 데이터가 일시적으로 1초에 1개보다 더 많이 들어오더라도, SQS에 message는 제한없이 저장됩니다.  full 되지 않으면, event는 유실되지 않고 정상적으로 처리가 됩니다. Amazon SQS의 Standard type은 120,000개의 event를 가지고 있을수 있습니다.

- Amazon Step Functions의 처리량보다 훨씬 큰 트래픽이 일시적으로 주입되어서 SQS가 full 되었다면, event가 유실 되는 케이스가 발생할 수 있습니다. 


### SQS 기본 동작 

- SQS에 저장된 메시지는 [consumer가 가져가서 처리가 다 끝나면 영구적으로 삭제](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#1-successful-processing)해야 합니다. 

- SQS에 저장된 메시지를 [consumer가 가져갔으나 지우지 않으면(inflight)](https://www.bluematador.com/docs/troubleshooting/aws-sqs-limits), Standard 메시지는 120,000개, FIFO는 20,000개의 제한이 있습니다. 이 할당량은 [AWS에 요청하여 변경](https://us-east-1.console.aws.amazon.com/support/home?region=us-east-1#/case/create?issueType=service-limit-increase&limitType=service-code-sqs) 할 수 있습니다.

- SQS에 저장된 메시지를 consumer가 가져가서 처리를 하지만 [처리가 안되어서 다시 읽을 수](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#3-maximum-receive-count-set-too-low)도 있는데, 이때 [MaxReceiverCount(up to 1000)가 넘으면 DLQ(Dead Letter Queue)로 전달](https://github.com/kyopark2014/technical-summary/blob/main/sqs.md) 됩니다. 

- SQS의 메시지는 [retension time(default: 4days, up to 14days)이후에는 마찬가지로 DLQ로 전달](https://bitesizedserverless.com/bite/the-9-ways-an-sqs-message-can-be-deleted/#4-message-retention-period-exceeded)됩니다.




[Amazon Glue를 이용하여 S3 trigger event를 처리하는 방법](https://catalog.us-east-1.prod.workshops.aws/workshops/ee59d21b-4cb8-4b3d-a629-24537cf37bb5/en-US/lab1/event-notification-crawler)이 있습니다. 

