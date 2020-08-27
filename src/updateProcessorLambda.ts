import { SQSEvent } from 'aws-lambda/trigger/sqs';

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
        const sqsEventRecord = event.Records[recordIndex];

        console.log(`sqsEventRecord: ${JSON.stringify(sqsEventRecord)}`);
    }
    
    console.log('Exiting');
};

