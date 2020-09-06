import { createReadStream } from 'fs';
import { processFileStream } from '../src/fileProcessorLambda';
import { processUpdateMessage } from '../src/updateProcessorLambda';
import { expect } from 'chai';
import { UpdateMessage } from '../src/UpdateMessage';
import { DatabaseItem, FirmAuthorisationDatabaseItem, AlternativeFirmNamesDatabaseItem, FirmPermissionsDatabaseItem, FirmAppointedRepresentativeDatabaseItem, FirmPrincipalDatabaseItem } from '../src/DatabaseItems';

describe('File reading', () => {

    it('can read file', async () => {

        const readerStream = createReadStream('.\\test\\testData.txt');
        readerStream.setEncoding('utf-8');

        let data = '';

        // Handle stream events --> data, end, and error
        readerStream.on('data', function(chunk) {
            data += chunk;
        });
 
        readerStream.on('end', function() {
            console.log(data);
        });
 
        readerStream.on('error', function(err) {
            console.log(err.stack);
        });
 
        console.log('Program Ended');
    });

    [
        { filePath: '.\\test\\data\\master.ext', expectedHeader: 'Header|Firms Master List|20200416|1905|', expectedGroupCount: 20},
        { filePath: '.\\test\\data\\names.ext', expectedHeader: 'Header|Alternative Firm Name|20200416|1905|', expectedGroupCount: 6},
        { filePath: '.\\test\\data\\permission.ext', expectedHeader: 'Header|Firm Permission|20200416|1905|', expectedGroupCount: 3},
        { filePath: '.\\test\\data\\app_reps.ext', expectedHeader: 'Header|Appointment|20200416|1905|', expectedGroupCount: 5},
    ].forEach(theory => {

        it(`can read ${theory.filePath}`, async () => {

            const readerStream = createReadStream(theory.filePath);
    
            let actualHeader = '';
            const actualLineGroups = new Array<Array<string>>();
    
            const handleLines = async (header: string, lines: string[]): Promise<void> => {
                actualHeader = header;
                actualLineGroups.push(lines);
                console.log(`Pushed lines: ${lines.length}, first: ${lines[0]}`);
            };
    
            await processFileStream(readerStream, handleLines);
    
            expect(actualHeader).to.equal(theory.expectedHeader);
            expect(actualLineGroups.length).to.equal(theory.expectedGroupCount);
        });    
    });

    it('can process firm authorisation updates', async () => {
        
        const updateMessage: UpdateMessage = {
            headerLine: 'Header|Firms Master List|20200416|1905|',
            dataLines: [
                '100425|Northern Financial Services Ltd|5|1|N|Northern Financial Services Ltd|The Square|||Northern|N Yorkshire|RD53|1XT|+44|-|1756705000||||Authorised|20011201|20011201|NORTHERNFINANCIALSERVICESLTD|20200226|02061788||||'
            ]
        };

        const expectedItems: FirmAuthorisationDatabaseItem[] = [
            {
                firmReference: '100425',
                itemType: 'FirmAuthorisation',
                registeredFirmName: 'Northern Financial Services Ltd',
                addressLine1: 'Northern Financial Services Ltd',
                addressLine2: 'The Square',
                addressLine3: undefined,
                addressLine4: undefined,
                addressLine5: 'Northern',
                addressLine6: 'N Yorkshire',
                postcodeIn: 'RD53',
                postcodeOut: '1XT',
                currentAuthorisationStatusCode: 'Authorised'
            }
        ];

        let actualItems: DatabaseItem[] | null = null;

        await processUpdateMessage(updateMessage, async (databaseItems) => {
            actualItems = databaseItems;
        });

        expect(actualItems).to.deep.equal(expectedItems);
    });

    it('can process alternative name updates', async () => {
        
        const updateMessage: UpdateMessage = {
            headerLine: 'Header|Alternative Firm Name|20200416|1905|',
            dataLines: [
                '100425|Tumeric Direct|2|20071101||TUMERICDIRECT|20071101|',
                '100425|Tumeric Insure|2|20071101|20110516|TUMERICINSURE|20110516|',
            ]
        };

        const expectedItems: AlternativeFirmNamesDatabaseItem[] = [
            {
                firmReference: '100425',
                itemType: 'AlternativeFirmNames',
                names: [
                    {
                        name: 'Tumeric Direct',
                        effectiveDate: '2007-11-01',
                        endDate: undefined        
                    },
                    {
                        name: 'Tumeric Insure',
                        effectiveDate: '2007-11-01',
                        endDate: '2011-05-16'
                    }
                ]
            },
        ];

        let actualItems: DatabaseItem[] | null = null;

        await processUpdateMessage(updateMessage, async (databaseItems) => {
            actualItems = databaseItems;
        });

        expect(actualItems).to.deep.equal(expectedItems);
    });    

    it('can process permission updates', async () => {
        
        const updateMessage: UpdateMessage = {
            headerLine: 'Header|Firm Permission|20200416|1905|',
            dataLines: [
                '100013|14|||4|20011201|20011130|',
                '100013|14|6|5|4|20050114|20050113|',
            ]
        };

        const expectedItems: FirmPermissionsDatabaseItem[] = [
            {
                firmReference: '100013',
                itemType: 'RegulatedActivityPermissions',
                permissions: [
                    {
                        regulatedActivityCode: '14',
                        investmentTypeCode: undefined,
                        customerTypeCode: undefined,
                        statusCode: '4',
                        effectiveDate: '2001-12-01'
                    },
                    {
                        regulatedActivityCode: '14',
                        investmentTypeCode: '6',
                        customerTypeCode: '5',
                        statusCode: '4',
                        effectiveDate: '2005-01-14'
                    },
                ]
            },
        ];

        let actualItems: DatabaseItem[] | null = null;

        await processUpdateMessage(updateMessage, async (databaseItems) => {
            actualItems = databaseItems;
        });

        expect(actualItems).to.deep.equal(expectedItems);
    });    

    it('can process appointed representative updates', async () => {
        
        const updateMessage: UpdateMessage = {
            headerLine: 'Header|Appointment|20200416|1905|',
            dataLines: [
                '100014|117659|Withdrawn|20011201|20021104|TRUE|FALSE|FALSE|',
            ]
        };

        const expectedItems: Array<FirmAppointedRepresentativeDatabaseItem | FirmPrincipalDatabaseItem> = [
            {
                firmReference: '100014',
                itemType: 'FirmAppointedRepresentative-117659',
                principalFirmRef: '117659',
                statusCode: 'Withdrawn',
                statusEffectiveDate: '2001-12-01'
            },
            {
                firmReference: '117659',
                itemType: 'FirmPrincipal-100014',
                appointedRepresentativeFirmRef: '100014',
                statusCode: 'Withdrawn',
                statusEffectiveDate: '2001-12-01'
            },
        ];

        let actualItems: DatabaseItem[] | null = null;

        await processUpdateMessage(updateMessage, async (databaseItems) => {
            actualItems = databaseItems;
        });

        expect(actualItems).to.deep.equal(expectedItems);
    });
});