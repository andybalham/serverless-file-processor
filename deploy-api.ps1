param ([string] $AppName, [string] $ApiVersion)

aws configure set region eu-west-2 

Get-ChildItem ".\src\api" |
Foreach-Object {
    $S3Location = "s3://agb-app-source/$AppName/api-$ApiVersion/" + $_.Name
    aws s3 cp $_.FullName $S3Location
}

aws cloudformation deploy `
    --template-file template.yaml `
    --stack-name $AppName `
    --capabilities CAPABILITY_IAM `
    --region eu-west-2 `
    --parameter-overrides EnableSQS=true ApiVersion=$ApiVersion