import { SNSMessage } from 'aws-lambda';
import { SQSEvent } from 'aws-lambda/trigger/sqs';

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
        const sqsEventRecord = event.Records[recordIndex];

        const snsMessage: SNSMessage = JSON.parse(sqsEventRecord.body);

        console.log(`snsMessage: ${JSON.stringify(snsMessage)}`);
    }
    
    console.log('Exiting');
};
