import readline from 'linebyline';
import { SQS, S3 } from 'aws-sdk';
import { Readable } from 'stream';
import { SQSEvent } from 'aws-lambda/trigger/sqs';
import { S3Event } from 'aws-lambda';
import { SendMessageRequest } from 'aws-sdk/clients/sqs';

const s3Client = new S3;
const sqsClient = new SQS;

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let sqsEventRecordIndex = 0; sqsEventRecordIndex < event.Records.length; sqsEventRecordIndex++) {
        
        const sqsEventRecord = event.Records[sqsEventRecordIndex];

        const s3Event = JSON.parse(sqsEventRecord.body) as S3Event | TestEvent;
        
        if ('Records' in s3Event) {
            
            for (let s3EventRecordIndex = 0; s3EventRecordIndex < s3Event.Records.length; s3EventRecordIndex++) {

                const s3EventRecord = s3Event.Records[s3EventRecordIndex];

                if (s3EventRecord.eventName === 'ObjectCreated:Put') {

                    const bucket = s3EventRecord.s3.bucket.name;
                    const key = decodeURIComponent(s3EventRecord.s3.object.key.replace(/\+/g, ' '));

                    const params = {
                        Bucket: bucket,
                        Key: key,
                    };

                    console.log(`params: ${JSON.stringify(params)}`);
                
                    const s3ReadStream = s3Client.getObject(params).createReadStream();

                    await processFileStream(s3ReadStream, sqsClient);

                } else {
                    console.warn(`Unexpected eventName: ${s3EventRecord.eventName}`);
                }                
            }

        } else {
            console.log('Test event received');
        }
    }
    
    console.log('Exiting');
};

class TestEvent {
    Event: string
}

export async function processFileStream(readerStream: Readable, sqsClient: SQS): Promise<void> {

    const rl = readline(readerStream);

    const myReadPromise = new Promise((resolve, reject) => {

        rl.on('line', async (line: string) => {

            const message = {
                fileType: 'TestFileType',
                lines: [ line ]
            };

            const params: SendMessageRequest = {
                MessageBody: JSON.stringify(message),
                QueueUrl: process.env.UNPROCESSED_UPDATE_QUEUE_URL ?? 'undefined'
            };
    
            const result = await sqsClient.sendMessage(params).promise();

            console.log(`result: ${JSON.stringify(result)}`);            
            console.log(`Line from file: ${line}`);
        });

        rl.on('error', (err) => {
            console.log('error');
            reject(err);
        });

        rl.on('close', function () {
            console.log('closed');
            resolve();
        });
    });

    try { 
        await myReadPromise; 
    }
    catch(err) {
        console.log('an error has occurred');
    }

    console.log('done reading!');
}