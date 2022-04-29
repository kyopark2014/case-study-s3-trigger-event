# S3 Trigger Event Schedular

여기서는 S3 Trigger Event를 처리하기 위한 Schedular 설계에 집중하여 설명합니다. 

## Basic Architecture

여기서 구현하려는 Archiecture는 아래와 같이, Amazon S3, Amazon SQS와 Amazon EventBridge로 구성됩니다. 여기서 StepFunction은 Schedular와 관계없는 Load에 관계되므로, 편의상 log로 대체합니다. 

![image](https://user-images.githubusercontent.com/52392004/165916282-d38b28dc-c8c4-4dfd-bfa7-a4f471e956b7.png)

## CDK 

생성하기

```c
$ cdk synth

$ cdk deploy
````

삭제하기 

```c
$ cdk destory
```


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


