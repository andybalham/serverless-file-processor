import readline from 'readline';
import { S3 } from 'aws-sdk';
import { Readable } from 'stream';
import { SQSEvent } from 'aws-lambda/trigger/sqs';
import { S3Event } from 'aws-lambda';
import SQS, { SendMessageRequest } from 'aws-sdk/clients/sqs';

const s3Client = new S3;
const sqsClient = new SQS;

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let sqsEventRecordIndex = 0; sqsEventRecordIndex < event.Records.length; sqsEventRecordIndex++) {
        
        const sqsEventRecord = event.Records[sqsEventRecordIndex];

        const s3Event = JSON.parse(sqsEventRecord.body) as S3Event | TestEvent;
        
        const handleFirmLines = async (fileHeaderLine: string, firmLines: string[]): Promise<void> => {

            const message = {
                fileHeader: fileHeaderLine,
                firmLines: firmLines
            };

            const params: SendMessageRequest = {
                MessageBody: JSON.stringify(message),
                QueueUrl: process.env.UNPROCESSED_UPDATE_QUEUE_URL ?? 'undefined'
            };

            // console.log(`Would have sent: ${JSON.stringify(params)}`);

            const result = await sqsClient.sendMessage(params).promise();

            console.log(`result: ${JSON.stringify(result)}`);    
        };

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

                    await processFileStream(s3ReadStream, handleFirmLines);
                                                        
                    console.log('Processed file stream');

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

export async function processFileStream(readerStream: Readable, handleLineGroup: (fileHeaderLine: string, lineGroup: string[]) => Promise<void>): Promise<void> {

    let fileHeaderLine = '';
    let currentLineKey: string | null = null;
    let currentLineGroup = new Array<string>();

    const getLineKey = (line: string): string => {
        return line.slice(0, line.indexOf('|'));
    };

    // TODO 25Aug20: Consider

    // try {
    //     const rl = createInterface({
    //       input: createReadStream('big-file.txt'),
    //       crlfDelay: Infinity
    //     });

    //     rl.on('line', (line) => {
    //       // Process the line.
    //     });

    //     await once(rl, 'close');

    //     console.log('File processed.');
    //   } catch (err) {
    //     console.error(err);
    //   }

    const readFileAsync = new Promise((resolve, reject) => {

        const lineReader = readline
            .createInterface({
                input: readerStream,
                terminal: false
            });

        lineReader.on('line', async (line: string) => {

            const lineKey = getLineKey(line);

            console.log(line);

            if (lineKey === 'Header') {

                fileHeaderLine = line;
                
            } else {

                if (lineKey === currentLineKey) {

                    currentLineGroup.push(line);

                } else {

                    const previousLineGroup = currentLineGroup;

                    currentLineKey = lineKey;
                    currentLineGroup = [line];

                    if (previousLineGroup.length > 0) {
                        await handleLineGroup(fileHeaderLine, previousLineGroup);
                    }
                }
            }
        });

        lineReader.on('close', async () => {

            console.log('closed');

            if (currentLineGroup.length > 0) {
                await handleLineGroup(fileHeaderLine, currentLineGroup);
            }
    
            resolve();
        });
    });

    // const readFileAsync = new Promise(resolve => {

    //     const lineReader = readline
    //         .createInterface({
    //             input: readerStream,
    //             terminal: false
    //         });

    //     lineReader.on('line', (line: string) => {
    //         console.log(line);
    //     });

    //     lineReader.on('close', () => {
    //         console.log('closed');
    //         resolve();
    //     });
    // });

    try {
        await readFileAsync;
    }
    catch(err) {
        console.log('an error has occurred');
    }

    console.log('done reading!');
}