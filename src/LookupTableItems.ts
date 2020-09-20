import hash from 'object-hash';

export interface ILookupTableItemKeys {
    firmReference: string;
    itemType: string;
}

export abstract class LookupTableItem implements ILookupTableItemKeys {

    firmReference: string;
    itemType: string;
    itemHash?: string;

    static getItemHash(item: LookupTableItem): string {
        return hash(item, { unorderedArrays: true });
    }
}

export class FirmAuthorisationLookupTableItem extends LookupTableItem {
    registeredFirmName: string;
    addressLine1?: string;
    addressLine2?: string;
    addressLine3?: string;
    addressLine4?: string;
    addressLine5?: string;
    addressLine6?: string;
    postcodeIn?: string;
    postcodeOut?: string;
    currentAuthorisationStatusCode: string;
}

export class AlternativeFirmNamesLookupTableItem extends LookupTableItem {
    names: AlternativeFirmName[]
}

export class AlternativeFirmName {
    name: string;
    effectiveDate: string;
    endDate?: string;
}

export class FirmPermissionsLookupTableItem extends LookupTableItem {
    regulatedActivityCode: string;
    permissions: FirmPermission[]
}

export class FirmPermission {
    investmentTypeCode?: string;
    customerTypeCode?: string;
    statusCode: string;
    effectiveDate: string;
}

export class FirmPrincipalLookupTableItem extends LookupTableItem {
    principalFirmRef: string;
    statusCode: string;
    statusEffectiveDate: string;
}

export class FirmAppointedRepresentativeLookupTableItem extends LookupTableItem {
    appointedRepresentativeFirmRef: string;
    statusCode: string;
    statusEffectiveDate: string;
}
