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

    static readonly ItemType = 'FirmAuthorisation'

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

    static readonly ItemType = 'AlternativeFirmNames'

    names: AlternativeFirmName[]
}

export class AlternativeFirmName {
    name: string;
    effectiveDate: string;
    endDate?: string;
}

export class FirmPermissionsLookupTableItem extends LookupTableItem {
    
    static readonly ItemType = 'FirmPermissions'
    static readonly ItemTypePrefix = `-${FirmPermissionsLookupTableItem.ItemType}`

    static getItemType(regulatedActivityCode: string): string {
        return FirmPermissionsLookupTableItem.ItemTypePrefix + regulatedActivityCode;
    }

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
    
    static readonly ItemType = 'FirmPrincipal'
    static readonly ItemTypePrefix = `-${FirmPrincipalLookupTableItem.ItemType}`

    static getItemType(appointedRepresentativeFirmRef: string): string {
        return FirmPrincipalLookupTableItem.ItemTypePrefix + appointedRepresentativeFirmRef;
    }

    appointedRepresentativeFirmRef: string;
    statusCode: string;
    statusEffectiveDate: string;
}

export class FirmAppointedRepresentativeLookupTableItem extends LookupTableItem {
    
    static readonly ItemType = 'FirmAppointedRepresentative'
    static readonly ItemTypePrefix = `-${FirmAppointedRepresentativeLookupTableItem.ItemType}`

    static getItemType(principalFirmRef: string): string {
        return FirmAppointedRepresentativeLookupTableItem.ItemTypePrefix + principalFirmRef;
    }

    principalFirmRef: string;
    statusCode: string;
    statusEffectiveDate: string;
}

export class IsActiveMortgageFirmLookupTableItem extends LookupTableItem {

    static readonly ItemType = 'IsActiveMortgageFirm'
    
    isActiveMortgageFirm: boolean;
}
