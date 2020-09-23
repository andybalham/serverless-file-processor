aws configure set region eu-west-2 

# TODO: Pass in the application name and iterate over the files

aws s3 cp src\api\api.graphqls s3://agb-app-source/serverless-file-processing
aws s3 cp src\api\getFirmAuthorisationRequest.vtl s3://agb-app-source/serverless-file-processing
aws s3 cp src\api\getFirmAuthorisationResponse.vtl s3://agb-app-source/serverless-file-processing

