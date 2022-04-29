# S3 Trigger Event Schedular

여기서는 S3 Trigger Event를 처리하기 위한 Schedular 설계에 집중하여 설명합니다. 

## Basic Architecture

여기서 구현하려는 Archiecture는 아래와 같이, Amazon S3, Amazon SQS와 Amazon EventBridge로 구성됩니다. 여기서 StepFunction은 Schedular와 관계없는 Load에 관계되므로, 편의상 log로 대체합니다. 

![image](https://user-images.githubusercontent.com/52392004/165913999-4feac784-7e81-401c-9437-fd398a40b4ba.png)



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



