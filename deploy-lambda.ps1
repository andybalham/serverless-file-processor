compress-archive -force -path dist\* serverless-file-processing.zip

aws configure set region eu-west-2 

aws s3 cp serverless-file-processing.zip s3://lambda-source-200921

# TODO: List all functions with the application prefix and update each in turn

aws lambda update-function-code --function-name serverless-file-processing-file-processor-function --s3-bucket lambda-source-200921 --s3-key serverless-file-processing.zip | Out-Null
aws lambda update-function-code --function-name serverless-file-processing-file-update-processor-function --s3-bucket lambda-source-200921 --s3-key serverless-file-processing.zip | Out-Null
aws lambda update-function-code --function-name serverless-file-processing-lookup-table-event-processor-function --s3-bucket lambda-source-200921 --s3-key serverless-file-processing.zip | Out-Null
aws lambda update-function-code --function-name serverless-file-processing-iterator-update-processor-function --s3-bucket lambda-source-200921 --s3-key serverless-file-processing.zip | Out-Null