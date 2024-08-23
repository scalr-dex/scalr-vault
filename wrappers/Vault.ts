import { 
    Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode
} from '@ton/core';


export type VaultConfig = {
    vaultJettonWallet: Address,
    adminAddress: Address,
    keeperAddress: Address,
    tempUpgrade: Cell,
};


export function VaultConfigToCell(config: VaultConfig): Cell {
    return beginCell()
        .storeAddress(config.vaultJettonWallet)
        .storeAddress(config.adminAddress)
        .storeAddress(config.keeperAddress)
        .storeRef(config.tempUpgrade)
        .endCell();
}

export const Opcodes = {
    transferNotification: 0x7362d09c,
    requestWithdrawal: 0x25d4fcff,
    refuseWithdrawal: 0xe659c222,
    withdraw: 0xb5de5f9e,
    setVaultJettonWallet: 0xed105058,
    initCodeUpgrade: 0xdf1e233d,
    initAdminUpgrade: 0x2fb94384,
    initKeeperUpgrade: 0x8349e5be,
    cancelCodeUpgrade: 0x357ccc67,
    cancelAdminUpgrade: 0xa4ed9981,
    cancelKeeperUpgrade: 0xf3a845eb,
    finalizeUpgrades: 0x6378509f,
};

export function transferNotification(amount: bigint, sender: Address, forwardPayload: Cell, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.transferNotification, 32)
    .storeUint(queryID ?? 0, 64)
    .storeCoins(amount)
    .storeAddress(sender)
    .storeRef(forwardPayload)
    .endCell();
}

export function setVaultJettonWallet(vaultJettonWallet: Address, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.setVaultJettonWallet, 32)
    .storeUint(queryID ?? 0, 64)
    .storeAddress(vaultJettonWallet)
    .endCell();
}

export function requestWithdrawal(jettonAmount: bigint, userAddress: Address, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.requestWithdrawal, 32)
    .storeUint(queryID ?? 0, 64)
    .storeCoins(jettonAmount)
    .storeAddress(userAddress)
    .endCell();
}

export function refuseWithdrawal(jettonAmount: bigint, userAddress: Address, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.refuseWithdrawal, 32)
    .storeUint(queryID ?? 0, 64)
    .storeCoins(jettonAmount)
    .storeAddress(userAddress)
    .endCell();
}

export function withdraw(jettonAmount: bigint, userAddress: Address, fwdValue: bigint, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.withdraw, 32)
    .storeUint(queryID ?? 0, 64)
    .storeCoins(jettonAmount)
    .storeAddress(userAddress)
    .storeCoins(fwdValue)
    .endCell();
}

export function initCodeUpgrade(newCode: Cell, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.initCodeUpgrade, 32)
    .storeUint(queryID ?? 0, 64)
    .storeRef(newCode)
    .endCell();
}

export function initAdminUpgrade(newAdmin: Address, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.initAdminUpgrade, 32)
    .storeUint(queryID ?? 0, 64)
    .storeAddress(newAdmin)
    .endCell();
}

export function initKeeperUpgrade(newKeeper: Address, queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.initKeeperUpgrade, 32)
    .storeUint(queryID ?? 0, 64)
    .storeAddress(newKeeper)
    .endCell();
}  

export function cancelCodeUpgrade(queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.cancelCodeUpgrade, 32)
    .storeUint(queryID ?? 0, 64)
    .endCell();
}

export function cancelAdminUpgrade(queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.cancelAdminUpgrade, 32)
    .storeUint(queryID ?? 0, 64)
    .endCell();
}

export function cancelKeeperUpgrade(queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.cancelKeeperUpgrade, 32)
    .storeUint(queryID ?? 0, 64)
    .endCell();
}  

export function finalizeUpgrades(queryID?: number): Cell {
    return beginCell().storeUint(Opcodes.finalizeUpgrades, 32)
    .storeUint(queryID ?? 0, 64)
    .endCell();
}


export class Vault implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Vault(address);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = VaultConfigToCell(config);
        const init = { code, data };
        return new Vault(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransferNotification(provider: ContractProvider, via: Sender, opts: {
        value: bigint;
        amount: bigint; 
        sender: Address;
        forwardPayload: Cell;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: transferNotification(opts.amount, opts.sender, opts.forwardPayload, opts.queryID),
        });
    }

    async sendSetVaultJettonWallet(provider: ContractProvider, via: Sender, opts: {
        value: bigint;
        vaultJettonWallet: Address;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: setVaultJettonWallet(opts.vaultJettonWallet, opts.queryID),
        });
    }

    async sendRequestWithdrawal(provider: ContractProvider, via: Sender, opts: {
        value: bigint;
        jettonAmount: bigint;
        userAddress: Address;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: requestWithdrawal(opts.jettonAmount, opts.userAddress, opts.queryID),
        });
    }

    async sendRefuseWithdrawal(provider: ContractProvider, via: Sender, opts: {
        value: bigint;
        jettonAmount: bigint;
        userAddress: Address;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: refuseWithdrawal(opts.jettonAmount, opts.userAddress, opts.queryID),
        });
    }

    async sendWithdraw(provider: ContractProvider, via: Sender, opts: {
        value: bigint;
        jettonAmount: bigint;
        userAddress: Address;
        fwdValue: bigint;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: withdraw(opts.jettonAmount, opts.userAddress, opts.fwdValue, opts.queryID),
        });
    }

    async sendInitCodeUpgrade(provider: ContractProvider, via: Sender, opts: {
        value: bigint, 
        newCode: Cell;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: initCodeUpgrade(opts.newCode, opts.queryID),
        });
    }

    async sendInitAdminUpgrade(provider: ContractProvider, via: Sender, opts: {
        value: bigint, 
        newAdmin: Address;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: initAdminUpgrade(opts.newAdmin, opts.queryID),
        });
    }

    async sendInitKeeperUpgrade(provider: ContractProvider, via: Sender, opts: {
        value: bigint, 
        newKeeper: Address;
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: initKeeperUpgrade(opts.newKeeper, opts.queryID),
        });
    }

    async sendCancelCodeUpgrade(provider: ContractProvider, via: Sender, opts: {
        value: bigint, 
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: cancelCodeUpgrade(opts.queryID),
        });
    }

    async sendCancelAdminUpgrade(provider: ContractProvider, via: Sender, opts: {
        value: bigint, 
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: cancelAdminUpgrade(opts.queryID),
        });
    }

    async sendCancelKeeperUpgrade(provider: ContractProvider, via: Sender, opts: {
        value: bigint, 
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: cancelKeeperUpgrade(opts.queryID),
        });
    }

    async sendFinalizeUpgrades(provider: ContractProvider, via: Sender, opts: {
        value: bigint, 
        queryID?: number;
    })
    {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: finalizeUpgrades(opts.queryID),
        });
    }

    async getVaultData(provider: ContractProvider) {
        const result = await provider.get('get_vault_data', []);
        let vaultJettonWallet = result.stack.readAddress();
        let adminAddress = result.stack.readAddress();
        let keeperAddress = result.stack.readAddress();
        let tempUpgrade = result.stack.readCell();

        return {
            vaultJettonWallet,
            adminAddress,
            keeperAddress,
            tempUpgrade,
        };
    }
}
