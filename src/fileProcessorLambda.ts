import readline from 'readline';
import { SQSEvent } from 'aws-lambda/trigger/sqs';
import { S3Event } from 'aws-lambda';
import SQS, { SendMessageRequest } from 'aws-sdk/clients/sqs';
import { FileUpdateMessage, LineGroupBlock } from './FileUpdateMessage';
import { parseLine } from './parsing';
import { FileType } from './FileType';
import S3, { GetObjectRequest } from 'aws-sdk/clients/s3';

const s3Client = new S3;
const sqsClient = new SQS;

const sampleRate = 10000;

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let sqsEventRecordIndex = 0; sqsEventRecordIndex < event.Records.length; sqsEventRecordIndex++) {
        
        const sqsEventRecord = event.Records[sqsEventRecordIndex];

        const s3Event = JSON.parse(sqsEventRecord.body) as S3Event | TestEvent;

        if ('Records' in s3Event) {
            
            for (let s3EventRecordIndex = 0; s3EventRecordIndex < s3Event.Records.length; s3EventRecordIndex++) {

                const s3EventRecord = s3Event.Records[s3EventRecordIndex];

                if (s3EventRecord.eventName.startsWith('ObjectCreated:')) {

                    const bucket = s3EventRecord.s3.bucket.name;
                    const key = decodeURIComponent(s3EventRecord.s3.object.key.replace(/\+/g, ' '));

                    await processFile(bucket, key);
                                                        
                    console.log('Processed file');

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

export async function processFile(fileBucket: string, fileKey: string): Promise<void> {

    const params: GetObjectRequest = {
        Bucket: fileBucket,
        Key: fileKey,
    };

    console.log(`params: ${JSON.stringify(params)}`);

    const readerStream = s3Client.getObject(params).createReadStream();

    let fileType: FileType | undefined = undefined;
    let currentLineKey: string | null = null;
    let currentLineGroup = new Array<string>();
    let lineNumber = 0;

    const getLineKey = (lineParts: string[]): string | null => {        
        switch (fileType) {
        case FileType.Appointment:
        case FileType.FirmPermission:
            return `${lineParts[0]}|${lineParts[1]}`;
        default:
            return lineParts[0];
        }
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

    const lineGroupBlocks = new Array<LineGroupBlock>();

    let startLineKey: string | null = null;
    let lineGroupBlockCount = 0;

    const readFileAsync = new Promise(resolve => {

        const lineReader = readline
            .createInterface({
                input: readerStream,
                terminal: false
            });

        lineReader.on('line', async (line: string) => {

            lineNumber = lineNumber + 1;

            if (lineNumber % sampleRate === 0) console.log(`Processing line number: ${lineNumber}`);

            const lineParts = parseLine(line);

            if (lineParts[0] === 'Header') {
                fileType = lineParts[1] as FileType;
                return;                
            }

            if (lineParts[0] === 'Footer') {
                return;                
            }

            const lineKey = getLineKey(lineParts);

            if (lineKey === currentLineKey) {

                currentLineGroup.push(line);

            } else {

                const previousLineGroup = currentLineGroup;

                currentLineKey = lineKey;
                currentLineGroup = [line];

                if (startLineKey === null) {
                    startLineKey = lineKey;
                }
                
                if (previousLineGroup.length > 0) {

                    lineGroupBlockCount += 1;

                    if (lineGroupBlockCount === LineGroupBlock.Size) {
                        
                        lineGroupBlocks.push({
                            startLineKey: startLineKey,
                            endLineKey: lineKey
                        });

                        startLineKey = lineKey;
                        lineGroupBlockCount = 0;
                    }
                }
            }
        });

        lineReader.on('close', async () => {

            console.log('closed');

            if (currentLineGroup.length > 0) {
                lineGroupBlocks.push({
                    startLineKey: startLineKey,
                    endLineKey: null
                });
            }

            resolve();
        });
    });

    try {
        await readFileAsync;
    }
    catch(err) {
        console.log('an error has occurred');
    }

    console.log('done reading!');

    for (const lineGroupBlock of lineGroupBlocks) {

        const message: FileUpdateMessage = {
            fileBucket: fileBucket,
            fileKey: fileKey,
            fileType: fileType,
            lineGroupBlock: lineGroupBlock
        };

        const params: SendMessageRequest = {
            MessageBody: JSON.stringify(message),
            QueueUrl: process.env.UNPROCESSED_UPDATE_QUEUE_URL ?? 'undefined'
        };

        await sqsClient.sendMessage(params).promise();

        console.log(`Sent message: ${JSON.stringify(message)}`);
    }
}